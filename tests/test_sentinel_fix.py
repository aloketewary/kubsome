import subprocess
from unittest.mock import patch, MagicMock
from core.collectors.logs import fetch_logs, fetch_containers, stream_logs

@patch("core.collectors.logs.subprocess.run")
def test_fetch_logs_security(mock_run):
    """Verify that fetch_logs handles malicious pod names safely."""
    mock_run.return_value = MagicMock(returncode=0, stdout="log line")

    malicious_pod = "pod-name; rm -rf /"
    fetch_logs(malicious_pod)

    # Check that the command was passed as a list and the malicious pod name is a single argument
    args, kwargs = mock_run.call_args
    cmd = args[0]

    assert isinstance(cmd, list)
    assert malicious_pod in cmd
    # Ensure shell=True is NOT present (defaulting to False or explicitly False)
    assert kwargs.get("shell", False) is False

@patch("core.collectors.logs.subprocess.run")
def test_fetch_containers_security(mock_run):
    """Verify that fetch_containers handles malicious pod names safely."""
    mock_run.return_value = MagicMock(returncode=0, stdout="container1")

    malicious_pod = "pod-name; ls -la"
    fetch_containers(malicious_pod)

    args, kwargs = mock_run.call_args
    cmd = args[0]

    assert isinstance(cmd, list)
    assert malicious_pod in cmd
    assert kwargs.get("shell", False) is False

@patch("core.collectors.logs.subprocess.Popen")
def test_stream_logs_security(mock_popen):
    """Verify that stream_logs handles malicious pod names safely."""
    mock_popen.return_value = MagicMock()

    malicious_pod = "pod-name & whoami"
    stream_logs(malicious_pod)

    args, kwargs = mock_popen.call_args
    cmd = args[0]

    assert isinstance(cmd, list)
    assert malicious_pod in cmd
    assert kwargs.get("shell", False) is False
