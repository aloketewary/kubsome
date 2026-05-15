import time
import unittest
from unittest.mock import patch, MagicMock
import api.routes.overview

class TestOverviewPerformance(unittest.TestCase):
    @patch("core.k8s.get_raw_resources")
    def test_get_overview_for_parallelism(self, mock_get_raw):
        # Setup mock to simulate delay
        def slow_fetch(kind, ctx, ns=None, selector=None):
            time.sleep(0.5)
            return {"items": []}

        mock_get_raw.side_effect = slow_fetch

        start_time = time.time()
        # In get_overview_for, get_raw_resources is imported locally
        from api.routes.overview import get_overview_for
        get_overview_for("test-ctx", "test-ns")
        duration = time.time() - start_time

        print(f"\nDuration with parallel ThreadPoolExecutor: {duration:.4f}s")

        # We expect it to be around 1.0s if parallel (0.5 for pods + 0.5 for parallel nodes/deps/events)
        # and around 2.0s if sequential.
        self.assertLess(duration, 1.5, f"Execution took {duration:.4f}s, which suggests it might be sequential")
        self.assertGreaterEqual(duration, 1.0, "Execution was too fast, something might be wrong with the mock")

if __name__ == "__main__":
    unittest.main()
