"""
Tests for v1.5 features:
- Cluster Scorecard
- Cost Estimation
- Auto-Remediation
- YAML Diff
- Saved Queries

Run: pytest tests/test_v15.py
"""

import sys
import os
from unittest.mock import patch, MagicMock

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))


class TestScorecard:

    def test_to_grade(self):
        from core.collectors.scorecard import _to_grade
        assert _to_grade(95) == "A"
        assert _to_grade(85) == "B"
        assert _to_grade(75) == "C"
        assert _to_grade(65) == "D"
        assert _to_grade(50) == "F"

    @patch("core.collectors.scorecard.collect_events")
    @patch("core.collectors.scorecard.collect_deployments")
    @patch("core.collectors.scorecard.collect_nodes")
    @patch("core.collectors.scorecard.collect_pods")
    def test_scorecard_healthy(self, mock_pods, mock_nodes, mock_deps, mock_events):
        from core.collectors.scorecard import cluster_scorecard

        mock_pods.return_value = [
            {"name": "a", "status": "Running", "restarts": 0},
            {"name": "b", "status": "Running", "restarts": 0},
        ]
        mock_nodes.return_value = [{"name": "n1", "ready": True}]
        mock_deps.return_value = [{"name": "d1", "available": 1, "desired": 1}]
        mock_events.return_value = []

        result = cluster_scorecard()
        assert result["overall_grade"] in ("A", "B")
        assert result["overall_score"] >= 80

    @patch("core.collectors.scorecard.collect_events")
    @patch("core.collectors.scorecard.collect_deployments")
    @patch("core.collectors.scorecard.collect_nodes")
    @patch("core.collectors.scorecard.collect_pods")
    def test_scorecard_degraded(self, mock_pods, mock_nodes, mock_deps, mock_events):
        from core.collectors.scorecard import cluster_scorecard

        mock_pods.return_value = [
            {"name": "a", "status": "CrashLoopBackOff", "restarts": 20},
            {"name": "b", "status": "Running", "restarts": 0},
        ]
        mock_nodes.return_value = [{"name": "n1", "ready": True}]
        mock_deps.return_value = [{"name": "d1", "available": 0, "desired": 1}]
        mock_events.return_value = [{"type": "Warning", "reason": "BackOff"}] * 20

        result = cluster_scorecard()
        assert result["overall_score"] < 80
        assert len(result["recommendations"]) > 0


class TestCostEstimate:

    def test_parse_cpu(self):
        from core.collectors.cost_estimate import _parse_cpu
        assert _parse_cpu("500m") == 500
        assert _parse_cpu("1") == 1000
        assert _parse_cpu("0.5") == 500
        assert _parse_cpu("0") == 0

    def test_parse_memory(self):
        from core.collectors.cost_estimate import _parse_memory
        assert _parse_memory("256Mi") == 256
        assert _parse_memory("1Gi") == 1024
        assert _parse_memory("512Ki") == 0  # rounds down
        assert _parse_memory("0") == 0

    @patch("core.collectors.cost_estimate.subprocess.run")
    @patch("core.collectors.cost_estimate.context")
    def test_estimate_costs(self, mock_ctx, mock_run):
        from core.collectors.cost_estimate import estimate_costs
        import json

        mock_ctx.current_context = "test"
        mock_ctx.namespace = "default"
        mock_run.return_value = MagicMock(
            returncode=0,
            stdout=json.dumps({"items": [{
                "metadata": {"name": "payment-api"},
                "spec": {
                    "replicas": 2,
                    "template": {"spec": {"containers": [{
                        "name": "app",
                        "resources": {"requests": {"cpu": "500m", "memory": "256Mi"}}
                    }]}}
                }
            }]})
        )

        result = estimate_costs()
        assert len(result["deployments"]) == 1
        assert result["deployments"][0]["name"] == "payment-api"
        assert result["deployments"][0]["cost_total"] > 0
        assert result["total"] > 0


class TestRemediation:

    @patch("core.remediation.context")
    def test_blocks_production(self, mock_ctx):
        from core.remediation import auto_remediate

        mock_ctx.current_context = "my-cluster-prd"
        mock_ctx.namespace = "billing"

        result = auto_remediate("some-pod")
        assert result["blocked"] is True
        assert "production" in result["reason"].lower()

    @patch("core.remediation.collect_diagnosis")
    @patch("core.remediation.context")
    def test_healthy_pod(self, mock_ctx, mock_diag):
        from core.remediation import auto_remediate

        mock_ctx.current_context = "dev-cluster"
        mock_ctx.namespace = "default"
        mock_diag.return_value = {"details": {}}

        with patch("core.remediation.diagnose") as mock_diagnose:
            mock_diagnose.return_value = []
            result = auto_remediate("healthy-pod")

        assert result["result"] == "healthy"

    def test_safe_action_crashloop(self):
        from core.remediation import _safe_action

        with patch("core.remediation._get_deployment_for_pod") as mock_dep:
            mock_dep.return_value = "payment-api"
            action = _safe_action(
                "CrashLoopBackOff detected",
                "payment-api-abc", "ctx", "ns"
            )
            assert action is not None
            assert "restart" in action["command"]

    def test_safe_action_unknown(self):
        from core.remediation import _safe_action
        action = _safe_action(
            "Something random", "pod", "ctx", "ns"
        )
        assert action is None


class TestYamlDiff:

    def test_build_side_by_side_equal(self):
        from core.collectors.yaml_diff import _build_side_by_side
        result = _build_side_by_side(
            ["line1", "line2"],
            ["line1", "line2"]
        )
        assert all(r["type"] == "equal" for r in result)

    def test_build_side_by_side_changed(self):
        from core.collectors.yaml_diff import _build_side_by_side
        result = _build_side_by_side(
            ["image: v1"],
            ["image: v2"]
        )
        assert any(r["type"] == "changed" for r in result)

    def test_build_side_by_side_added(self):
        from core.collectors.yaml_diff import _build_side_by_side
        result = _build_side_by_side(
            ["line1"],
            ["line1", "line2"]
        )
        assert any(r["type"] == "added" for r in result)

    def test_build_side_by_side_removed(self):
        from core.collectors.yaml_diff import _build_side_by_side
        result = _build_side_by_side(
            ["line1", "line2"],
            ["line1"]
        )
        assert any(r["type"] == "removed" for r in result)


class TestSavedQueries:

    def test_save_and_list(self):
        from core.saved_queries import (
            save_query, list_queries, remove_query,
            QUERIES_PATH
        )
        import json

        # Clean state
        if QUERIES_PATH.exists():
            QUERIES_PATH.unlink()

        save_query("test-q", "how many pods", 60)
        queries = list_queries()
        assert len(queries) == 1
        assert queries[0]["name"] == "test-q"
        assert queries[0]["query"] == "how many pods"

        # Cleanup
        remove_query("test-q")
        assert len(list_queries()) == 0

    def test_remove_nonexistent(self):
        from core.saved_queries import remove_query
        assert remove_query("nonexistent-xyz") is False

    def test_update_result(self):
        from core.saved_queries import (
            save_query, get_query, update_result,
            remove_query
        )

        save_query("test-update", "pods", 60)
        update_result("test-update", "3 pods running")

        q = get_query("test-update")
        assert q["last_result"] == "3 pods running"
        assert q["last_run"] is not None

        remove_query("test-update")
