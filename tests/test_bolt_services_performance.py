import unittest
from unittest.mock import patch, MagicMock
import json
from core.collectors.services import detect_mesh, list_ingresses, service_dependencies
from core.cache import invalidate

class TestBoltServicesPerformance(unittest.TestCase):
    def setUp(self):
        invalidate() # Clear cache before each test

    @patch("core.k8s.subprocess.run")
    def test_detect_mesh_is_cached(self, mock_run):
        mock_run.return_value = MagicMock(
            returncode=0,
            stdout=json.dumps({"items": []})
        )

        # Call it twice
        detect_mesh()
        detect_mesh()

        # With caching, it should be 1 call
        self.assertEqual(mock_run.call_count, 1, "Should use cache for second call")

    @patch("core.k8s.subprocess.run")
    def test_list_ingresses_is_cached(self, mock_run):
        mock_run.return_value = MagicMock(
            returncode=0,
            stdout=json.dumps({"items": []})
        )

        list_ingresses()
        list_ingresses()

        self.assertEqual(mock_run.call_count, 1, "Should use cache for second call")

    @patch("core.k8s.subprocess.run")
    def test_service_dependencies_efficiency(self, mock_run):
        mock_run.return_value = MagicMock(
            returncode=0,
            stdout=json.dumps({
                "items": [{"metadata": {"name": "test-dep"}, "spec": {"template": {"spec": {"containers": []}}, "selector": {"matchLabels": {}}}}]
            })
        )

        # service_dependencies calls get_raw_resources for deployments AND then for services
        service_dependencies("test-dep")

        # unique kinds fetched: deployments, services
        self.assertEqual(mock_run.call_count, 2)

        # calling it again should be fully cached
        service_dependencies("test-dep")
        self.assertEqual(mock_run.call_count, 2, "Second call should be fully cached")

if __name__ == "__main__":
    unittest.main()
