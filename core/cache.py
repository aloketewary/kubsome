"""
Cache — high-performance adaptive TTL cache for kubectl results.

Features:
  - Lock-free reads (dict access is thread-safe in CPython)
  - Adaptive TTL: grows when data is stable, resets on change
  - Stale-while-revalidate: returns stale data, refreshes in background
  - Tiered prewarm: raw resources first, then derived collectors
  - Event-driven invalidation for destructive ops
"""

import time
import hashlib
import threading
from functools import wraps

from core.context import context, context_scope


_cache = {}
_write_lock = threading.Lock()
_refreshing = set()
_refresh_lock = threading.Lock()

MIN_TTL = 5
MAX_TTL = 60
STALE_GRACE = 30


def _make_key(func, args, kwargs):
    """Build a cache key that always includes Kubernetes request scope."""
    scope = f"context={context.current_context!r};namespace={context.namespace!r}"
    base = f"{func.__qualname__}|{scope}"
    if not args and not kwargs:
        return base
    raw = f"{args}:{sorted(kwargs.items()) if kwargs else ''}"
    if len(raw) > 128:
        return f"{base}:{hashlib.md5(raw.encode()).hexdigest()}"
    return f"{base}:{raw}"


def cached(ttl=5, adaptive=True):
    """
    Decorator that caches function results with adaptive TTL.

    Reads are lock-free. Writes use a lock.
    Stale-while-revalidate returns old data immediately
    and refreshes in background.
    """
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            key = _make_key(func, args, kwargs)
            now = time.time()

            entry = _cache.get(key)
            if entry:
                if now < entry["expires"]:
                    return entry["value"]
                if now < entry["expires"] + STALE_GRACE:
                    _trigger_bg_refresh(
                        key, func, args, kwargs, ttl, adaptive
                    )
                    return entry["value"]

            result = func(*args, **kwargs)
            _store(key, result, ttl, adaptive)
            return result

        wrapper._cache_key_fn = lambda *a, **kw: _make_key(func, a, kw)
        wrapper._wrapped_fn = func
        return wrapper
    return decorator


def _trigger_bg_refresh(key, func, args, kwargs, ttl, adaptive):
    """Refresh one cache entry while preserving its Kubernetes scope."""
    with _refresh_lock:
        if key in _refreshing:
            return
        _refreshing.add(key)

    scoped_context = context.current_context
    scoped_namespace = context.namespace

    def _do():
        try:
            with context_scope(scoped_context, scoped_namespace):
                result = func(*args, **kwargs)
            _store(key, result, ttl, adaptive)
        finally:
            with _refresh_lock:
                _refreshing.discard(key)

    threading.Thread(target=_do, daemon=True).start()


def _store(key, result, ttl, adaptive):
    """Store result with adaptive TTL calculation."""
    now = time.time()
    new_ttl = ttl

    if adaptive:
        entry = _cache.get(key)
        if entry:
            if _data_changed(entry["value"], result):
                new_ttl = MIN_TTL
            else:
                new_ttl = min(entry["current_ttl"] * 1.5, MAX_TTL)

    with _write_lock:
        _cache[key] = {
            "value": result,
            "expires": now + new_ttl,
            "current_ttl": new_ttl,
            "fetched_at": now,
        }


def _data_changed(old, new):
    """Detect if data changed (fast heuristic for large lists)."""
    if type(old) != type(new):
        return True
    if isinstance(old, list):
        if len(old) != len(new):
            return True
        if not old:
            return False
        if old[0] != new[0] or old[-1] != new[-1]:
            return True
        if len(old) > 4:
            mid = len(old) // 2
            return old[mid] != new[mid]
        return False
    if isinstance(old, dict):
        if len(old) != len(new):
            return True
        old_items = old.get("items")
        new_items = new.get("items")
        if isinstance(old_items, list) and isinstance(new_items, list):
            return len(old_items) != len(new_items)
        return old != new
    return old != new


def invalidate(prefix=""):
    """Clear cache entries matching prefix."""
    with _write_lock:
        if not prefix:
            _cache.clear()
            return
        keys = [k for k in _cache if prefix in k]
        for key in keys:
            del _cache[key]


def invalidate_pods():
    """Invalidate all pod-related caches."""
    invalidate("pods")
    invalidate("get_pods")
    invalidate("get_pod_names")
    invalidate("collect_pods")


def invalidate_deployments():
    """Invalidate deployment-related caches."""
    invalidate("deployment")
    invalidate("collect_deployments")


def cache_stats():
    """Return cache statistics."""
    now = time.time()
    entries = []
    for key, entry in _cache.items():
        name = key.split("|")[0]
        entries.append({
            "key": name,
            "ttl": round(entry["current_ttl"], 1),
            "expires_in": round(entry["expires"] - now, 1),
            "valid": now < entry["expires"],
        })
    return {
        "total_entries": len(entries),
        "valid_entries": sum(1 for entry in entries if entry["valid"]),
        "entries": entries[:10],
    }


def prewarm(silent=False):
    """Warm raw Kubernetes resources, then derived collector caches."""
    from concurrent.futures import ThreadPoolExecutor, as_completed
    import time as _time

    from core.context import context, context_scope
    from core.k8s import get_raw_resources, get_pod_names

    ctx = context.current_context
    ns = context.namespace
    raw_tasks = [
        ("pods", lambda: get_raw_resources("pods", ctx, ns)),
        ("nodes", lambda: get_raw_resources("nodes", ctx)),
        ("deployments", lambda: get_raw_resources("deployments", ctx, ns)),
        ("events", lambda: get_raw_resources("events", ctx, ns)),
        ("pod names", get_pod_names),
    ]

    if silent:
        def _warm():
            try:
                with ThreadPoolExecutor(max_workers=5) as executor:
                    futures = [executor.submit(fn) for _, fn in raw_tasks]
                    for future in futures:
                        try:
                            future.result(timeout=10)
                        except Exception:
                            pass
                _warm_derived()
            except Exception:
                pass

        threading.Thread(target=_warm, daemon=True).start()
        return

    from rich.console import Console

    console = Console()
    start = _time.time()
    results = {}
    with ThreadPoolExecutor(max_workers=5) as executor:
        futures = {executor.submit(fn): name for name, fn in raw_tasks}
        for future in as_completed(futures):
            name = futures[future]
            try:
                future.result(timeout=10)
                results[name] = True
            except Exception:
                results[name] = False

    _warm_derived()
    elapsed = _time.time() - start
    ok = sum(1 for value in results.values() if value)
    total = len(results)
    if ok == total:
        console.print(
            f"[dim]✓ Cache warm:[/dim] {ok} resources "
            f"[dim]({elapsed:.1f}s)[/dim]"
        )
    else:
        failed = [name for name, value in results.items() if not value]
        console.print(
            f"[dim]✓ Cache:[/dim] {ok}/{total} "
            f"[dim]({elapsed:.1f}s)[/dim] "
            f"[yellow]failed: {', '.join(failed)}[/yellow]"
        )


def _warm_derived():
    """Warm derived collectors that read from cached raw resources."""
    try:
        from core.collectors.pods import collect_pods
        from core.collectors.nodes import collect_nodes
        from core.collectors.deployments import collect_deployments
        collect_pods()
        collect_nodes()
        collect_deployments()
    except Exception:
        pass


def get_cached(func_name):
    """Return a cached value without triggering a fetch."""
    now = time.time()
    for key, entry in _cache.items():
        if func_name in key and now < entry["expires"] + STALE_GRACE:
            return entry["value"]
    return None
