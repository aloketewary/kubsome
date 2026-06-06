import time
import pytest
from unittest.mock import patch, MagicMock
from api.routes.operations import get_node_ops
from core.cache import invalidate

def test_get_node_ops_performance():
    invalidate()
    # Mock subprocess.run in api.routes.operations to add a 0.1s delay for each call
    # We also mock it in core.k8s for when we refactor it
    with patch("subprocess.run") as mock_run:

        def side_effect(cmd, **kwargs):
            time.sleep(0.1)
            mock = MagicMock()
            mock.returncode = 0
            if "get" in cmd and "nodes" in cmd:
                mock.stdout = '{"items": [{"metadata": {"name": "node-1"}, "status": {"conditions": [{"type": "Ready", "status": "True"}]}}, {"metadata": {"name": "node-2"}, "status": {"conditions": [{"type": "Ready", "status": "True"}]}}]}'
            elif "get" in cmd and "pods" in cmd:
                if "--all-namespaces" in cmd:
                    mock.stdout = '{"items": [{"metadata": {"name": "pod-1", "nodeName": "node-1"}}, {"metadata": {"name": "pod-2", "nodeName": "node-2"}}]}'
                else:
                    mock.stdout = "pod-1 pod-2"
            return mock

        mock_run.side_effect = side_effect

        start_time = time.time()
        results = get_node_ops()
        duration = time.time() - start_time

        print(f"\nExecution time: {duration:.4f}s")
        assert len(results["nodes"]) == 2
        # Current implementation: 1 (nodes) + 2 (pods) = 3 calls -> ~0.3s
        # Optimized implementation: 1 (nodes) + 1 (all-pods) = 2 calls in parallel -> ~0.1s
        assert duration < 0.2

if __name__ == "__main__":
    pytest.main([__file__])
