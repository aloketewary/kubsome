import subprocess
from unittest.mock import patch, MagicMock
from core.collectors.idle_resources import (
    cleanup_execute, _detect_unbound_pvcs, _kubectl_names
)

@patch("core.collectors.idle_resources.subprocess.run")
def test_cleanup_execute_security(mock_run):
    mock_run.return_value = MagicMock(returncode=0, stdout="")
    malicious_name = "pod; rm -rf /"
    items = [{"kind": "Pod", "name": malicious_name, "namespace": "default"}]
    cleanup_execute(items, dry_run=True)

    args, kwargs = mock_run.call_args
    cmd = args[0]
    assert isinstance(cmd, list)
    assert malicious_name in cmd
    assert kwargs.get("shell", False) is False

@patch("core.collectors.idle_resources.subprocess.run")
def test_detect_unbound_pvcs_security(mock_run):
    mock_run.return_value = MagicMock(returncode=0, stdout='{"items": []}')
    _detect_unbound_pvcs("ctx; whoami", "ns")

    args, kwargs = mock_run.call_args
    cmd = args[0]
    assert isinstance(cmd, list)
    assert "ctx; whoami" in cmd
    assert kwargs.get("shell", False) is False

@patch("core.collectors.idle_resources.subprocess.run")
def test_kubectl_names_security(mock_run):
    mock_run.return_value = MagicMock(returncode=0, stdout="")
    _kubectl_names("ctx", "ns; ls", "pods")

    args, kwargs = mock_run.call_args
    cmd = args[0]
    assert isinstance(cmd, list)
    assert "ns; ls" in cmd
    assert kwargs.get("shell", False) is False
