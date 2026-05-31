import time
import unittest
import json
from unittest.mock import patch, MagicMock
from core.context import context

# Mocking subprocess before importing anything that might use it
with patch("subprocess.run") as mock_run:
    mock_run.returncode = 0
    mock_run.stdout = '{"items": []}'
    from api.routes.operations import get_node_ops

class TestNodeOpsPerformance(unittest.TestCase):
    def setUp(self):
        context.current_context = "test-ctx"
        context.namespace = "test-ns"

    @patch("subprocess.run")
    def test_get_node_ops_performance(self, mock_run):
        # Configuration for simulated cluster
        NUM_NODES = 20

        # Mock subprocess.run to simulate a delay
        def slow_run(cmd, **kwargs):
            time.sleep(0.05) # 50ms per call
            mock = MagicMock()
            mock.returncode = 0

            # Nodes fetch
            if "get" in cmd and "nodes" in cmd:
                nodes = []
                for i in range(NUM_NODES):
                    nodes.append({
                        "metadata": {"name": f"node-{i}"},
                        "status": {"conditions": [{"type": "Ready", "status": "True"}]},
                        "spec": {"unschedulable": False}
                    })
                mock.stdout = json.dumps({"items": nodes})

            # Pods count for a specific node (the N+1 calls)
            elif "get" in cmd and "pods" in cmd and any("spec.nodeName=" in arg for arg in cmd):
                # The current code uses jsonpath={.items[*].metadata.name} which returns space separated names
                mock.stdout = "pod-a pod-b"

            # Batch pods fetch (for the optimized version)
            # The optimized version uses get_raw_resources("pods", kctx, namespace=None)
            # which results in a command WITHOUT -n test-ns
            elif "get" in cmd and "pods" in cmd and "-n" not in cmd:
                 pods = []
                 for i in range(NUM_NODES):
                     # 2 pods per node
                     pods.append({"spec": {"nodeName": f"node-{i}"}, "metadata": {"name": f"pod-{i}-a"}})
                     pods.append({"spec": {"nodeName": f"node-{i}"}, "metadata": {"name": f"pod-{i}-b"}})
                 mock.stdout = json.dumps({"items": pods})

            else:
                mock.stdout = ""

            return mock

        mock_run.side_effect = slow_run

        start_time = time.time()
        result = get_node_ops()
        duration = time.time() - start_time

        call_count = mock_run.call_count
        print(f"\nNode-ops duration: {duration:.4f}s with {call_count} calls for {NUM_NODES} nodes")

        self.assertEqual(len(result["nodes"]), NUM_NODES)
        for node in result["nodes"]:
            # Baseline should have 2 pods (mocked as "pod-a pod-b")
            self.assertEqual(node["pods_count"], 2, f"Node {node['name']} has unexpected pod count {node['pods_count']}")

if __name__ == "__main__":
    unittest.main()
