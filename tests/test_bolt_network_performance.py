import time
import unittest
from unittest.mock import patch, MagicMock
from core.context import context

class TestNetworkPerformance(unittest.TestCase):
    def setUp(self):
        context.current_context = "test-ctx"
        context.namespace = "test-ns"

    @patch("subprocess.run")
    def test_netcheck_performance(self, mock_run):
        # Mock subprocess.run to simulate a delay
        def slow_run(*args, **kwargs):
            time.sleep(0.1)
            # Return empty but valid responses for different commands
            mock = MagicMock()
            mock.returncode = 0
            if "get" in args[0] and "endpoints" in args[0]:
                mock.stdout = '{"items": []}'
            elif "get" in args[0] and "pod" in args[0]:
                 mock.stdout = "10.0.0.1 192.168.0.1"
            elif "get" in args[0] and "networkpolicies" in args[0]:
                mock.stdout = ""
            else:
                mock.stdout = "Address 1: 10.96.0.10"
            return mock

        mock_run.side_effect = slow_run

        from core.collectors.network import netcheck

        start_time = time.time()
        results = netcheck("test-pod")
        duration = time.time() - start_time

        print(f"\nNetcheck duration: {duration:.4f}s")

        # Currently sequential:
        # _check_dns: 2 lookups * 0.1s = 0.2s
        # _check_service_endpoints: 1 call * 0.1s = 0.1s
        # _get_pod_ip: 1 call * 0.1s = 0.1s
        # _check_network_policies: 1 call * 0.1s = 0.1s
        # Total expected: ~0.5s

        # Bolt: After optimization, execution should be close to 0.1s (latency of slowest single call)
        # instead of 0.5s (sum of sequential calls).
        self.assertLess(duration, 0.25, f"Execution too slow ({duration:.4f}s), expected parallelized speedup")

if __name__ == "__main__":
    unittest.main()
