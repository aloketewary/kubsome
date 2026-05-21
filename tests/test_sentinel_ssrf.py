import pytest
from unittest.mock import patch, MagicMock
from core.safety import is_safe_url
from core.notify import _send_webhook

def test_is_safe_url_valid():
    # Use real public domain that likely resolves to public IP
    # But for stability in tests, it's better to mock getaddrinfo
    with patch("socket.getaddrinfo") as mock_getaddr:
        mock_getaddr.return_value = [(None, None, None, None, ("93.184.216.34", 443))]
        assert is_safe_url("https://example.com/webhook") is True

def test_is_safe_url_blocked():
    # Loopback
    assert is_safe_url("http://127.0.0.1:8001") is False
    # Mocking hostname resolution to loopback
    with patch("socket.getaddrinfo") as mock_getaddr:
        mock_getaddr.return_value = [(None, None, None, None, ("127.0.0.1", 80))]
        assert is_safe_url("http://localhost:8001") is False

    # Private ranges
    assert is_safe_url("http://10.0.0.1") is False
    assert is_safe_url("http://192.168.1.1") is False
    assert is_safe_url("http://172.16.0.1") is False

    # Metadata service
    assert is_safe_url("http://169.254.169.254/latest/meta-data") is False

    # Invalid schemes
    assert is_safe_url("file:///etc/passwd") is False
    assert is_safe_url("gopher://localhost:70") is False

@patch("urllib.request.urlopen")
def test_send_webhook_blocks_unsafe(mock_urlopen):
    cluster = {"context": "test", "namespace": "default"}
    # Loopback is blocked
    _send_webhook({"url": "http://127.0.0.1:8001/alert"}, "Title", "Msg", "warning", cluster)
    mock_urlopen.assert_not_called()

@patch("urllib.request.urlopen")
def test_send_webhook_allows_safe(mock_urlopen):
    with patch("socket.getaddrinfo") as mock_getaddr:
        mock_getaddr.return_value = [(None, None, None, None, ("93.184.216.34", 443))]

        cluster = {"context": "test", "namespace": "default"}
        _send_webhook({"url": "https://example.com/webhook"}, "Title", "Msg", "warning", cluster)

        mock_urlopen.assert_called_once()
