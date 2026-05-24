import time
import unittest
from unittest.mock import patch, MagicMock
from core.collectors.network import netcheck
from core.context import context

class TestNetworkPerformance(unittest.TestCase):
    def setUp(self):
        context.namespace = "test-ns"
        context.current_context = "test-ctx"

    @patch("subprocess.run")
    @patch("core.collectors.network.get_raw_resources")
    def test_netcheck_parallelism(self, mock_get_raw, mock_run):
        def slow_run(*args, **kwargs):
            time.sleep(0.1)
            mock_res = MagicMock()
            mock_res.returncode = 0
            mock_res.stdout = "Server: 127.0.0.1\nAddress: 127.0.0.1#53\n\nName: kubernetes.default\nAddress: 10.96.0.1"
            return mock_res

        def slow_get_raw(*args, **kwargs):
            time.sleep(0.1)
            return {"items": []}

        mock_run.side_effect = slow_run
        mock_get_raw.side_effect = slow_get_raw

        start_time = time.time()
        # With parallelization:
        # _check_dns (2 lookups in parallel) -> ~0.1s
        # _check_service_endpoints (get_raw_resources) -> ~0.1s
        # _get_pod_ip (subprocess.run) -> ~0.1s
        # _check_network_policies (get_raw_resources) -> ~0.1s
        # All these run in parallel in netcheck -> Total should be ~0.1s

        results = netcheck("test-pod")
        duration = time.time() - start_time

        print(f"\nOptimized duration: {duration:.4f}s")
        # Should be much less than 0.5s now.
        # Actually it should be close to 0.1s.
        self.assertLess(duration, 0.25, f"Execution took {duration:.4f}s, suggests sequential or inefficient parallelization")

        # Verify results are present
        self.assertEqual(results["pod"], "test-pod")
        self.assertEqual(len(results["dns"]), 2)
        self.assertTrue(results["dns"][0]["success"])

if __name__ == "__main__":
    unittest.main()
