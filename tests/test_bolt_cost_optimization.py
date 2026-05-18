import unittest
from unittest.mock import patch, MagicMock
import json
from core.collectors.cost import find_unused_resources, resource_recommendations
from core.collectors.cost_estimate import estimate_costs
from core.cache import invalidate

class TestBoltCostOptimization(unittest.TestCase):
    def setUp(self):
        invalidate() # Clear cache before each test

    @patch("core.k8s.subprocess.run")
    def test_resource_recommendations_caching(self, mock_run):
        # Mock kubectl output for pods
        mock_run.return_value = MagicMock(
            returncode=0,
            stdout=json.dumps({
                "items": [{"metadata": {"name": "pod-1"}, "spec": {"containers": [{"resources": {}}]}}]
            })
        )

        # Call it once
        resource_recommendations()
        call_count_after_first = mock_run.call_count

        # Call it again - should be cached
        resource_recommendations()
        self.assertEqual(mock_run.call_count, call_count_after_first, "Should use cache for second call")

    @patch("core.k8s.subprocess.run")
    def test_find_unused_resources_efficiency(self, mock_run):
        # Mock outputs for different resources
        def side_effect(cmd, *args, **kwargs):
            if "configmaps" in cmd:
                return MagicMock(returncode=0, stdout=json.dumps({"items": []}))
            if "pods" in cmd:
                return MagicMock(returncode=0, stdout=json.dumps({"items": []}))
            if "pvc" in cmd:
                return MagicMock(returncode=0, stdout=json.dumps({"items": []}))
            return MagicMock(returncode=0, stdout=json.dumps({"items": []}))

        mock_run.side_effect = side_effect

        # find_unused_resources fetches ConfigMaps, Pods (for mounted CMs), and PVCs.
        # Since Pods are fetched twice (once in _get_mounted_configmaps and potentially once in _get_pod_specs if called together),
        # with caching it should only call kubectl once for pods.

        find_unused_resources()

        # We expect calls for: configmaps, pods, pvc.
        # Even if parallelized, the total number of unique kubectl calls should be 3.
        # Without caching, pods might have been called twice if logic overlapped.

        # Check that it called kubectl for the expected types
        calls = [tuple(call.args[0]) for call in mock_run.call_args_list]
        kinds = [c[4] if len(c) > 4 else "" for c in calls]

        self.assertIn("configmaps", kinds)
        self.assertIn("pods", kinds)
        self.assertIn("pvc", kinds)

    @patch("core.k8s.subprocess.run")
    def test_cost_estimate_caching(self, mock_run):
        mock_run.return_value = MagicMock(
            returncode=0,
            stdout=json.dumps({"items": []})
        )

        estimate_costs()
        count1 = mock_run.call_count

        estimate_costs()
        self.assertEqual(mock_run.call_count, count1, "estimate_costs should use cache")

    def test_find_unused_resources_parallelism(self):
        import time
        from core import k8s

        def slow_fetch(*args, **kwargs):
            time.sleep(0.3)
            return {"items": []}

        with patch("core.collectors.cost.get_raw_resources", side_effect=slow_fetch):
            start = time.time()
            find_unused_resources()
            duration = time.time() - start

            # 3 fetches in parallel (ConfigMaps, Pods, PVCs)
            # Should be ~0.3s. Sequential would be ~0.9s.
            self.assertLess(duration, 0.6, f"find_unused_resources took {duration:.2f}s, should be parallel")

if __name__ == "__main__":
    unittest.main()
