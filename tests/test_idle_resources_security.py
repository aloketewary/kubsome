import subprocess
import json
from unittest.mock import patch, MagicMock
from core.collectors.idle_resources import (
    cleanup_execute, _kubectl_names, _detect_unbound_pvcs
)

@patch("core.collectors.idle_resources.subprocess.run")
def test_cleanup_execute_security(mock_run):
    """Verify cleanup_execute handles malicious resource names safely."""
    mock_run.return_value = MagicMock(returncode=0, stdout="deleted", stderr="")

    items = [
        {"kind": "Pod", "name": "victim; rm -rf /", "namespace": "default"}
    ]

    # We need to mock context since it's used in cleanup_execute
    with patch("core.collectors.idle_resources.context") as mock_ctx:
        mock_ctx.current_context = "my-ctx"
        mock_ctx.namespace = "default"
        cleanup_execute(items)

    # Check that the command was passed as a list and the malicious name is a single argument
    args, kwargs = mock_run.call_args
    cmd = args[0]

    assert isinstance(cmd, list)
    assert "victim; rm -rf /" in cmd
    # Ensure shell=True is NOT present
    assert kwargs.get("shell", False) is False

@patch("core.collectors.idle_resources.subprocess.run")
def test_kubectl_names_security(mock_run):
    """Verify _kubectl_names handles malicious resource types safely."""
    mock_run.return_value = MagicMock(returncode=0, stdout="name1 name2")

    malicious_resource = "pods; whoami"
    _kubectl_names("ctx", "ns", malicious_resource)

    args, kwargs = mock_run.call_args
    cmd = args[0]

    assert isinstance(cmd, list)
    assert malicious_resource in cmd
    assert kwargs.get("shell", False) is False

@patch("core.collectors.idle_resources.subprocess.run")
def test_detect_unbound_pvcs_security(mock_run):
    """Verify _detect_unbound_pvcs handles malicious namespace safely."""
    mock_run.return_value = MagicMock(returncode=0, stdout='{"items": []}')

    malicious_ns = "default; ls"
    _detect_unbound_pvcs("ctx", malicious_ns)

    args, kwargs = mock_run.call_args
    cmd = args[0]

    assert isinstance(cmd, list)
    assert malicious_ns in cmd
    assert kwargs.get("shell", False) is False
