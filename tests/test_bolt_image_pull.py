import pytest
from unittest.mock import MagicMock, patch
import json
import time
from core.collectors.image_pull import check_image_pull_secrets

def test_image_pull_secrets_performance():
    # Mock data
    mock_pods = {
        "items": [
            {"metadata": {"name": f"pod-{i}"}, "spec": {"serviceAccountName": f"sa-{i}", "containers": [{"image": "nginx"}]}}
            for i in range(5)
        ]
    }
    mock_secrets = {"items": []}
    mock_sa = {
        "items": [
            {"metadata": {"name": f"sa-{i}"}, "imagePullSecrets": [{"name": f"secret-{i}"}]}
            for i in range(5)
        ]
    }

    call_count = 0

    def mocked_run(cmd, **kwargs):
        nonlocal call_count
        call_count += 1
        # Simulate network latency
        time.sleep(0.1)

        if "pods" in cmd:
            return MagicMock(returncode=0, stdout=json.dumps(mock_pods))
        if "secrets" in cmd:
            return MagicMock(returncode=0, stdout=json.dumps(mock_secrets))
        if "serviceaccounts" in cmd:
            return MagicMock(returncode=0, stdout=json.dumps(mock_sa))
        return MagicMock(returncode=0, stdout="{}")

    # Clear cache before test if possible, but for this test we focus on subprocess calls
    # within a single check_image_pull_secrets execution.

    with patch("subprocess.run", side_effect=mocked_run):
        start_time = time.time()
        check_image_pull_secrets()
        duration = time.time() - start_time

    print(f"\nFinal call count: {call_count}")
    print(f"Final duration: {duration:.2f}s")

    # Optimized: fewer subprocess calls via batching
    assert call_count <= 3
    assert duration < 0.5
