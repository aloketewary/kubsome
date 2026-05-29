
import pytest
from unittest.mock import patch, MagicMock
from core.collectors.image_pull import check_image_pull_secrets
from core.context import context
import json

@pytest.fixture
def mock_k8s_data():
    mock_pods = {
        "items": [
            {
                "metadata": {"name": "pod-1", "namespace": "default"},
                "spec": {
                    "serviceAccountName": "sa-1",
                    "containers": [{"image": "nginx:latest"}],
                    "imagePullSecrets": [{"name": "secret-1"}]
                }
            }
        ]
    }
    mock_secrets = {
        "items": [
            {
                "metadata": {"name": "secret-1"},
                "type": "kubernetes.io/dockerconfigjson",
                "data": {".dockerconfigjson": "e30="} # base64 for {}
            }
        ]
    }
    mock_sas = {
        "items": [
            {
                "metadata": {"name": "sa-1"},
                "imagePullSecrets": [{"name": "sa-secret"}]
            }
        ]
    }
    return mock_pods, mock_secrets, mock_sas

def test_check_image_pull_secrets_basic(mock_k8s_data):
    mock_pods, mock_secrets, mock_sas = mock_k8s_data

    context.current_context = "test-ctx"
    context.namespace = "default"

    with patch("core.collectors.image_pull.get_raw_resources") as mock_get:
        def side_effect(kind, ctx, ns=None, *args, **kwargs):
            if kind == "pods":
                return mock_pods
            if kind == "secrets":
                return mock_secrets
            if kind == "serviceaccounts":
                return mock_sas
            return {"items": []}

        mock_get.side_effect = side_effect

        result = check_image_pull_secrets()

        assert result["namespace"] == "default"
        assert result["total_checked"] == 1
        assert len(result["found"]) == 1
        assert result["found"][0]["secret"] == "secret-1"
        assert result["service_account_secrets"]["sa-1"] == ["sa-secret"]

        # Verify get_raw_resources calls
        # 1. secrets, 2. pods, 3. serviceaccounts
        assert mock_get.call_count == 3

def test_check_image_pull_secrets_missing(mock_k8s_data):
    mock_pods, mock_secrets, mock_sas = mock_k8s_data
    # Remove the secret from mock_secrets
    mock_secrets["items"] = []

    context.current_context = "test-ctx"
    context.namespace = "default"

    with patch("core.collectors.image_pull.get_raw_resources") as mock_get:
        def side_effect(kind, ctx, ns=None, *args, **kwargs):
            if kind == "pods":
                return mock_pods
            if kind == "secrets":
                return mock_secrets
            if kind == "serviceaccounts":
                return mock_sas
            return {"items": []}

        mock_get.side_effect = side_effect

        result = check_image_pull_secrets()

        assert len(result["missing"]) == 1
        assert result["missing"][0]["secret"] == "secret-1"
        assert result["missing"][0]["exists"] is False
