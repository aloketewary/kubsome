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


_cache = {}
_write_lock = threading.Lock()
_refreshing = set()
_refresh_lock = threading.Lock()

MIN_TTL = 5
MAX_TTL = 60
STALE_GRACE = 30


def _make_key(func, args, kwargs):
    """Fast cache key using hash for large args."""
    base = f"{func.__qualname__}"
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

            # Lock-free read
            entry = _cache.get(key)
            if entry:
                if now < entry["expires"]:
                    return entry["value"]
                # Stale but within grace — return stale, refresh bg
                if now < entry["expires"] + STALE_GRACE:
                    _trigger_bg_refresh(
                        key, func, args, kwargs, ttl, adaptive
                    )
                    return entry["value"]

            # Cache miss — fetch synchronously
            result = func(*args, **kwargs)
            _store(key, result, ttl, adaptive)
            return result

        wrapper._cache_key_fn = lambda *a, **kw: _make_key(func, a, kw)
        wrapper._wrapped_fn = func
        return wrapper
    return decorator


def _trigger_bg_refresh(key, func, args, kwargs, ttl, adaptive):
    """Spawn background thread to refresh a single cache entry."""
    with _refresh_lock:
        if key in _refreshing:
            return
        _refreshing.add(key)

    def _do():
        try:
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
        # Check first, last, and a middle sample
        if old[0] != new[0] or old[-1] != new[-1]:
            return True
        if len(old) > 4:
            mid = len(old) // 2
            return old[mid] != new[mid]
        return False
    if isinstance(old, dict):
        if len(old) != len(new):
            return True
        # Check item count for nested "items" lists
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
        for k in keys:
            del _cache[k]


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
        name = key.split(":")[0] if ":" in key else key
        entries.append({
            "key": name,
            "ttl": round(entry["current_ttl"], 1),
            "expires_in": round(entry["expires"] - now, 1),
            "valid": now < entry["expires"],
        })
    return {
        "total_entries": len(entries),
        "valid_entries": sum(1 for e in entries if e["valid"]),
        "entries": entries[:10],
    }


def prewarm(silent=False):
    """
    Tiered cache prewarm:
      1. Fetch raw resources in parallel (shared base layer)
      2. Derived collectors read from warm cache (instant)

    Total startup time ≈ slowest single kubectl call (~1-2s)
    instead of sum of all calls.
    """
    from concurrent.futures import ThreadPoolExecutor, as_completed
    import time as _time

    from core.context import context
    from core.k8s import get_raw_resources, get_pod_names

    ctx = context.current_context
    ns = context.namespace

    # Tier 1: Raw resources (these are the actual kubectl calls)
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
                with ThreadPoolExecutor(max_workers=5) as ex:
                    futs = [ex.submit(fn) for _, fn in raw_tasks]
                    for f in futs:
                        try:
                            f.result(timeout=10)
                        except Exception:
                            pass
                # Tier 2: derived (reads from cache, instant)
                _warm_derived()
            except Exception:
                pass
        threading.Thread(target=_warm, daemon=True).start()
        return

    # Interactive mode — fast progress display
    from rich.console import Console
    console = Console()
    start = _time.time()

    results = {}

    with ThreadPoolExecutor(max_workers=5) as ex:
        futures = {ex.submit(fn): name for name, fn in raw_tasks}
        for future in as_completed(futures):
            name = futures[future]
            try:
                future.result(timeout=10)
                results[name] = True
            except Exception:
                results[name] = False

    # Tier 2: derived collectors (read from warm cache — instant)
    _warm_derived()

    elapsed = _time.time() - start
    ok = sum(1 for v in results.values() if v)
    total = len(results)

    if ok == total:
        console.print(
            f"[dim]✓ Cache warm:[/dim] {ok} resources "
            f"[dim]({elapsed:.1f}s)[/dim]"
        )
    else:
        failed = [k for k, v in results.items() if not v]
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
    """
    Return cached value by function name if available.
    Does NOT trigger a fetch. Returns None if not cached.
    """
    now = time.time()
    for key, entry in _cache.items():
        if func_name in key:
            if now < entry["expires"] + STALE_GRACE:
                return entry["value"]
    return None
