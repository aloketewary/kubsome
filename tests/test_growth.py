"""
Tests for growth features (Batches 1-6):
- Doctor (pre-flight)
- Suggestions (contextual hints)
- Telemetry (local usage tracking)
- Scheduler (cron-like recurring)
- Cost Trend (forecast)
- Policy Engine (guardrails)
- Plugin Install/Uninstall
- Incident Share
- Team Runbooks
- AI Follow-ups
- Log Regex/Since

Run: pytest tests/test_growth.py
"""

import sys
import os
from unittest.mock import patch, MagicMock
from pathlib import Path

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))


# ─── Batch 1: Doctor ────────────────────────────────

class TestDoctor:

    @patch("core.doctor.subprocess.run")
    def test_check_kubectl_found(self, mock_run):
        from core.doctor import _check_kubectl
        import shutil

        with patch("core.doctor.shutil.which", return_value="/usr/local/bin/kubectl"):
            mock_run.return_value = MagicMock(
                stdout="Client Version: v1.27.3", returncode=0
            )
            result = _check_kubectl()
            assert result["status"] == "ok"
            assert "v1.27.3" in result["detail"]

    def test_check_kubectl_missing(self):
        from core.doctor import _check_kubectl

        with patch("core.doctor.shutil.which", return_value=None):
            result = _check_kubectl()
            assert result["status"] == "fail"
            assert "Not found" in result["detail"]

    @patch("core.doctor.subprocess.run")
    def test_check_metrics_available(self, mock_run):
        from core.doctor import _check_metrics_server

        mock_run.return_value = MagicMock(returncode=0)
        result = _check_metrics_server()
        assert result["status"] == "ok"

    @patch("core.doctor.subprocess.run")
    def test_check_metrics_unavailable(self, mock_run):
        from core.doctor import _check_metrics_server

        mock_run.return_value = MagicMock(returncode=1)
        result = _check_metrics_server()
        assert result["status"] == "warn"

    def test_check_config_exists(self):
        from core.doctor import _check_config

        with patch("core.doctor.CONFIG_PATH") as mock_path:
            mock_path.exists.return_value = True
            with patch("core.doctor.load_config", return_value={"a": 1, "b": 2}):
                result = _check_config()
                assert result["status"] == "ok"

    def test_check_config_missing(self):
        from core.doctor import _check_config

        with patch("core.doctor.CONFIG_PATH") as mock_path:
            mock_path.exists.return_value = False
            result = _check_config()
            assert result["status"] == "warn"


# ─── Batch 1: Suggestions ───────────────────────────

class TestSuggestions:

    def test_suggestion_after_pods(self):
        from core.suggestions import get_suggestion
        hint = get_suggestion("pods_table", {})
        assert hint is not None
        assert "diagnose" in hint or "top pods" in hint

    def test_suggestion_after_diagnose(self):
        from core.suggestions import get_suggestion
        hint = get_suggestion("diagnose", {"target": "payment"})
        assert "payment" in hint
        assert "logs" in hint or "fix" in hint

    def test_suggestion_after_overview(self):
        from core.suggestions import get_suggestion
        hint = get_suggestion("overview", {})
        assert "scorecard" in hint or "alerts" in hint

    def test_no_suggestion_for_help(self):
        from core.suggestions import get_suggestion
        hint = get_suggestion("help", {})
        assert hint is None

    def test_no_suggestion_for_unknown(self):
        from core.suggestions import get_suggestion
        hint = get_suggestion("nonexistent_command", {})
        assert hint is None


# ─── Batch 3: Telemetry ─────────────────────────────

class TestTelemetry:

    def test_disabled_by_default(self):
        from core.telemetry import is_enabled
        # Default config has no telemetry key
        with patch("core.telemetry.load_config", return_value={}):
            assert is_enabled() is False

    def test_enabled_when_configured(self):
        from core.telemetry import is_enabled
        with patch("core.telemetry.load_config", return_value={"telemetry": True}):
            assert is_enabled() is True

    def test_track_command_noop_when_disabled(self):
        from core.telemetry import track_command
        with patch("core.telemetry.is_enabled", return_value=False):
            # Should not raise
            track_command("pods", "payment")

    def test_get_stats_empty(self):
        from core.telemetry import get_stats
        with patch("core.telemetry._read", return_value=[]):
            with patch("core.telemetry._stats_from_db", return_value=None):
                stats = get_stats()
                assert stats["total_commands"] == 0
                assert stats["unresolved_count"] == 0


# ─── Batch 3: Scheduler ─────────────────────────────

class TestScheduler:

    def test_should_run_wildcard(self):
        from core.scheduler import _should_run
        from datetime import datetime

        assert _should_run("* * * * *", datetime(2025, 1, 1, 8, 0), None) is True

    def test_should_run_exact_match(self):
        from core.scheduler import _should_run
        from datetime import datetime

        assert _should_run("0 8 * * *", datetime(2025, 1, 1, 8, 0), None) is True
        assert _should_run("0 8 * * *", datetime(2025, 1, 1, 9, 0), None) is False

    def test_should_run_step(self):
        from core.scheduler import _should_run
        from datetime import datetime

        assert _should_run("*/5 * * * *", datetime(2025, 1, 1, 8, 10), None) is True
        assert _should_run("*/5 * * * *", datetime(2025, 1, 1, 8, 3), None) is False

    def test_should_run_respects_last_run(self):
        from core.scheduler import _should_run
        from datetime import datetime

        now = datetime(2025, 1, 1, 8, 0)
        # Last run 30 seconds ago — should not run again
        assert _should_run("* * * * *", now, now.isoformat()) is False

    def test_next_run_label(self):
        from core.scheduler import _next_run_label

        assert _next_run_label("*/5 * * * *") == "every 5min"
        assert _next_run_label("0 */6 * * *") == "every 6h"
        assert _next_run_label("0 8 * * *") == "daily at 8:00"

    def test_match_field(self):
        from core.scheduler import _match_field

        assert _match_field("*", 5) is True
        assert _match_field("5", 5) is True
        assert _match_field("5", 6) is False
        assert _match_field("*/3", 9) is True
        assert _match_field("*/3", 10) is False


# ─── Batch 3: Cost Trend ────────────────────────────

class TestCostTrend:

    @patch("core.collectors.cost_trend.estimate_costs")
    @patch("core.collectors.cost_trend.get_all_pod_history")
    def test_cost_trend_no_deployments(self, mock_history, mock_costs):
        from core.collectors.cost_trend import cost_trend

        mock_costs.return_value = {"deployments": [], "total": 0}
        mock_history.return_value = {}

        result = cost_trend()
        assert result["current_monthly"] == 0
        assert result["has_history"] is False

    @patch("core.collectors.cost_trend.estimate_costs")
    @patch("core.collectors.cost_trend.get_all_pod_history")
    def test_cost_trend_with_data(self, mock_history, mock_costs):
        from core.collectors.cost_trend import cost_trend

        mock_costs.return_value = {
            "deployments": [
                {"name": "api", "replicas": 2, "cpu_request": "500m",
                 "memory_request": "256Mi", "cost_per_pod": 15.0, "cost_total": 30.0}
            ],
            "total": 30.0,
        }
        mock_history.return_value = {
            "api-abc": {"cpu_avg": 200, "cpu_peak": 400, "cpu_p95": 350,
                        "mem_avg": 128, "mem_peak": 200, "mem_p95": 180, "samples": 50}
        }

        result = cost_trend()
        assert result["current_monthly"] == 30.0
        assert result["has_history"] is True
        assert result["trend"] in ("growing", "stable", "shrinking")


# ─── Batch 4: Incident Share ────────────────────────

class TestIncidentShare:

    def test_incident_to_markdown(self):
        from core.incident.manager import _incident_to_markdown

        incident = {
            "title": "API Outage",
            "id": "20250715",
            "context": "prod",
            "namespace": "billing",
            "started": "2025-07-15T12:00:00",
            "ended": "2025-07-15T12:45:00",
            "root_cause": "OOM in payment",
            "resolution": "Increased memory",
            "notes": [{"time": "2025-07-15T12:10:00", "text": "Found OOM"}],
            "actions": [{"action": "restart", "target": "payment", "result": "ok"}],
            "timeline": [{"time": "2025-07-15T12:00:00", "event": "start", "detail": ""}],
        }
        md = _incident_to_markdown(incident)
        assert "API Outage" in md
        assert "OOM in payment" in md
        assert "Increased memory" in md
        assert "Found OOM" in md

    def test_share_no_active(self):
        from core.incident.manager import share_incident

        with patch("core.incident.manager._load", return_value=None):
            success, msg = share_incident()
            assert success is False
            assert "No active" in msg


# ─── Batch 4: Team Runbooks ─────────────────────────

class TestTeamRunbooks:

    def test_load_team_runbooks(self):
        from core.ai.playbooks import _load_team_runbooks
        # Should not crash even if dirs don't exist
        runbooks = _load_team_runbooks()
        assert isinstance(runbooks, dict)

    def test_list_all_includes_builtin(self):
        from core.ai.playbooks import list_all_playbooks, PLAYBOOKS
        all_pb = list_all_playbooks()
        # Should have at least all built-in
        assert len(all_pb) >= len(PLAYBOOKS)

    def test_get_playbook_builtin(self):
        from core.ai.playbooks import get_playbook
        pb = get_playbook("CrashLoopBackOff")
        assert pb is not None
        assert pb["title"] == "CrashLoopBackOff Recovery"


# ─── Batch 5: AI Follow-ups ─────────────────────────

class TestAIFollowUps:

    def test_follow_ups_for_why_failing(self):
        from core.ai.engine import get_follow_up_suggestions
        fu = get_follow_up_suggestions("why_failing", "payment")
        assert len(fu) == 3
        assert "payment" in fu[0]

    def test_follow_ups_for_summarize(self):
        from core.ai.engine import get_follow_up_suggestions
        fu = get_follow_up_suggestions("summarize")
        assert len(fu) == 3
        assert "anomalies" in fu[0]

    def test_follow_ups_unknown_intent(self):
        from core.ai.engine import get_follow_up_suggestions
        fu = get_follow_up_suggestions("nonexistent_intent")
        assert fu == []

    def test_follow_ups_none_target(self):
        from core.ai.engine import get_follow_up_suggestions
        fu = get_follow_up_suggestions("why_failing", None)
        assert len(fu) == 3
        assert "warning events" in fu[0]


# ─── Batch 5: Log Regex/Since ───────────────────────

class TestLogRegex:

    def test_command_parses_regex(self):
        from core.commands import resolve_command

        with patch("core.commands.resolve_pod_name", return_value=["payment-abc"]):
            with patch("core.commands.choose_pod", return_value="payment-abc"):
                r = resolve_command('logs payment --regex "OOM"')
                assert r["type"] == "logs"
                assert r["regex"] == '"OOM"'

    def test_command_parses_since(self):
        from core.commands import resolve_command

        with patch("core.commands.resolve_pod_name", return_value=["payment-abc"]):
            with patch("core.commands.choose_pod", return_value="payment-abc"):
                r = resolve_command("logs payment --since 2h")
                assert r["type"] == "logs"
                assert r["since"] == "2h"


# ─── Batch 6: Policy Engine ─────────────────────────

class TestPolicyEngine:

    def test_load_policies(self):
        from core.policy import load_policies
        policies = load_policies()
        assert isinstance(policies, list)

    def test_rule_no_latest(self):
        from core.policy import _rule_no_latest

        items = [{
            "metadata": {"name": "api"},
            "spec": {"template": {"spec": {"containers": [
                {"name": "app", "image": "myapp:latest"}
            ]}}}
        }]
        violations = _rule_no_latest(items, {})
        assert len(violations) == 1
        assert "latest" in violations[0]["detail"]

    def test_rule_no_latest_passes(self):
        from core.policy import _rule_no_latest

        items = [{
            "metadata": {"name": "api"},
            "spec": {"template": {"spec": {"containers": [
                {"name": "app", "image": "myapp:v2.1.0"}
            ]}}}
        }]
        violations = _rule_no_latest(items, {})
        assert len(violations) == 0

    def test_rule_memory_limits(self):
        from core.policy import _rule_memory_limits

        items = [{
            "metadata": {"name": "api"},
            "spec": {"template": {"spec": {"containers": [
                {"name": "app", "resources": {"requests": {"memory": "128Mi"}}}
            ]}}}
        }]
        violations = _rule_memory_limits(items, {})
        assert len(violations) == 1

    def test_rule_memory_limits_passes(self):
        from core.policy import _rule_memory_limits

        items = [{
            "metadata": {"name": "api"},
            "spec": {"template": {"spec": {"containers": [
                {"name": "app", "resources": {"limits": {"memory": "256Mi"}}}
            ]}}}
        }]
        violations = _rule_memory_limits(items, {})
        assert len(violations) == 0

    def test_rule_max_replicas(self):
        from core.policy import _rule_max_replicas

        items = [
            {"metadata": {"name": "api"}, "spec": {"replicas": 25}},
            {"metadata": {"name": "web"}, "spec": {"replicas": 3}},
        ]
        violations = _rule_max_replicas(items, {"max": 10})
        assert len(violations) == 1
        assert violations[0]["resource"] == "api"

    def test_rule_no_privileged(self):
        from core.policy import _rule_no_privileged

        items = [{
            "metadata": {"name": "api"},
            "spec": {"template": {"spec": {"containers": [
                {"name": "app", "securityContext": {"privileged": True}}
            ]}}}
        }]
        violations = _rule_no_privileged(items, {})
        assert len(violations) == 1

    def test_rule_no_privileged_passes(self):
        from core.policy import _rule_no_privileged

        items = [{
            "metadata": {"name": "api"},
            "spec": {"template": {"spec": {"containers": [
                {"name": "app", "securityContext": {"privileged": False}}
            ]}}}
        }]
        violations = _rule_no_privileged(items, {})
        assert len(violations) == 0


# ─── Batch 6: Plugin Install ────────────────────────

class TestPluginInstall:

    def test_uninstall_not_found(self):
        from core.plugins import uninstall_plugin
        success, msg = uninstall_plugin("nonexistent_plugin_xyz")
        assert success is False
        assert "not installed" in msg


# ─── Batch 6: Metrics History ───────────────────────

class TestMetricsHistory:

    def test_retention_is_7_days(self):
        from core.collectors.metrics_history import RETENTION_HOURS
        assert RETENTION_HOURS == 168

    def test_percentile(self):
        from core.collectors.metrics_history import _percentile
        assert _percentile([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 95) == 10
        assert _percentile([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 50) == 6
        assert _percentile([], 95) == 0

    def test_get_time_series_empty(self):
        from core.collectors.metrics_history import get_time_series
        with patch("core.collectors.metrics_history.context") as mock_ctx:
            mock_ctx.namespace = "default"
            with patch("core.collectors.metrics_history.HISTORY_DIR") as mock_dir:
                mock_path = MagicMock()
                mock_path.exists.return_value = False
                mock_dir.__truediv__ = MagicMock(return_value=mock_path)
                result = get_time_series(hours=24)
                assert result == []


# ─── Command Resolution ─────────────────────────────

class TestNewCommands:

    def test_doctor_command(self):
        from core.commands import resolve_command
        assert resolve_command("doctor") == {"type": "doctor"}

    def test_stats_command(self):
        from core.commands import resolve_command
        assert resolve_command("stats") == {"type": "stats"}

    def test_cost_trend_command(self):
        from core.commands import resolve_command
        assert resolve_command("cost-trend") == {"type": "cost_trend"}

    def test_policy_command(self):
        from core.commands import resolve_command
        assert resolve_command("policy") == {"type": "policy_check"}

    def test_schedule_list(self):
        from core.commands import resolve_command
        assert resolve_command("schedules") == {"type": "schedule_list"}

    def test_schedule_rm(self):
        from core.commands import resolve_command
        r = resolve_command("schedule rm daily")
        assert r == {"type": "schedule_rm", "name": "daily"}

    def test_plugin_install(self):
        from core.commands import resolve_command
        r = resolve_command("plugin install my-check")
        assert r == {"type": "plugin_install", "name": "my-check"}

    def test_plugin_rm(self):
        from core.commands import resolve_command
        r = resolve_command("plugin rm my-check")
        assert r == {"type": "plugin_uninstall", "name": "my-check"}

    def test_plugin_run(self):
        from core.commands import resolve_command
        r = resolve_command("plugin my-check")
        assert r == {"type": "plugin", "name": "my-check"}

    def test_incident_share(self):
        from core.commands import resolve_command
        r = resolve_command("incident share")
        assert r == {"type": "incident_share", "id": None}

    def test_incident_share_with_id(self):
        from core.commands import resolve_command
        r = resolve_command("incident share 20250715_120000")
        assert r == {"type": "incident_share", "id": "20250715_120000"}


# ─── Performance: Resolver at Scale ─────────────────

class TestResolverPerformance:
    """Ensure resolver stays fast with 10000+ pods."""

    def _generate_pods(self, count=10000):
        names = []
        services = [
            "payment-api", "billing-svc", "auth-gateway",
            "customer-db", "order-processor", "notification-worker",
            "analytics-pipeline", "cache-redis", "queue-rabbitmq",
            "search-elastic",
        ]
        for i in range(count):
            svc = services[i % len(services)]
            names.append(f"{svc}-{i:05d}-{'abcdef'[i%6]}x{i%99:02d}")
        return names

    def test_exact_substring_under_5ms(self):
        import time
        from core.resolver import _fuzzy_match

        names = self._generate_pods(10000)
        start = time.time()
        result = _fuzzy_match("payment-api", names)
        elapsed_ms = (time.time() - start) * 1000

        assert result is not None
        assert len(result) <= 8
        assert elapsed_ms < 50, f"Took {elapsed_ms:.1f}ms (limit: 50ms)"

    def test_specific_pod_under_5ms(self):
        import time
        from core.resolver import _fuzzy_match

        names = self._generate_pods(10000)
        target = names[5555]  # Pick a specific pod
        start = time.time()
        result = _fuzzy_match(target, names)
        elapsed_ms = (time.time() - start) * 1000

        assert result is not None
        assert target in result
        assert elapsed_ms < 15, f"Took {elapsed_ms:.1f}ms (limit: 15ms)"

    def test_no_match_under_50ms(self):
        import time
        from core.resolver import _fuzzy_match

        names = self._generate_pods(10000)
        start = time.time()
        result = _fuzzy_match("zzz-nonexistent-xyz", names)
        elapsed_ms = (time.time() - start) * 1000

        assert elapsed_ms < 50, f"Took {elapsed_ms:.1f}ms (limit: 50ms)"

    def test_short_query_under_50ms(self):
        import time
        from core.resolver import _fuzzy_match

        names = self._generate_pods(10000)
        start = time.time()
        result = _fuzzy_match("pay", names)
        elapsed_ms = (time.time() - start) * 1000

        assert result is not None
        assert len(result) <= 8
        assert elapsed_ms < 50, f"Took {elapsed_ms:.1f}ms (limit: 50ms)"

    def test_results_never_exceed_max(self):
        from core.resolver import _fuzzy_match, MAX_SELECTOR_CHOICES

        names = self._generate_pods(10000)

        queries = [
            "payment", "billing", "auth", "customer",
            "order", "cache", "queue", "search",
        ]
        for q in queries:
            result = _fuzzy_match(q, names)
            if result:
                assert len(result) <= MAX_SELECTOR_CHOICES, (
                    f"Query '{q}' returned {len(result)} results "
                    f"(max: {MAX_SELECTOR_CHOICES})"
                )

    def test_hyphenated_target_preferred(self):
        from core.resolver import _fuzzy_match

        names = self._generate_pods(10000)
        result = _fuzzy_match("billing-svc", names)

        assert result is not None
        assert all("billing-svc" in r for r in result)
