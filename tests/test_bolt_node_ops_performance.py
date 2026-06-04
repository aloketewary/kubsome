import time
import pytest
from unittest.mock import patch, MagicMock
from api.routes.operations import get_node_ops
from core.cache import invalidate

def test_node_ops_performance_optimized():
    """
    Benchmark to verify the optimized O(1) complexity in get_node_ops.
    Each kubectl call is mocked with a 0.1s delay.
    """
    invalidate() # Ensure cache is clear

    # Mocking 3 nodes
    mock_nodes = {
        "items": [
            {"metadata": {"name": "node-1"}, "status": {"conditions": [{"type": "Ready", "status": "True"}]}, "spec": {"unschedulable": False}},
            {"metadata": {"name": "node-2"}, "status": {"conditions": [{"type": "Ready", "status": "True"}]}, "spec": {"unschedulable": False}},
            {"metadata": {"name": "node-3"}, "status": {"conditions": [{"type": "Ready", "status": "True"}]}, "spec": {"unschedulable": False}},
        ]
    }

    mock_pods = {
        "items": [
            {"metadata": {"name": "pod-1"}, "spec": {"nodeName": "node-1"}},
            {"metadata": {"name": "pod-2"}, "spec": {"nodeName": "node-1"}},
            {"metadata": {"name": "pod-3"}, "spec": {"nodeName": "node-2"}},
        ]
    }

    import json

    def side_effect(cmd, **kwargs):
        time.sleep(0.1) # Simulate network/IO latency
        if "get" in cmd and "nodes" in cmd:
            return MagicMock(returncode=0, stdout=json.dumps(mock_nodes))
        if "get" in cmd and "pods" in cmd:
            return MagicMock(returncode=0, stdout=json.dumps(mock_pods))
        return MagicMock(returncode=0, stdout="")

    with patch("subprocess.run", side_effect=side_effect) as mock_run:
        start_time = time.time()
        result = get_node_ops()
        duration = time.time() - start_time

        # Optimized implementation: 1 (nodes) and 1 (all pods) in parallel
        # 1 parallel execution * 0.1s = ~0.1s
        print(f"\nExecution time with {len(mock_nodes['items'])} nodes (optimized): {duration:.4f}s")

        # Verify results
        nodes = result["nodes"]
        assert len(nodes) == 3
        assert next(n for n in nodes if n["name"] == "node-1")["pods_count"] == 2
        assert next(n for n in nodes if n["name"] == "node-2")["pods_count"] == 1
        assert next(n for n in nodes if n["name"] == "node-3")["pods_count"] == 0

        # Complexity check: should be exactly 2 kubectl calls (nodes and pods)
        assert mock_run.call_count == 2

        # Latency check: should be significantly less than the sequential 0.4s
        assert duration < 0.25
