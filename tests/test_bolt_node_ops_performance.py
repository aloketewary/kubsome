import time
import unittest
from unittest.mock import patch, MagicMock
from api.routes.operations import get_node_ops
from core.cache import invalidate

class TestNodeOpsPerformance(unittest.TestCase):
    @patch("subprocess.run")
    def test_get_node_ops_efficiency(self, mock_run):
        invalidate()
        # Mocking 3 nodes
        nodes_json = {
            "items": [
                {"metadata": {"name": "node-1"}, "status": {"conditions": [{"type": "Ready", "status": "True"}]}},
                {"metadata": {"name": "node-2"}, "status": {"conditions": [{"type": "Ready", "status": "True"}]}},
                {"metadata": {"name": "node-3"}, "status": {"conditions": [{"type": "Ready", "status": "True"}]}}
            ]
        }

        # Mocking pods in all namespaces
        pods_json = {
            "items": [
                {"spec": {"nodeName": "node-1"}},
                {"spec": {"nodeName": "node-1"}},
                {"spec": {"nodeName": "node-2"}}
            ]
        }

        def side_effect(cmd, **kwargs):
            time.sleep(0.1) # 100ms delay per call
            mock = MagicMock()
            mock.returncode = 0
            import json
            if "nodes" in cmd:
                mock.stdout = json.dumps(nodes_json)
            elif "pods" in cmd:
                mock.stdout = json.dumps(pods_json)
            else:
                mock.stdout = "{}"
            return mock

        mock_run.side_effect = side_effect

        start_time = time.time()
        result = get_node_ops()
        duration = time.time() - start_time

        # Optimized implementation: 1 call for nodes + 1 call for all pods = 2 calls (parallelized)
        # However, ThreadPoolExecutor will still result in 2 subprocess calls recorded.
        # Since they are parallelized, duration should be ~0.1s + overhead, significantly less than 0.4s.

        call_count = mock_run.call_count
        print(f"\nOptimized call count: {call_count}")
        print(f"Optimized duration: {duration:.4f}s")

        self.assertEqual(call_count, 2)
        # Duration should be closer to 0.1s than 0.4s. Allowing some buffer.
        self.assertLess(duration, 0.25)

        # Verify results
        nodes = result["nodes"]
        self.assertEqual(len(nodes), 3)
        self.assertEqual(nodes[0]["pods_count"], 2) # node-1
        self.assertEqual(nodes[1]["pods_count"], 1) # node-2
        self.assertEqual(nodes[2]["pods_count"], 0) # node-3

if __name__ == "__main__":
    unittest.main()
