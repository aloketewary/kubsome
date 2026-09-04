"""
API Auth — session token authentication.
Generates a random token on startup, requires it on all API requests.
Token saved to ~/.kubsome/.api_token (mode 600).
"""

import secrets
import os
import time
from collections import defaultdict
from http.cookies import SimpleCookie
from pathlib import Path
from threading import Lock
from urllib.parse import urlparse

from fastapi import Request, WebSocket
from starlette.middleware.base import BaseHTTPMiddleware

_TOKEN_FILE = Path.home() / ".kubsome" / ".api_token"
_SESSION_TOKEN = None
_WS_HANDSHAKE_LIMIT = 30
_WS_HANDSHAKE_WINDOW = 60
_WS_HANDSHAKES = defaultdict(list)
_WS_HANDSHAKE_LOCK = Lock()

PUBLIC_PATHS = {"/health", "/api/health", "/api/version", "/api/token", "/docs", "/openapi.json"}


def _allow_websocket_handshake(websocket: WebSocket) -> bool:
    """Throttle WebSocket handshakes before authentication and acceptance."""
    client = websocket.client
    client_key = client.host if client else "unknown"
    now = time.time()

    with _WS_HANDSHAKE_LOCK:
        timestamps = _WS_HANDSHAKES[client_key]
        cutoff = now - _WS_HANDSHAKE_WINDOW
        timestamps[:] = [timestamp for timestamp in timestamps if timestamp > cutoff]
        if len(timestamps) >= _WS_HANDSHAKE_LIMIT:
            return False
        timestamps.append(now)
    return True


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


async def authenticate_websocket(websocket: WebSocket) -> bool:
    """Authenticate and origin-check a WebSocket before accepting it."""
    if not _allow_websocket_handshake(websocket):
        await websocket.close(code=1013, reason="Too many connection attempts")
        return False

    origin = websocket.headers.get("origin")
    if origin:
        origin_url = urlparse(origin)
        origin_host = origin_url.hostname or ""
        request_host = websocket.headers.get("host", "").split(":", 1)[0]
        local_origin = origin_host in {"localhost", "127.0.0.1", "::1"}
        same_host = origin_host == request_host
        if not local_origin and not same_host:
            await websocket.close(code=1008, reason="Origin not allowed")
            return False

    auth = websocket.headers.get("authorization", "")
    provided = auth[7:] if auth.startswith("Bearer ") else ""

    if not provided:
        cookies = SimpleCookie()
        cookies.load(websocket.headers.get("cookie", ""))
        token_cookie = cookies.get("kubsome_token")
        provided = token_cookie.value if token_cookie else ""

    # Query-token fallback keeps native clients compatible; browser clients use
    # the HttpOnly cookie set by /api/token to avoid URL credential leakage.
    if not provided:
        provided = websocket.query_params.get("token", "")

    if not provided:
        protocols = websocket.headers.get("sec-websocket-protocol", "")
        for protocol in (item.strip() for item in protocols.split(",")):
            if protocol.startswith("bearer."):
                provided = protocol[7:]
                break

    token = get_token()
    if provided and token and secrets.compare_digest(provided, token):
        return True

    await websocket.close(code=1008, reason="Unauthorized")
    return False


class AuthMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        path = request.url.path
        if path in PUBLIC_PATHS or path.startswith("/app"):
            return await call_next(request)

        token = get_token()
        auth = request.headers.get("Authorization", "")
        provided = auth[7:] if auth.startswith("Bearer ") else None

        if not provided or not secrets.compare_digest(provided, token):
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
