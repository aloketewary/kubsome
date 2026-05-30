
import pytest
from unittest.mock import MagicMock, patch
from core.collectors.image_pull import check_image_pull_secrets

@patch("core.collectors.image_pull.get_raw_resources")
def test_check_image_pull_secrets_optimization(mock_get_raw):
    # Mock responses for get_raw_resources calls

    # 1. Mock for secrets
    mock_secrets = {
        "items": [
            {"metadata": {"name": "reg-cred"}, "type": "kubernetes.io/dockerconfigjson", "data": {".dockerconfigjson": "eydhdXRocyc6IHsncmVnLmllJzoge2F1dGgnOiAnYWRtaW46cGFzcyd9fX0="}}
        ]
    }

    # 2. Mock for pods
    mock_pods = {
        "items": [
            {
                "metadata": {"name": "pod-1"},
                "spec": {
                    "serviceAccountName": "sa-1",
                    "containers": [{"image": "nginx"}],
                    "imagePullSecrets": [{"name": "reg-cred"}]
                }
            },
            {
                "metadata": {"name": "pod-2"},
                "spec": {
                    "serviceAccountName": "sa-2",
                    "containers": [{"image": "redis"}],
                    "imagePullSecrets": [{"name": "reg-cred"}]
                }
            }
        ]
    }

    # 3. Mock for serviceaccounts (all in namespace)
    mock_sas = {
        "items": [
            {"metadata": {"name": "sa-1"}, "imagePullSecrets": [{"name": "sa-cred-1"}]},
            {"metadata": {"name": "sa-2"}, "imagePullSecrets": [{"name": "sa-cred-2"}]},
            {"metadata": {"name": "other-sa"}, "imagePullSecrets": []}
        ]
    }

    def side_effect(kind, *args, **kwargs):
        if kind == "secrets":
            return mock_secrets
        elif kind == "pods":
            return mock_pods
        elif kind == "serviceaccounts":
            return mock_sas
        return {"items": []}

    mock_get_raw.side_effect = side_effect

    # Execute
    results = check_image_pull_secrets()

    # Verification
    # Should call get_raw_resources exactly 3 times: secrets, pods, serviceaccounts
    assert mock_get_raw.call_count == 3

    # Verify we got the correct SA secrets
    assert "sa-1" in results["service_account_secrets"]
    assert "sa-2" in results["service_account_secrets"]
    assert "sa-cred-1" in results["service_account_secrets"]["sa-1"]
    assert "sa-cred-2" in results["service_account_secrets"]["sa-2"]

    # Verify 'other-sa' is NOT in results because it wasn't used by any pod
    assert "other-sa" not in results["service_account_secrets"]

    print("Optimization verified: O(1) resource fetching for O(N) pods/serviceaccounts.")
