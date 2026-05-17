import time
import unittest
from unittest.mock import patch, MagicMock


class TestOverviewPerformance(unittest.TestCase):
    @patch("core.k8s.get_raw_resources")
    def test_get_overview_for_parallelism(self, mock_get_raw):
        def slow_fetch(*args, **kwargs):
            time.sleep(0.5)
            return {"items": []}

        mock_get_raw.side_effect = slow_fetch

        start_time = time.time()
        from api.routes.overview import get_overview_for
        get_overview_for("test-ctx", "test-ns")
        duration = time.time() - start_time

        # Parallel: ~0.5s (all fetches concurrent). Sequential: ~2.0s
        self.assertLess(duration, 1.5, f"Execution took {duration:.4f}s, suggests sequential")


if __name__ == "__main__":
    unittest.main()
