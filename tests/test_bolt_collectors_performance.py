
import unittest
from unittest.mock import patch, MagicMock
import subprocess
import json
import time

# Clear cache before testing
from core.cache import _cache, _lock
with _lock:
    _cache.clear()

from core.collectors.jobs import list_cronjobs, list_jobs
from core.collectors.services import detect_mesh, list_ingresses, service_dependencies
from core.collectors.pods import collect_pods
from core.context import context

class TestBoltCollectorsPerformance(unittest.TestCase):
    def setUp(self):
        context.namespace = "default"
        context.current_context = "minikube"
        with _lock:
            _cache.clear()

    @patch("subprocess.run")
    def test_cache_sharing_and_efficiency(self, mock_run):
        # Mock responses for different resource types
        def side_effect(command, **kwargs):
            kind = "unknown"
            if "pods" in command: kind = "pods"
            elif "cronjobs" in command: kind = "cronjobs"
            elif "jobs" in command: kind = "jobs"
            elif "ingress" in command: kind = "ingress"
            elif "deployments" in command: kind = "deployments"
            elif "services" in command: kind = "services"

            return MagicMock(
                returncode=0,
                stdout=json.dumps({"items": [{"metadata": {"name": f"test-{kind}"}, "spec": {"replicas": 1, "containers": [{"name": "istio-proxy"}]}, "status": {"phase": "Running"}}]})
            )

        mock_run.side_effect = side_effect

        print("\n--- Performance Verification ---")

        # 1. Call collect_pods (standard collector)
        print("Calling collect_pods()...")
        collect_pods()
        initial_calls = mock_run.call_count
        print(f"Subprocess calls after collect_pods: {initial_calls}")

        # 2. Call detect_mesh (refactored collector)
        # It also requests 'pods' via get_raw_resources
        print("Calling detect_mesh()...")
        detect_mesh()
        print(f"Subprocess calls after detect_mesh: {mock_run.call_count}")

        # Verification: detect_mesh should NOT have triggered a new kubectl call for pods
        self.assertEqual(mock_run.call_count, initial_calls, "detect_mesh should reuse cached pods data")

        # 3. Call list_cronjobs and list_jobs
        print("Calling list_cronjobs() and list_jobs()...")
        list_cronjobs()
        list_jobs()
        calls_after_jobs = mock_run.call_count
        print(f"Subprocess calls after jobs: {calls_after_jobs}")

        # 4. Call them again - should be fully cached
        print("Calling collectors again (within TTL)...")
        list_cronjobs()
        list_jobs()
        detect_mesh()
        self.assertEqual(mock_run.call_count, calls_after_jobs, "Collectors should be fully cached")
        print(f"Subprocess calls after repeat: {mock_run.call_count} (NO NEW CALLS)")

        # 5. Functional Verification
        print("Verifying functional correctness...")
        cj = list_cronjobs()
        self.assertEqual(len(cj), 1)
        self.assertEqual(cj[0]["name"], "test-cronjobs")

        j = list_jobs()
        self.assertEqual(len(j), 1)
        self.assertEqual(j[0]["name"], "test-jobs")

        m = detect_mesh()
        self.assertEqual(m["total_pods"], 1)
        self.assertEqual(m["pods"][0]["name"], "test-pods")

        print("--- Verification Successful ---\n")

if __name__ == "__main__":
    unittest.main()
