import pytest
import time
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient
from api.app import app
from api.auth import get_token
from core.cache import invalidate

_test_token = get_token()
client = TestClient(app, headers={"Authorization": f"Bearer {_test_token}"})

def test_node_ops_performance_optimized():
    """
    Benchmark to verify that the N+1 bottleneck is fixed.
    In a cluster with N nodes, it should now make exactly 2 kubectl calls (one for nodes, one for pods).
    """
    invalidate()

    # Mock data for 5 nodes
    nodes_json = {
        "items": [
            {"metadata": {"name": f"node-{i}"}, "status": {"conditions": [{"type": "Ready", "status": "True"}]}}
            for i in range(5)
        ]
    }

    # Mock data for pods distributed among nodes
    pods_json = {
        "items": [
            {"metadata": {"name": f"pod-{i}"}, "spec": {"nodeName": f"node-{i%5}"}}
            for i in range(10)
        ]
    }

    call_count = 0

    def mocked_run(cmd, **kwargs):
        nonlocal call_count
        call_count += 1
        # Artificial delay to simulate I/O
        time.sleep(0.01)

        mock = MagicMock()
        mock.returncode = 0
        import json
        if "get" in cmd and "nodes" in cmd:
            mock.stdout = json.dumps(nodes_json)
        elif "get" in cmd and "pods" in cmd:
            mock.stdout = json.dumps(pods_json)
        else:
            mock.stdout = ""
        return mock

    with patch("subprocess.run", side_effect=mocked_run):
        start_time = time.time()
        response = client.get("/api/node-ops")
        end_time = time.time()

        assert response.status_code == 200
        data = response.json()
        duration = end_time - start_time

        print(f"\n[Performance] get_node_ops took {duration:.4f}s with {call_count} calls for 5 nodes")

        # Verify correctness
        assert len(data["nodes"]) == 5
        for node in data["nodes"]:
            assert node["pods_count"] == 2

        # Optimized implementation: 1 (nodes) + 1 (all pods) = 2 calls
        assert call_count == 2
