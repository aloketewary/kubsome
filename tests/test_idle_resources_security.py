import subprocess
from unittest.mock import patch, MagicMock
from core.collectors.idle_resources import cleanup_execute, _kubectl_names

@patch("core.collectors.idle_resources.subprocess.run")
def test_cleanup_execute_security(mock_run):
    """Verify that cleanup_execute handles malicious resource names safely."""
    mock_run.return_value = MagicMock(returncode=0, stdout="deleted", stderr="")

    malicious_item = {
        "kind": "Pod",
        "name": "malicious-pod; rm -rf /",
        "namespace": "default"
    }

    cleanup_execute([malicious_item], dry_run=False)

    # Check that the command was passed as a list and the malicious name is a single argument
    args, kwargs = mock_run.call_args
    cmd = args[0]

    assert isinstance(cmd, list)
    assert "malicious-pod; rm -rf /" in cmd
    assert "kubectl" in cmd
    assert "delete" in cmd
    # Ensure shell=True is NOT present (defaulting to False or explicitly False)
    assert kwargs.get("shell", False) is False

@patch("core.collectors.idle_resources.get_raw_resources")
def test_detectors_use_get_raw_resources(mock_get_raw):
    """Verify that detectors use the safe get_raw_resources helper."""
    mock_get_raw.return_value = {"items": []}

    _kubectl_names("my-ctx", "my-ns", "deployments")

    mock_get_raw.assert_called_once_with("deployments", "my-ctx", "my-ns")
