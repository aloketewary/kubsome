import time
import pytest
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient
from api.app import app
from api.auth import get_token
from core.cache import invalidate

_test_token = get_token()
client = TestClient(app, headers={"Authorization": f"Bearer {_test_token}"})

def test_get_node_ops_performance():
    """
    Benchmark to verify that get_node_ops is parallelized and doesn't suffer from N+1 problem.
    """
    invalidate()

    # Mock data for 5 nodes
    nodes_json = {
        "items": [
            {"metadata": {"name": f"node-{i}"}, "status": {"conditions": [{"type": "Ready", "status": "True"}]}, "spec": {"unschedulable": False}}
            for i in range(5)
        ]
    }

    # Mock data for pods (when fetching all)
    pods_json = {
        "items": [
            {"metadata": {"name": f"pod-{i}"}, "spec": {"nodeName": f"node-{i % 5}"}}
            for i in range(10)
        ]
    }

    call_count = 0

    def mocked_run(cmd, **kwargs):
        nonlocal call_count
        call_count += 1
        time.sleep(0.1)  # Artificial delay to measure sequential vs parallel

        cmd_str = " ".join(cmd)
        if "get nodes" in cmd_str:
            import json
            return MagicMock(returncode=0, stdout=json.dumps(nodes_json))
        elif "get pods" in cmd_str:
            import json
            # If it's the old sequential way, it might have field-selector
            if "spec.nodeName=" in cmd_str:
                return MagicMock(returncode=0, stdout="pod-x pod-y")
            else:
                return MagicMock(returncode=0, stdout=json.dumps(pods_json))

        return MagicMock(returncode=0, stdout="{}")

    start_time = time.time()
    with patch("subprocess.run", side_effect=mocked_run):
        response = client.get("/api/node-ops")

    duration = time.time() - start_time
    assert response.status_code == 200

    print(f"\nExecution time: {duration:.4f}s")
    print(f"Total subprocess calls: {call_count}")

    # If it's sequential N+1, it should take at least (1 + 5) * 0.1 = 0.6s
    # If it's parallelized and batched, it should take significantly less (e.g. ~0.2s)
    # Even if parallelized, 2 calls (nodes and all pods) with 0.1s delay each would be ~0.2s

    assert duration < 0.4, f"Execution took too long: {duration:.4f}s. Likely sequential N+1 calls."
    assert call_count <= 3, f"Too many subprocess calls: {call_count}. Should be batched."

if __name__ == "__main__":
    test_get_node_ops_performance()
