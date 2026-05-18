from fastapi.testclient import TestClient
from api.app import app
from api.auth import get_token
from unittest.mock import patch, MagicMock
import json
from core.cache import invalidate

_test_token = get_token()
client = TestClient(app, headers={"Authorization": f"Bearer {_test_token}"})


def test_get_overview_for_cluster_mode():
    invalidate()
    with patch("core.k8s.get_raw_resources") as mock_get:
        def side_effect(kind, ctx, ns=None, selector=None, **kwargs):
            if kind == "pods":
                return {"items": [
                    {"metadata": {"name": "pod-1"}, "status": {"phase": "Running", "containerStatuses": [{"restartCount": 0}]}}
                ]}
            if kind == "nodes":
                return {"items": [
                    {"metadata": {"name": "node-1"}, "status": {"conditions": [{"type": "Ready", "status": "True"}]}}
                ]}
            if kind == "deployments":
                return {"items": [
                    {"metadata": {"name": "dep-1"}, "status": {"availableReplicas": 1}, "spec": {"replicas": 1}}
                ]}
            if kind == "events":
                return {"items": [
                    {"type": "Normal", "reason": "Started", "involvedObject": {"name": "pod-1"}, "message": "Started container"}
                ]}
            return {"items": []}

        mock_get.side_effect = side_effect

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
    with patch("core.k8s.get_raw_resources") as mock_get:
        def side_effect(kind, ctx, ns=None, selector=None, **kwargs):
            if kind == "pods":
                return {"items": [
                    {"metadata": {"name": "app-pod-1"}, "status": {"phase": "Running", "containerStatuses": [{"restartCount": 0}]}}
                ]}
            if kind == "nodes":
                return {"items": [
                    {"metadata": {"name": "node-1"}, "status": {"conditions": [{"type": "Ready", "status": "True"}]}}
                ]}
            if kind == "deployments":
                return {"items": [{
                    "metadata": {"name": "app"},
                    "spec": {"replicas": 2, "template": {"spec": {"containers": [{"image": "nginx"}]}}},
                    "status": {"availableReplicas": 1, "readyReplicas": 1}
                }]}
            if kind == "events":
                return {"items": [
                    {"type": "Normal", "reason": "Started", "involvedObject": {"kind": "Pod", "name": "app-pod-1"}, "message": "Started"}
                ]}
            return {"items": []}

        mock_get.side_effect = side_effect

        response = client.get("/api/overview/app-ctx/app-ns?app=app")
        assert response.status_code == 200
        data = response.json()
        assert data["app"] == "app"
        assert data["mode"] == "app"
        assert "app_info" in data
        assert data["app_info"]["desired"] == 2
        assert data["app_info"]["available"] == 1
        assert len(data["events"]) == 1
