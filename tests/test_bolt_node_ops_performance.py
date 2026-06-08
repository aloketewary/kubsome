import pytest
from unittest.mock import MagicMock, patch
from api.routes.operations import get_node_ops
import json

def test_get_node_ops_performance_constant_calls():
    """
    Verify that get_node_ops performs a constant number of external calls
    regardless of the number of nodes.
    """
    # Mock node data with 3 nodes
    mock_nodes = {
        "items": [
            {"metadata": {"name": f"node-{i}"}, "status": {"conditions": [{"type": "Ready", "status": "True"}]}, "spec": {}}
            for i in range(3)
        ]
    }

    # Mock pod data (5 pods distributed across nodes)
    mock_pods = {
        "items": [
            {"metadata": {"name": f"pod-{i}"}, "spec": {"nodeName": f"node-{i % 3}"}}
            for i in range(5)
        ]
    }

    # Track how many times get_raw_resources is called
    with patch("core.k8s.get_raw_resources") as mock_get:
        mock_get.side_effect = [mock_nodes, mock_pods]

        result = get_node_ops()

        # Verify the results are correct
        assert len(result["nodes"]) == 3
        # node-0 should have pod-0, pod-3
        assert result["nodes"][0]["pods_count"] == 2
        # node-1 should have pod-1, pod-4
        assert result["nodes"][1]["pods_count"] == 2
        # node-2 should have pod-2
        assert result["nodes"][2]["pods_count"] == 1

        # KEY PERFORMANCE ASSERTION:
        # Only 2 calls to get_raw_resources (one for nodes, one for pods)
        # Even if we had 100 nodes, it should still be 2 calls.
        assert mock_get.call_count == 2

        # Verify call arguments
        # Since it is called from inside get_node_ops via from core.k8s import get_raw_resources
        # We need to make sure we are patching it where it is imported or used.
        # Inside get_node_ops, it does local import.

def test_get_node_ops_many_nodes():
    """Verify it scales to many nodes with same number of calls."""
    node_count = 50
    mock_nodes = {
        "items": [
            {"metadata": {"name": f"node-{i}"}, "status": {"conditions": [{"type": "Ready", "status": "True"}]}, "spec": {}}
            for i in range(node_count)
        ]
    }
    mock_pods = {"items": []}

    with patch("core.k8s.get_raw_resources") as mock_get:
        mock_get.side_effect = [mock_nodes, mock_pods]

        get_node_ops()

        # Still exactly 2 calls despite 50 nodes
        assert mock_get.call_count == 2
