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

@patch("core.collectors.idle_resources.subprocess.run")
def test_cleanup_execute_security(mock_run):
    """Verify that cleanup_execute in idle_resources handles malicious names safely."""
    from core.collectors.idle_resources import cleanup_execute
    mock_run.return_value = MagicMock(returncode=0, stdout="deleted")

    malicious_name = "myapp; rm -rf /"
    items = [{"kind": "Deployment", "name": malicious_name, "namespace": "default"}]
    cleanup_execute(items, dry_run=False)

    args, kwargs = mock_run.call_args
    cmd = args[0]

    assert isinstance(cmd, list)
    assert malicious_name in cmd
    assert kwargs.get("shell", False) is False

@patch("core.analytics.safe_apply.subprocess.run")
def test_dry_run_security(mock_run):
    """Verify that dry_run in safe_apply handles malicious deployment names safely."""
    from core.analytics.safe_apply import dry_run
    mock_run.return_value = MagicMock(returncode=0, stdout="applied")

    malicious_deploy = "web; touch /tmp/pwned"
    recs = [{
        "deployment": malicious_deploy,
        "namespace": "default",
        "risk": "low",
        "confidence": 100,
        "recommended": {
            "cpu_request": 100, "mem_request": 128,
            "cpu_limit": 200, "mem_limit": 256
        }
    }]
    dry_run(recs)

    # In dry_run, malicious_deploy is used in _build_patch_yaml which is written to a temp file.
    # The subprocess call is 'kubectl apply --dry-run=server -f <tmp>'.
    # So we check that the call was made as a list and shell=False.
    args, kwargs = mock_run.call_args
    cmd = args[0]
    assert isinstance(cmd, list)
    assert "apply" in cmd
    assert kwargs.get("shell", False) is False

@patch("core.k8s.subprocess.run")
def test_get_raw_resources_no_context(mock_run):
    """Verify that get_raw_resources does not include --context if context_name is None."""
    from core.k8s import get_raw_resources
    mock_run.return_value = MagicMock(returncode=0, stdout='{"items": []}')

    get_raw_resources("pods", None)

    args, kwargs = mock_run.call_args
    cmd = args[0]
    assert "--context" not in cmd

@patch("core.analytics.safe_apply.subprocess.run")
def test_diff_security(mock_run):
    """Verify that diff in safe_apply handles malicious deployment names safely."""
    from core.analytics.safe_apply import diff
    mock_run.return_value = MagicMock(returncode=0, stdout="{}")

    malicious_deploy = "web; touch /tmp/pwned"
    recs = [{
        "deployment": malicious_deploy,
        "namespace": "default",
        "risk": "low",
        "confidence": 100,
        "recommended": {
            "cpu_request": 100, "mem_request": 128,
            "cpu_limit": 200, "mem_limit": 256
        }
    }]
    diff(recs)

    args, kwargs = mock_run.call_args
    cmd = args[0]
    assert isinstance(cmd, list)
    assert malicious_deploy in cmd
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
