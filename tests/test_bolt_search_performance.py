import time
import unittest
from unittest.mock import patch, MagicMock
from core.context import context

class TestSearchPerformance(unittest.TestCase):
    def setUp(self):
        context.current_context = "test-ctx"
        context.namespace = "test-ns"
        # Clear cache before each test if possible
        from core.cache import _cache
        _cache.clear()

    @patch("subprocess.run")
    def test_search_performance(self, mock_run):
        # Mock subprocess.run to simulate a delay
        def slow_run(*args, **kwargs):
            time.sleep(0.1)
            mock = MagicMock()
            mock.returncode = 0
            mock.stdout = "item1 item2 item3"
            return mock

        mock_run.side_effect = slow_run

        from core.collectors.search import search_resources

        start_time = time.time()
        results = search_resources("item")
        duration = time.time() - start_time

        print(f"\nSearch duration (first run): {duration:.4f}s")

        # Baseline (sequential): 6 calls * 0.1s = 0.6s
        # Target (parallel): 1 call * 0.1s = 0.1s
        self.assertLess(duration, 0.25, f"First run too slow ({duration:.4f}s), expected parallelized speedup")

        # Second run should be even faster due to caching
        start_time = time.time()
        results_2 = search_resources("item")
        duration_2 = time.time() - start_time
        print(f"Search duration (cached run): {duration_2:.4f}s")

        self.assertLess(duration_2, 0.05, f"Cached run too slow ({duration_2:.4f}s), expected cache hit")

    @patch("subprocess.run")
    def test_search_cache_context_aware(self, mock_run):
        # Mock subprocess.run
        mock_run.return_value = MagicMock(returncode=0, stdout="item1")

        from core.collectors.search import search_resources

        # First run in context A
        context.current_context = "ctx-A"
        search_resources("item")
        call_count_A = mock_run.call_count

        # Second run in context A (cached)
        search_resources("item")
        self.assertEqual(mock_run.call_count, call_count_A, "Should have used cache for same context")

        # Third run in context B (should NOT use cache from A)
        context.current_context = "ctx-B"
        search_resources("item")
        self.assertGreater(mock_run.call_count, call_count_A, "Should NOT have used cache for different context")

if __name__ == "__main__":
    unittest.main()
