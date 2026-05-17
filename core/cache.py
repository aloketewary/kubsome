"""
Cache — adaptive TTL cache for kubectl results.

Strategies:
  - Adaptive TTL: increases when data is stable, resets on change
  - Stale-while-revalidate: returns cached data immediately,
    refreshes in background if near expiry
  - Event-driven invalidation: destructive ops clear relevant cache
  - Background refresh: pre-warms critical caches
"""

import time
import threading
from functools import wraps


_cache = {}
_lock = threading.Lock()
_refreshing = set()
_refresh_lock = threading.Lock()

# Adaptive TTL bounds
MIN_TTL = 3
MAX_TTL = 30

# Stale grace period — serve stale data while refreshing
STALE_GRACE = 10


def cached(ttl=5, adaptive=True):
    """
    Decorator that caches function results.

    If adaptive=True, TTL grows when data is unchanged
    (stable cluster = less kubectl calls) and resets
    when data changes (active incident = fresh data).

    Stale-while-revalidate: if cache expired but within
    grace period, returns stale data and refreshes in
    background thread.
    """
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            key = (
                f"{func.__module__}:{func.__name__}"
                f":{args}:{kwargs}"
            )
            now = time.time()

            with _lock:
                if key in _cache:
                    entry = _cache[key]
                    # Still valid — return cached
                    if now < entry["expires"]:
                        return entry["value"]
                    # Expired but within grace — return stale,
                    # trigger background refresh
                    if now < entry["expires"] + STALE_GRACE:
                        _trigger_bg_refresh(
                            key, func, args, kwargs,
                            ttl, adaptive
                        )
                        return entry["value"]

            # Cache miss or beyond grace — fetch fresh
            result = func(*args, **kwargs)
            _store(key, result, ttl, adaptive)
            return result
        return wrapper
    return decorator


def _trigger_bg_refresh(key, func, args, kwargs, ttl, adaptive):
    """Spawn background thread to refresh cache entry."""
    with _refresh_lock:
        if key in _refreshing:
            return
        _refreshing.add(key)

    def _do_refresh():
        try:
            result = func(*args, **kwargs)
            _store(key, result, ttl, adaptive)
        finally:
            with _refresh_lock:
                _refreshing.discard(key)

    t = threading.Thread(target=_do_refresh, daemon=True)
    t.start()


def _store(key, result, ttl, adaptive):
    """Store result in cache with adaptive TTL."""
    now = time.time()
    with _lock:
        if adaptive and key in _cache:
            prev = _cache[key]
            if _data_changed(prev["value"], result):
                new_ttl = MIN_TTL
            else:
                new_ttl = min(
                    prev["current_ttl"] * 1.5, MAX_TTL
                )
        else:
            new_ttl = ttl

        _cache[key] = {
            "value": result,
            "expires": now + new_ttl,
            "current_ttl": new_ttl,
            "fetched_at": now,
        }


def _data_changed(old, new):
    """Quick check if data changed (avoids deep compare for large lists)."""
    if type(old) != type(new):
        return True
    if isinstance(old, list):
        if len(old) != len(new):
            return True
        # Sample check: compare first, last, and count
        if old and new:
            return (
                old[0] != new[0] or
                old[-1] != new[-1]
            )
        return False
    return old != new


def invalidate(prefix=""):
    """Clear cache entries matching prefix."""
    with _lock:
        if not prefix:
            _cache.clear()
            return
        keys = [
            k for k in _cache if prefix in k
        ]
        for k in keys:
            del _cache[k]


def invalidate_pods():
    """Invalidate all pod-related caches."""
    invalidate("get_pods")
    invalidate("get_pod_names")
    invalidate("collect_pods")


def invalidate_deployments():
    """Invalidate deployment-related caches."""
    invalidate("resolve_deployment")
    invalidate("collect_deployments")


def cache_stats():
    """Return cache statistics."""
    now = time.time()
    with _lock:
        entries = []
        for key, entry in _cache.items():
            entries.append({
                "key": key.split(":")[-2],
                "ttl": round(entry["current_ttl"], 1),
                "expires_in": round(
                    entry["expires"] - now, 1
                ),
                "valid": now < entry["expires"],
            })
    return {
        "total_entries": len(entries),
        "valid_entries": sum(
            1 for e in entries if e["valid"]
        ),
        "entries": entries[:10],
    }


def prewarm():
    """Pre-warm critical caches in background thread."""
    def _warm():
        try:
            from core.collectors.pods import collect_pods
            from core.k8s import get_pods, get_pod_names
            collect_pods()
            get_pods()
            get_pod_names()
        except Exception:
            pass

    t = threading.Thread(target=_warm, daemon=True)
    t.start()


def get_cached(func_name):
    """
    Return cached value for a function if available.
    Does NOT trigger a fetch. Returns None if not cached.
    Used for non-blocking reads (e.g., startup banner).
    """
    now = time.time()
    with _lock:
        for key, entry in _cache.items():
            if func_name in key:
                # Return even if slightly stale
                if now < entry["expires"] + STALE_GRACE:
                    return entry["value"]
    return None
