"""
API integration tests — test FastAPI endpoints
using TestClient.

Run: pytest tests/test_api.py
"""

import sys
import os
from unittest.mock import patch, MagicMock

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from fastapi.testclient import TestClient
from api.app import app

client = TestClient(app)


class TestHealthEndpoint:

    def test_health(self):
        response = client.get("/health")
        assert response.status_code == 200
        assert response.json() == {"status": "ok"}


class TestContextsEndpoint:

    @patch("api.routes.contexts.enriched_contexts")
    @patch("api.routes.contexts.context")
    def test_get_contexts(self, mock_ctx, mock_enriched):
        mock_ctx.current_context = "test-ctx"
        mock_ctx.namespace = "default"
        mock_enriched.return_value = [
            {"name": "test-ctx", "environment": "DEV"}
        ]

        response = client.get("/api/contexts")
        assert response.status_code == 200
        data = response.json()
        assert data["current"] == "test-ctx"
        assert len(data["contexts"]) == 1


class TestPodsEndpoint:

    @patch("api.routes.pods.collect_pods")
    @patch("api.routes.pods.context")
    def test_get_pods(self, mock_ctx, mock_pods):
        mock_ctx.current_context = "test"
        mock_ctx.namespace = "default"
        mock_pods.return_value = [
            {"name": "pod-a", "status": "Running", "restarts": 0, "age": "2h"},
        ]

        response = client.get("/api/pods")
        assert response.status_code == 200
        data = response.json()
        assert len(data["pods"]) == 1
        assert data["pods"][0]["name"] == "pod-a"


class TestScorecardEndpoint:

    @patch("core.collectors.scorecard.collect_events")
    @patch("core.collectors.scorecard.collect_deployments")
    @patch("core.collectors.scorecard.collect_nodes")
    @patch("core.collectors.scorecard.collect_pods")
    def test_scorecard(self, mock_pods, mock_nodes, mock_deps, mock_events):
        mock_pods.return_value = [
            {"name": "a", "status": "Running", "restarts": 0},
        ]
        mock_nodes.return_value = [{"name": "n1", "ready": True}]
        mock_deps.return_value = [{"name": "d1", "available": 1, "desired": 1}]
        mock_events.return_value = []

        response = client.get("/api/scorecard")
        assert response.status_code == 200
        data = response.json()
        assert "overall_grade" in data
        assert "categories" in data


class TestCostEstimateEndpoint:

    @patch("core.collectors.cost_estimate.subprocess.run")
    @patch("core.collectors.cost_estimate.context")
    def test_cost_estimate(self, mock_ctx, mock_run):
        import json
        mock_ctx.current_context = "test"
        mock_ctx.namespace = "default"
        mock_run.return_value = MagicMock(
            returncode=0,
            stdout=json.dumps({"items": [{
                "metadata": {"name": "app"},
                "spec": {
                    "replicas": 1,
                    "template": {"spec": {"containers": [{
                        "name": "app",
                        "resources": {"requests": {"cpu": "100m", "memory": "128Mi"}}
                    }]}}
                }
            }]})
        )

        response = client.get("/api/cost-estimate")
        assert response.status_code == 200
        data = response.json()
        assert "total" in data
        assert len(data["deployments"]) == 1


class TestAIEndpoint:

    @patch("core.ai.engine.collect_pods")
    @patch("core.ai.engine.collect_nodes")
    @patch("core.ai.engine.collect_deployments")
    @patch("core.ai.engine.collect_events")
    def test_ai_query(self, mock_events, mock_deps, mock_nodes, mock_pods):
        mock_pods.return_value = []
        mock_nodes.return_value = []
        mock_deps.return_value = []
        mock_events.return_value = []

        response = client.post("/api/ai", json={"query": "summarize cluster health"})
        assert response.status_code == 200
        data = response.json()
        assert "answer" in data

    @patch("core.k8s.subprocess.run")
    @patch("core.k8s.context")
    def test_ai_ambiguity(self, mock_ctx, mock_run):
        import json as jsonlib
        mock_ctx.current_context = "test"
        mock_ctx.namespace = "default"
        mock_run.return_value = MagicMock(
            returncode=0,
            stdout=jsonlib.dumps({"items": [
                {"metadata": {"name": "payment-api-abc", "labels": {}, "creationTimestamp": "2024-01-01T00:00:00Z"}, "status": {"phase": "Running", "containerStatuses": [{"restartCount": 0}]}},
                {"metadata": {"name": "payment-worker-xyz", "labels": {}, "creationTimestamp": "2024-01-01T00:00:00Z"}, "status": {"phase": "Running", "containerStatuses": [{"restartCount": 0}]}},
            ]})
        )

        response = client.post("/api/ai", json={"query": "why is payment failing"})
        assert response.status_code == 200
        data = response.json()
        assert "answer" in data or "options" in data


class TestSavedQueriesEndpoint:

    def test_crud_saved_queries(self):
        # Create
        response = client.post("/api/saved-queries", json={
            "name": "test-pin",
            "query": "how many pods",
            "interval": 60,
        })
        assert response.status_code == 200

        # List
        response = client.get("/api/saved-queries")
        assert response.status_code == 200
        queries = response.json()["queries"]
        assert any(q["name"] == "test-pin" for q in queries)

        # Delete
        response = client.delete("/api/saved-queries/test-pin")
        assert response.status_code == 200

        # Verify deleted
        response = client.get("/api/saved-queries")
        queries = response.json()["queries"]
        assert not any(q["name"] == "test-pin" for q in queries)

    def test_create_without_name(self):
        response = client.post("/api/saved-queries", json={
            "name": "",
            "query": "pods",
        })
        assert response.status_code == 400

    def test_delete_nonexistent(self):
        response = client.delete("/api/saved-queries/nonexistent-xyz")
        assert response.status_code == 404


class TestWatchStatusEndpoint:

    def test_watch_status(self):
        response = client.get("/api/watch-status")
        assert response.status_code == 200
        data = response.json()
        assert "running" in data
        assert "watches" in data


class TestPlaybooksEndpoint:

    def test_list_playbooks(self):
        response = client.get("/api/playbooks")
        assert response.status_code == 200
        data = response.json()
        assert len(data["playbooks"]) >= 28

    def test_get_single_playbook(self):
        response = client.get("/api/playbook/CrashLoopBackOff")
        assert response.status_code == 200
        data = response.json()
        assert "title" in data
        assert "steps" in data
