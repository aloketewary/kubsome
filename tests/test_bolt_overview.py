from fastapi.testclient import TestClient
from api.app import app
from unittest.mock import patch, MagicMock
import json
import subprocess
from core.cache import invalidate

client = TestClient(app)

def test_get_overview_for_cluster_mode():
    invalidate()
    with patch("subprocess.run") as mock_run:
        # Mocking 4 calls: pods, nodes, deployments, events
        def side_effect(cmd, *args, **kwargs):
            if "pods" in cmd:
                return MagicMock(returncode=0, stdout=json.dumps({"items": [
                    {"metadata": {"name": "pod-1"}, "status": {"phase": "Running", "containerStatuses": [{"restartCount": 0}]}}
                ]}))
            if "nodes" in cmd:
                return MagicMock(returncode=0, stdout=json.dumps({"items": [
                    {"metadata": {"name": "node-1"}, "status": {"conditions": [{"type": "Ready", "status": "True"}]}}
                ]}))
            if "deployments" in cmd:
                return MagicMock(returncode=0, stdout=json.dumps({"items": [
                    {"metadata": {"name": "dep-1"}, "status": {"availableReplicas": 1, "conditions": [{"type": "Available", "status": "True"}]}, "spec": {"replicas": 1}}
                ]}))
            if "events" in cmd:
                return MagicMock(returncode=0, stdout=json.dumps({"items": [
                    {"type": "Normal", "reason": "Started", "involvedObject": {"name": "pod-1"}, "message": "Started container"}
                ]}))
            return MagicMock(returncode=0, stdout=json.dumps({"items": []}))

        mock_run.side_effect = side_effect

        response = client.get("/api/overview/test-ctx/test-ns")
        assert response.status_code == 200
        data = response.json()
        assert data["context"] == "test-ctx"
        assert data["namespace"] == "test-ns"
        assert data["mode"] == "cluster"
        assert "pods" in data
        assert "nodes" in data
        assert "deployments" in data
        assert "events" in data
        assert data["pods"]["total"] == 1
        assert data["nodes"]["healthy"] == 1
        assert data["deployments"]["healthy"] == 1

def test_get_overview_for_app_mode():
    invalidate()
    with patch("subprocess.run") as mock_run:
        # Mocking calls: pods, nodes, deployments, events
        def side_effect(cmd, *args, **kwargs):
            if "pods" in cmd:
                return MagicMock(returncode=0, stdout=json.dumps({"items": [
                    {"metadata": {"name": "app-pod-1"}, "status": {"phase": "Running", "containerStatuses": [{"restartCount": 0}]}}
                ]}))
            if "deployments" in cmd:
                return MagicMock(returncode=0, stdout=json.dumps({"items": [
                    {
                        "metadata": {"name": "app"},
                        "spec": {"replicas": 2, "template": {"spec": {"containers": [{"image": "nginx"}]}}},
                        "status": {"availableReplicas": 1, "readyReplicas": 1}
                    }
                ]}))
            if "events" in cmd:
                return MagicMock(returncode=0, stdout=json.dumps({"items": [
                    {"type": "Normal", "reason": "Started", "involvedObject": {"kind": "Pod", "name": "app-pod-1"}, "message": "Started"}
                ]}))
            return MagicMock(returncode=0, stdout=json.dumps({"items": []}))

        mock_run.side_effect = side_effect

        response = client.get("/api/overview/app-ctx/app-ns?app=app")
        assert response.status_code == 200
        data = response.json()
        assert data["app"] == "app"
        assert data["mode"] == "app"
        assert "app_info" in data
        assert data["app_info"]["desired"] == 2
        assert data["app_info"]["available"] == 1
        assert len(data["events"]) == 1
