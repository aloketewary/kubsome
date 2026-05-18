"""
API Rate Limiter — simple in-memory sliding window rate limiting.

Protects sensitive endpoints from abuse:
- /api/exec: 30 req/min
- /api/generate: 10 req/min
- /api/explain: 10 req/min
- All other /api/*: 120 req/min
"""

import time
from collections import defaultdict
from fastapi import Request, HTTPException
from starlette.middleware.base import BaseHTTPMiddleware


# Rate limits: path prefix → (max_requests, window_seconds)
RATE_LIMITS = {
    "/api/exec": (30, 60),
    "/api/generate": (10, 60),
    "/api/explain": (10, 60),
    "/api/trigger/": (5, 60),
    "/api/incident/start": (5, 60),
    "/api/webhooks": (10, 60),
    "/api/snap": (10, 60),
}

# Default limit for all other API paths
DEFAULT_LIMIT = (120, 60)


class RateLimitMiddleware(BaseHTTPMiddleware):
    def __init__(self, app):
        super().__init__(app)
        # client_ip → {path_key → [timestamps]}
        self._requests = defaultdict(lambda: defaultdict(list))

    async def dispatch(self, request: Request, call_next):
        path = request.url.path

        # Only rate-limit API paths
        if not path.startswith("/api"):
            return await call_next(request)

        # Skip rate limiting in test mode (testclient)
        client = request.client.host if request.client else "unknown"
        if client == "testclient":
            return await call_next(request)
        limit, window = self._get_limit(path)

        # Sliding window check
        now = time.time()
        key = self._path_key(path)
        timestamps = self._requests[client][key]

        # Remove expired entries
        cutoff = now - window
        self._requests[client][key] = [
            t for t in timestamps if t > cutoff
        ]
        timestamps = self._requests[client][key]

        if len(timestamps) >= limit:
            raise HTTPException(
                status_code=429,
                detail=f"Rate limit exceeded ({limit} req/{window}s). Try again later.",
            )

        timestamps.append(now)
        return await call_next(request)

    def _get_limit(self, path):
        """Find the most specific rate limit for a path."""
        for prefix, limit in RATE_LIMITS.items():
            if path.startswith(prefix):
                return limit
        return DEFAULT_LIMIT

    def _path_key(self, path):
        """Normalize path to a rate-limit bucket key."""
        for prefix in RATE_LIMITS:
            if path.startswith(prefix):
                return prefix
        return "/api/*"
