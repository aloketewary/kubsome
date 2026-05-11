"""
Tests for NLP engine, AI engine, executor,
uptime, and describe renderer.

Run: pytest tests/test_nlp_ai.py
"""

import sys
import os
from unittest.mock import patch, MagicMock

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))


# ─── NLP Intent Engine ───────────────────────────────

class TestIntentDetection:

    def test_show_pods(self):
        from core.nlp.matcher import detect_intent
        intent, score = detect_intent("show pods")
        assert intent == "show_pods"
        assert score >= 80

    def test_unhealthy_priority(self):
        from core.nlp.matcher import detect_intent
        intent, _ = detect_intent("unhealthy pods")
        assert intent == "unhealthy"

    def test_count_pods(self):
        from core.nlp.matcher import detect_intent
        intent, _ = detect_intent("how many customer pods running")
        assert intent == "count_pods"

    def test_is_safe(self):
        from core.nlp.matcher import detect_intent
        intent, _ = detect_intent("is it safe to restart payment")
        assert intent == "is_safe"

    def test_why_failing(self):
        from core.nlp.matcher import detect_intent
        intent, _ = detect_intent("why is payment-api failing")
        assert intent == "why_failing"

    def test_what_changed(self):
        from core.nlp.matcher import detect_intent
        intent, _ = detect_intent("what changed recently")
        assert intent == "what_changed"

    def test_anomalies(self):
        from core.nlp.matcher import detect_intent
        intent, _ = detect_intent("any anomalies detected")
        assert intent == "anomalies"

    def test_restart(self):
        from core.nlp.matcher import detect_intent
        intent, _ = detect_intent("restart billing")
        assert intent == "restart"
        assert detect_intent("restart billing")[0] == "restart"

    def test_scale(self):
        from core.nlp.matcher import detect_intent
        intent, _ = detect_intent("scale gateway to 5")
        assert intent == "scale"

    def test_unknown_returns_none(self):
        from core.nlp.matcher import detect_intent
        intent, score = detect_intent("xyzzy foobar")
        # Should either be None or very low score
        assert intent is None or score < 55


class TestEntityExtraction:

    def test_extract_target_from_diagnose(self):
        from core.nlp.matcher import extract_entities
        entities = extract_entities(
            "diagnose payment-api", "diagnose"
        )
        assert entities["target"] == "payment-api"

    def test_extract_target_from_restart(self):
        from core.nlp.matcher import extract_entities
        entities = extract_entities(
            "restart billing-worker", "restart"
        )
        assert entities["target"] == "billing-worker"

    def test_extract_scale_with_replicas(self):
        from core.nlp.matcher import extract_entities
        entities = extract_entities(
            "scale gateway to 5", "scale"
        )
        assert entities["target"] == "gateway"
        assert entities["replicas"] == 5

    def test_extract_count_target(self):
        from core.nlp.matcher import extract_entities
        entities = extract_entities(
            "how many customer pods", "count_pods"
        )
        assert entities["target"] == "customer"

    def test_extract_is_safe(self):
        from core.nlp.matcher import extract_entities
        entities = extract_entities(
            "safe to restart payment", "is_safe"
        )
        assert entities["action"] == "restart"
        assert entities["target"] == "payment"


class TestActionMapping:

    def test_pods_table(self):
        from core.nlp.actions import map_to_command
        result = map_to_command({
            "intent": "show_pods",
            "score": 90,
            "entities": {},
            "raw_query": "show pods",
        })
        assert result == {"type": "pods_table"}

    def test_restart_with_target(self):
        from core.nlp.actions import map_to_command
        result = map_to_command({
            "intent": "restart",
            "score": 90,
            "entities": {"target": "billing"},
            "raw_query": "restart billing",
        })
        assert result == "restart billing"

    def test_scale_with_replicas(self):
        from core.nlp.actions import map_to_command
        result = map_to_command({
            "intent": "scale",
            "score": 90,
            "entities": {"target": "gateway", "replicas": 5},
            "raw_query": "scale gateway to 5",
        })
        assert result == "scale gateway 5"

    def test_ai_query_passthrough(self):
        from core.nlp.actions import map_to_command
        result = map_to_command({
            "intent": "why_failing",
            "score": 95,
            "entities": {"target": "payment"},
            "raw_query": "why is payment failing",
        })
        assert result["type"] == "ai"
        assert result["query"] == "why is payment failing"

    def test_no_target_returns_none(self):
        from core.nlp.actions import map_to_command
        result = map_to_command({
            "intent": "restart",
            "score": 90,
            "entities": {},
            "raw_query": "restart",
        })
        assert result is None

    def test_none_input(self):
        from core.nlp.actions import map_to_command
        assert map_to_command(None) is None


class TestParseQuery:

    def test_full_pipeline(self):
        from core.nlp.matcher import parse_query
        result = parse_query("restart billing safely")
        assert result is not None
        assert result["intent"] == "restart"
        assert result["entities"]["target"] == "billing"

    def test_returns_none_for_gibberish(self):
        from core.nlp.matcher import parse_query
        result = parse_query("xyzzy foobar baz")
        assert result is None or result["score"] < 55


# ─── AI Engine ───────────────────────────────────────

class TestAIEngine:

    @patch("core.ai.engine.collect_pods")
    def test_count_pods_with_target(self, mock_pods):
        from core.ai.engine import _count_pods

        mock_pods.return_value = [
            {"name": "customer-api-abc", "status": "Running", "restarts": 0},
            {"name": "customer-worker-xyz", "status": "Running", "restarts": 0},
            {"name": "billing-api-def", "status": "Running", "restarts": 0},
        ]
        result = _count_pods("how many customer pods")
        # Either matches target or shows total
        assert "customer" in result["content"] or "Total pods" in result["content"]

    @patch("core.ai.engine.collect_pods")
    def test_count_pods_no_match(self, mock_pods):
        from core.ai.engine import _count_pods

        mock_pods.return_value = [
            {"name": "billing-api-def", "status": "Running", "restarts": 0},
        ]
        result = _count_pods("how many payment pods")
        # Either shows no match or total count
        assert "payment" in result["content"] or "Total pods" in result["content"]

    @patch("core.ai.engine.collect_pods")
    def test_unhealthy_pods_all_healthy(self, mock_pods):
        from core.ai.engine import _unhealthy_pods

        mock_pods.return_value = [
            {"name": "app-abc", "status": "Running", "restarts": 0},
        ]
        result = _unhealthy_pods()
        assert "healthy" in result["severity"]

    @patch("core.ai.engine.collect_pods")
    def test_unhealthy_pods_finds_issues(self, mock_pods):
        from core.ai.engine import _unhealthy_pods

        mock_pods.return_value = [
            {"name": "app-abc", "status": "CrashLoopBackOff", "restarts": 10},
            {"name": "app-def", "status": "Running", "restarts": 0},
        ]
        result = _unhealthy_pods()
        assert "1 unhealthy" in result["content"]

    @patch("core.ai.engine.collect_pods")
    @patch("core.ai.engine.collect_nodes")
    @patch("core.ai.engine.collect_deployments")
    @patch("core.ai.engine.collect_events")
    def test_summarize_cluster(
        self, mock_events, mock_deps, mock_nodes, mock_pods
    ):
        from core.ai.engine import _summarize_cluster

        mock_pods.return_value = [
            {"name": "a", "status": "Running", "restarts": 0},
            {"name": "b", "status": "Running", "restarts": 0},
        ]
        mock_nodes.return_value = [
            {"name": "n1", "ready": True},
        ]
        mock_deps.return_value = [
            {"name": "d1", "available": 1, "desired": 1},
        ]
        mock_events.return_value = []

        result = _summarize_cluster()
        assert "Cluster Status" in result["content"]
        assert "2/2 running" in result["content"]

    def test_handle_ai_query_diagnose(self):
        from core.ai.engine import handle_ai_query

        with patch("core.ai.engine.resolve_pod_name") as mock_resolve:
            with patch("core.ai.engine.collect_diagnosis") as mock_diag:
                with patch("core.ai.engine.diagnose") as mock_diagnose:
                    mock_resolve.return_value = ["payment-api-abc"]
                    mock_diag.return_value = {"details": {}}
                    mock_diagnose.return_value = []

                    result = handle_ai_query("diagnose payment-api-abc")
                    assert "healthy" in result["content"].lower() or "no critical" in result["content"].lower()


# ─── Executor Fuzzy Resolution ───────────────────────

class TestExecutorFuzzy:

    def test_known_resources(self):
        from core.executor import _KNOWN_RESOURCES
        assert "pod" in _KNOWN_RESOURCES
        assert "deployment" in _KNOWN_RESOURCES
        assert "service" in _KNOWN_RESOURCES
        assert "configmap" in _KNOWN_RESOURCES

    def test_next_non_flag(self):
        from core.executor import _next_non_flag
        tokens = ["kubectl", "--context", "test", "describe", "pod", "name"]
        # --context is a flag, "test" is its value (not a flag), so index 2
        assert _next_non_flag(tokens, 1) == 2
        assert _next_non_flag(tokens, 3) == 3  # "describe"

    def test_next_non_flag_none(self):
        from core.executor import _next_non_flag
        tokens = ["kubectl", "--flag"]
        assert _next_non_flag(tokens, 2) is None

    @patch("core.executor.resolve_pod_name")
    @patch("core.executor.choose_pod")
    def test_fuzzy_resolve_unknown_resource(
        self, mock_choose, mock_resolve
    ):
        from core.executor import _fuzzy_resolve

        mock_resolve.return_value = ["customer-api-abc"]
        mock_choose.return_value = "customer-api-abc"

        result = _fuzzy_resolve(
            "kubectl describe customer"
        )
        assert "pod" in result
        assert "customer-api-abc" in result

    def test_fuzzy_resolve_short_command(self):
        from core.executor import _fuzzy_resolve
        # Should return unchanged for short commands
        assert _fuzzy_resolve("kubectl get") == "kubectl get"

    def test_fuzzy_resolve_non_kubectl(self):
        from core.executor import _fuzzy_resolve
        assert _fuzzy_resolve("ls -la") == "ls -la"


# ─── Uptime Collector ────────────────────────────────

class TestUptime:

    def test_human_duration_seconds(self):
        from core.collectors.uptime import _human_duration
        assert _human_duration(30) == "30s"

    def test_human_duration_minutes(self):
        from core.collectors.uptime import _human_duration
        assert _human_duration(300) == "5m"

    def test_human_duration_hours(self):
        from core.collectors.uptime import _human_duration
        assert _human_duration(7200) == "2h 0m"

    def test_human_duration_days(self):
        from core.collectors.uptime import _human_duration
        result = _human_duration(90000)  # 1d 1h
        assert "1d" in result

    @patch("core.collectors.uptime.subprocess.run")
    @patch("core.collectors.uptime.context")
    def test_check_api_success(self, mock_ctx, mock_run):
        from core.collectors.uptime import _check_api

        mock_ctx.current_context = "test"
        mock_run.return_value = MagicMock(returncode=0)
        assert _check_api("test") is True

    @patch("core.collectors.uptime.subprocess.run")
    @patch("core.collectors.uptime.context")
    def test_check_api_failure(self, mock_ctx, mock_run):
        from core.collectors.uptime import _check_api

        mock_ctx.current_context = "test"
        mock_run.return_value = MagicMock(returncode=1)
        assert _check_api("test") is False


# ─── Describe Renderer ───────────────────────────────

class TestDescribeRenderer:

    def test_parse_sections(self):
        from core.renderers.describe_renderer import (
            _parse_sections
        )
        output = (
            "Name:       payment-api\n"
            "Namespace:  billing\n"
            "Labels:     app=payment\n"
            "            version=v2\n"
        )
        sections = _parse_sections(output)
        assert sections["Name"] == "payment-api"
        assert sections["Namespace"] == "billing"
        assert "app=payment" in sections["Labels"]
        assert "version=v2" in sections["Labels"]

    def test_parse_sections_empty(self):
        from core.renderers.describe_renderer import (
            _parse_sections
        )
        assert _parse_sections("") == {}

    def test_render_describe_no_crash(self):
        from core.renderers.describe_renderer import (
            render_describe
        )
        # Should not raise
        render_describe(
            "Name: test\nNamespace: default",
            "pod"
        )

    def test_render_describe_empty(self):
        from core.renderers.describe_renderer import (
            render_describe
        )
        # Should not raise
        render_describe("", "pod")
        render_describe(None, "pod")


# ─── Playbooks ───────────────────────────────────────

class TestPlaybooks:

    def test_all_playbooks_have_steps(self):
        from core.ai.playbooks import PLAYBOOKS
        for key, pb in PLAYBOOKS.items():
            assert "title" in pb, f"{key} missing title"
            assert "steps" in pb, f"{key} missing steps"
            assert len(pb["steps"]) > 0, f"{key} has no steps"

    def test_get_playbook_exists(self):
        from core.ai.playbooks import get_playbook
        pb = get_playbook("CrashLoopBackOff")
        assert pb is not None
        assert "CrashLoopBackOff" in pb["title"]

    def test_get_playbook_missing(self):
        from core.ai.playbooks import get_playbook
        assert get_playbook("NonExistent") is None

    def test_match_playbook(self):
        from core.ai.playbooks import match_playbook
        findings = [
            {"title": "CrashLoopBackOff detected", "severity": "critical"},
        ]
        matched = match_playbook(findings)
        assert len(matched) >= 1
        assert matched[0]["key"] == "CrashLoopBackOff"

    def test_match_playbook_no_match(self):
        from core.ai.playbooks import match_playbook
        findings = [
            {"title": "Something random", "severity": "info"},
        ]
        matched = match_playbook(findings)
        assert len(matched) == 0

    def test_playbook_count(self):
        from core.ai.playbooks import PLAYBOOKS
        assert len(PLAYBOOKS) == 28
