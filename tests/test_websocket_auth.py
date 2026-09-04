import asyncio
from unittest.mock import AsyncMock, MagicMock, patch

from api.auth import authenticate_websocket


def websocket(headers=None, query=None):
    socket = MagicMock()
    socket.headers = headers or {}
    socket.query_params = query or {}
    socket.close = AsyncMock()
    return socket


def test_websocket_accepts_cookie_token():
    socket = websocket(headers={"cookie": "kubsome_token=secret"})

    with patch("api.auth.get_token", return_value="secret"):
        result = asyncio.run(authenticate_websocket(socket))

    assert result is True
    socket.close.assert_not_awaited()


def test_websocket_accepts_query_token_for_native_clients():
    socket = websocket(query={"token": "secret"})

    with patch("api.auth.get_token", return_value="secret"):
        result = asyncio.run(authenticate_websocket(socket))

    assert result is True
    socket.close.assert_not_awaited()


def test_websocket_rejects_invalid_token_before_accept():
    socket = websocket(query={"token": "wrong"})

    with patch("api.auth.get_token", return_value="secret"):
        result = asyncio.run(authenticate_websocket(socket))

    assert result is False
    socket.close.assert_awaited_once_with(code=1008, reason="Unauthorized")


def test_websocket_accepts_bearer_subprotocol_token():
    socket = websocket(headers={"sec-websocket-protocol": "bearer.secret"})

    with patch("api.auth.get_token", return_value="secret"):
        result = asyncio.run(authenticate_websocket(socket))

    assert result is True
    socket.close.assert_not_awaited()


def test_websocket_rejects_cross_origin_handshake():
    socket = websocket(headers={
        "origin": "https://attacker.example",
        "host": "kubsome.internal",
    })

    with patch("api.auth.get_token", return_value="secret"):
        result = asyncio.run(authenticate_websocket(socket))

    assert result is False
    socket.close.assert_awaited_once_with(code=1008, reason="Origin not allowed")
