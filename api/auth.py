"""
API Auth — session token authentication.
Generates a random token on startup, requires it on all API requests.
Token saved to ~/.kubsome/.api_token (mode 600).
"""

import secrets
import os
from pathlib import Path
from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware

_TOKEN_FILE = Path.home() / ".kubsome" / ".api_token"
_SESSION_TOKEN = None

PUBLIC_PATHS = {"/health", "/api/health", "/api/version", "/api/token", "/docs", "/openapi.json"}


def generate_token():
    """Generate or reuse session token. Persists across reloads."""
    global _SESSION_TOKEN
    # Reuse existing token if file exists (survives reload)
    if _TOKEN_FILE.exists():
        existing = _TOKEN_FILE.read_text().strip()
        if existing:
            _SESSION_TOKEN = existing
            return _SESSION_TOKEN
    _SESSION_TOKEN = secrets.token_urlsafe(32)
    _TOKEN_FILE.parent.mkdir(parents=True, exist_ok=True)
    _TOKEN_FILE.write_text(_SESSION_TOKEN)
    os.chmod(_TOKEN_FILE, 0o600)
    return _SESSION_TOKEN


def get_token():
    global _SESSION_TOKEN
    if _SESSION_TOKEN is None:
        if _TOKEN_FILE.exists():
            _SESSION_TOKEN = _TOKEN_FILE.read_text().strip()
        else:
            generate_token()
    return _SESSION_TOKEN


class AuthMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        path = request.url.path
        if path in PUBLIC_PATHS or path.startswith("/app"):
            return await call_next(request)

        token = get_token()
        auth = request.headers.get("Authorization", "")
        provided = auth[7:] if auth.startswith("Bearer ") else request.query_params.get("token", "")

        if not secrets.compare_digest(provided, token):
            from starlette.responses import JSONResponse
            return JSONResponse(
                status_code=401,
                content={"detail": "Unauthorized"},
            )

        try:
            return await call_next(request)
        except Exception:
            from starlette.responses import JSONResponse
            return JSONResponse(
                status_code=500,
                content={"detail": "Internal server error"},
            )
