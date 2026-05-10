"""
Tests for new features:
1. Multi-pod log correlation
2. Cluster diff timeline
3. Watch & alert
4. Dependency health map
5. Rollback preview

Run: pytest tests/test_features.py
"""

import sys
import os
from unittest.mock import patch, MagicMock

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))


# ─── Feature 1: Log Correlation ─────────────────────

class TestLogCorrelation:

    def test_parse_timestamped_line(self):
        from core.collectors.log_correlation import (
            _parse_timestamped_line
        )
        ts, msg = _parse_timestamped_line(
            "2024-01-15T10:30:45.123456789Z INFO starting"
        )
        assert ts == "2024-01-15T10:30:45.123"
        assert msg == "INFO starting"

    def test_parse_line_no_timestamp(self):
        from core.collectors.log_correlation import (
            _parse_timestamped_line
        )
        ts, msg = _parse_timestamped_line(
            "just a plain log line"
        )
        assert ts is None
        assert msg == "just a plain log line"

    def test_short_name(self):
        from core.collectors.log_correlation import (
            _short_name
        )
        assert _short_name(
            "payment-api-7f8b9c-x4k2p"
        ) == "payment-api"
        assert _short_name("simple") == "simple"

    def test_detect_level(self):
        from core.collectors.log_correlation import (
            _detect_level
        )
        assert _detect_level("ERROR: connection failed") == "error"
        assert _detect_level("WARN: slow query") == "warn"
        assert _detect_level("DEBUG: entering func") == "debug"
        assert _detect_level("processing request") == "info"

    @patch("core.collectors.log_correlation.subprocess.run")
    @patch("core.collectors.log_correlation.context")
    def test_correlate_logs_merges_pods(self, mock_ctx, mock_run):
        from core.collectors.log_correlation import correlate_logs

        mock_ctx.current_context = "test"
        mock_ctx.namespace = "default"

        def side_effect(cmd, **kwargs):
            mock = MagicMock()
            mock.returncode = 0
            if "pod-a" in cmd:
                mock.stdout = (
                    "2024-01-15T10:30:45.000Z msg from A\n"
                    "2024-01-15T10:30:47.000Z another from A"
                )
            else:
                mock.stdout = (
                    "2024-01-15T10:30:46.000Z msg from B"
                )
            return mock

        mock_run.side_effect = side_effect

        result = correlate_logs(["pod-a", "pod-b"], tail=10)
        assert result["total"] == 3
        # Should be sorted by timestamp
        assert result["entries"][0]["message"] == "msg from A"
        assert result["entries"][1]["message"] == "msg from B"
        assert result["entries"][2]["message"] == "another from A"

    @patch("core.collectors.log_correlation.subprocess.run")
    @patch("core.collectors.log_correlation.context")
    def test_correlate_logs_handles_failure(self, mock_ctx, mock_run):
        from core.collectors.log_correlation import correlate_logs

        mock_ctx.current_context = "test"
        mock_ctx.namespace = "default"
        mock_run.return_value = MagicMock(returncode=1)

        result = correlate_logs(["pod-a"], tail=10)
        assert result["total"] == 0
        assert result["entries"] == []


# ─── Feature 2: Diff Timeline ───────────────────────

class TestDiffTimeline:

    @patch("core.collectors.diff_timeline.subprocess.run")
    @patch("core.collectors.diff_timeline.context")
    def test_categorize_scaling(self, mock_ctx, mock_run):
        from core.collectors.diff_timeline import (
            _categorize_changes
        )

        events = [
            {
                "reason": "ScalingReplicaSet",
                "name": "payment-api",
                "message": "Scaled up to 3",
                "type": "Normal",
                "time": "2024-01-15T10:00:00Z",
                "kind": "Deployment",
            }
        ]
        result = _categorize_changes(events)
        assert "scaling" in result
        assert len(result["scaling"]) == 1

    def test_categorize_empty(self):
        from core.collectors.diff_timeline import (
            _categorize_changes
        )
        result = _categorize_changes([])
        assert result == {}

    def test_categorize_restarts(self):
        from core.collectors.diff_timeline import (
            _categorize_changes
        )
        events = [
            {
                "reason": "BackOff",
                "name": "billing-worker",
                "message": "Back-off restarting",
                "type": "Warning",
                "time": "2024-01-15T10:00:00Z",
                "kind": "Pod",
            }
        ]
        result = _categorize_changes(events)
        assert "restarts" in result


# ─── Feature 3: Watch & Alert ───────────────────────

class TestWatchAlert:

    def test_add_and_status(self):
        from core.watch_alert import WatchAlert

        watcher = WatchAlert()
        watcher.add(
            "test-watch",
            lambda: (False, ""),
            interval=10
        )
        status = watcher.status()
        assert len(status["watches"]) == 1
        assert status["watches"][0]["name"] == "test-watch"
        assert not status["running"]

    def test_remove(self):
        from core.watch_alert import WatchAlert

        watcher = WatchAlert()
        watcher.add("w1", lambda: (False, ""))
        watcher.add("w2", lambda: (False, ""))
        watcher.remove("w1")
        assert len(watcher.status()["watches"]) == 1
        assert watcher.status()["watches"][0]["name"] == "w2"

    def test_check_triggers(self):
        from core.watch_alert import WatchAlert

        watcher = WatchAlert()
        watcher.add(
            "always-trigger",
            lambda: (True, "alert!"),
        )
        # Manually trigger check
        watcher._check(watcher.watches[0])
        assert watcher.watches[0]["triggered"] is True
        assert len(watcher.watches[0]["alerts"]) == 1
        assert watcher.watches[0]["alerts"][0]["message"] == "alert!"

    def test_check_no_trigger(self):
        from core.watch_alert import WatchAlert

        watcher = WatchAlert()
        watcher.add(
            "never-trigger",
            lambda: (False, ""),
        )
        watcher._check(watcher.watches[0])
        assert watcher.watches[0]["triggered"] is False
        assert len(watcher.watches[0]["alerts"]) == 0

    def test_condition_factories(self):
        from core.watch_alert import (
            pod_crash_condition,
            pod_restart_condition,
            pod_count_condition,
        )

        # These should be callable
        assert callable(pod_crash_condition("payment"))
        assert callable(pod_restart_condition("billing", 3))
        assert callable(pod_count_condition("gateway", 2))

    @patch("core.watch_alert.collect_pods")
    def test_pod_crash_condition_triggers(self, mock_pods):
        from core.watch_alert import pod_crash_condition

        mock_pods.return_value = [
            {"name": "payment-api-abc", "status": "CrashLoopBackOff", "restarts": 10},
        ]
        check = pod_crash_condition("payment")
        triggered, msg = check()
        assert triggered is True
        assert "payment-api-abc" in msg

    @patch("core.watch_alert.collect_pods")
    def test_pod_crash_condition_no_trigger(self, mock_pods):
        from core.watch_alert import pod_crash_condition

        mock_pods.return_value = [
            {"name": "payment-api-abc", "status": "Running", "restarts": 0},
        ]
        check = pod_crash_condition("payment")
        triggered, msg = check()
        assert triggered is False


# ─── Feature 4: Dependency Health ────────────────────

class TestDependencyHealth:

    def test_get_issue_crash(self):
        from core.collectors.dep_health import _get_issue

        pods = [
            {"name": "x", "status": "CrashLoopBackOff", "restarts": 10}
        ]
        assert "CrashLoopBackOff" in _get_issue(pods)

    def test_get_issue_restarts(self):
        from core.collectors.dep_health import _get_issue

        pods = [
            {"name": "x", "status": "Running", "restarts": 15}
        ]
        assert "15 restarts" in _get_issue(pods)

    @patch("core.collectors.dep_health.subprocess.run")
    def test_check_service_exists(self, mock_run):
        from core.collectors.dep_health import _check_service

        mock_run.return_value = MagicMock(returncode=0)
        assert _check_service("ctx", "ns", "redis") is True

    @patch("core.collectors.dep_health.subprocess.run")
    def test_check_service_missing(self, mock_run):
        from core.collectors.dep_health import _check_service

        mock_run.return_value = MagicMock(returncode=1)
        assert _check_service("ctx", "ns", "redis") is False

    @patch("core.collectors.dep_health.collect_pods")
    @patch("core.collectors.dep_health._discover_dependencies")
    @patch("core.collectors.dep_health.context")
    def test_dependency_health_finds_root_cause(
        self, mock_ctx, mock_deps, mock_pods
    ):
        from core.collectors.dep_health import dependency_health

        mock_ctx.current_context = "test"
        mock_ctx.namespace = "default"
        mock_deps.return_value = [
            {"name": "redis", "type": "service"},
        ]
        mock_pods.return_value = [
            {"name": "payment-api-abc", "status": "Running", "restarts": 0},
            {"name": "redis-xyz", "status": "CrashLoopBackOff", "restarts": 10},
        ]

        result = dependency_health("payment-api")
        assert result["root_cause"] is not None
        assert "redis" in result["root_cause"]["name"]


# ─── Feature 5: Rollback Preview ────────────────────

class TestRollbackPreview:

    def test_extract_images(self):
        from core.collectors.rollback_preview import (
            _extract_images
        )
        spec = {
            "spec": {
                "template": {
                    "spec": {
                        "containers": [
                            {"name": "app", "image": "myapp:v2"},
                            {"name": "sidecar", "image": "proxy:1.0"},
                        ]
                    }
                }
            }
        }
        images = _extract_images(spec)
        assert images == {"app": "myapp:v2", "sidecar": "proxy:1.0"}

    def test_extract_envs(self):
        from core.collectors.rollback_preview import (
            _extract_envs
        )
        spec = {
            "spec": {
                "template": {
                    "spec": {
                        "containers": [{
                            "name": "app",
                            "env": [
                                {"name": "DB_HOST", "value": "postgres"},
                                {"name": "SECRET", "valueFrom": {"secretKeyRef": {"name": "s"}}},
                            ]
                        }]
                    }
                }
            }
        }
        envs = _extract_envs(spec)
        assert envs == {"DB_HOST": "postgres"}
        assert "SECRET" not in envs

    def test_extract_images_empty(self):
        from core.collectors.rollback_preview import (
            _extract_images
        )
        assert _extract_images({}) == {}
        assert _extract_images({"spec": {}}) == {}

    @patch("core.collectors.rollback_preview.subprocess.run")
    @patch("core.collectors.rollback_preview.context")
    def test_preview_unavailable(self, mock_ctx, mock_run):
        from core.collectors.rollback_preview import (
            rollback_preview
        )

        mock_ctx.current_context = "test"
        mock_ctx.namespace = "default"
        mock_run.return_value = MagicMock(returncode=1)

        result = rollback_preview("payment-api")
        assert result["available"] is False
