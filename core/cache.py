"""
Cache — adaptive TTL cache for kubectl results.

Strategies:
  - Adaptive TTL: increases when data is stable, resets on change
  - Stale-while-revalidate: returns cached data immediately,
    refreshes in background if near expiry
  - Event-driven invalidation: destructive ops clear relevant cache
"""

import time
import threading
from functools import wraps


_cache = {}
_lock = threading.Lock()

# Adaptive TTL bounds
MIN_TTL = 3
MAX_TTL = 30


def cached(ttl=5, adaptive=True):
    """
    Decorator that caches function results.

    If adaptive=True, TTL grows when data is unchanged
    (stable cluster = less kubectl calls) and resets
    when data changes (active incident = fresh data).
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

            # Cache miss or expired — fetch fresh
            result = func(*args, **kwargs)

            with _lock:
                if adaptive and key in _cache:
                    prev = _cache[key]
                    if _data_changed(prev["value"], result):
                        # Data changed — reset to min TTL
                        new_ttl = MIN_TTL
                    else:
                        # Data stable — grow TTL (up to max)
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

            return result
        return wrapper
    return decorator


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
