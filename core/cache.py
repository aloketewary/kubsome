"""
Cache — simple TTL cache for kubectl results
to avoid redundant API server calls.
"""

import time
from functools import wraps


_cache = {}


def cached(ttl=5):
    """
    Decorator that caches function results for ttl seconds.
    Cache key is based on function name + args.
    """
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            key = f"{func.__name__}:{args}:{kwargs}"
            now = time.time()

            if key in _cache:
                value, expires = _cache[key]
                if now < expires:
                    return value

            result = func(*args, **kwargs)
            _cache[key] = (result, now + ttl)
            return result
        return wrapper
    return decorator


def invalidate(prefix=""):
    """Clear cache entries matching prefix."""
    if not prefix:
        _cache.clear()
        return
    keys = [
        k for k in _cache if k.startswith(prefix)
    ]
    for k in keys:
        del _cache[k]


def cache_stats():
    """Return cache statistics."""
    now = time.time()
    valid = sum(
        1 for _, (_, exp) in _cache.items()
        if now < exp
    )
    return {
        "total_entries": len(_cache),
        "valid_entries": valid,
        "expired_entries": len(_cache) - valid,
    }
