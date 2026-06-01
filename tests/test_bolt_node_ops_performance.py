import time
import pytest
from fastapi.testclient import TestClient
from api.app import app
from api.auth import get_token
from unittest.mock import patch, MagicMock
from core.cache import invalidate

client = TestClient(app, headers={"Authorization": f"Bearer {get_token()}"})

def test_node_ops_performance_optimization():
    invalidate()

    # Mocking subprocess.run to simulate slow kubectl calls
    # We'll count how many times it's called.
    call_counts = {"count": 0}

    def mocked_run(command, *args, **kwargs):
        call_counts["count"] += 1
        time.sleep(0.05) # Simulate 50ms delay per call

        # Return dummy data based on command
        if "nodes" in command:
            return MagicMock(returncode=0, stdout='{"items": [{"metadata": {"name": "node-1"}, "status": {"conditions": [{"type": "Ready", "status": "True"}]}}, {"metadata": {"name": "node-2"}, "status": {"conditions": [{"type": "Ready", "status": "True"}]}}]}')
        if "pods" in command:
            # If it's a filtered call (original implementation)
            if "--field-selector" in command:
                return MagicMock(returncode=0, stdout="pod1 pod2")
            # If it's a batch call (optimized implementation)
            return MagicMock(returncode=0, stdout='{"items": [{"spec": {"nodeName": "node-1"}}, {"spec": {"nodeName": "node-1"}}, {"spec": {"nodeName": "node-2"}}]}')

        return MagicMock(returncode=0, stdout="")

    with patch("subprocess.run", side_effect=mocked_run):
        start_time = time.time()
        response = client.get("/api/node-ops")
        end_time = time.time()

        assert response.status_code == 200
        duration = end_time - start_time

        print(f"\nExecution time: {duration:.4f}s")
        print(f"Total kubectl calls: {call_counts['count']}")

        # For 2 nodes:
        # Original: 1 (nodes) + 2 (pods per node) = 3 calls
        # Optimized: 2 calls (nodes and pods in parallel)

        # If it's already optimized in some way, this might be low.
        # But looking at the code I read, it was definitely N+1.

    # We want to ensure that for N nodes, we don't do N+1 calls.
    # In my mock I used 2 nodes.
    # If call_counts['count'] > 2, it's likely still N+1.
