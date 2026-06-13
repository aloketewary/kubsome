"""
Tests for core/analytics/overview.py — verifies the API
contract under 4 scenarios: no data, normal, high risk,
and DB unavailable.
"""

import sys
from unittest.mock import patch, MagicMock
from datetime import datetime, timezone

import pytest

sys.path.insert(0, ".")

from core.analytics.overview import (
    AnalyticsOverview, ChangeItem, CostOpportunity,
    RiskItem, IncidentItem, build_overview,
    _weighted_health, _map_incident, _empty,
    _opportunity_action,
)


# --- Unit: dataclass contract ---


class TestContract:
    def test_overview_to_dict_keys(self):
        """Verify top-level keys match frozen contract."""
        o = _empty("no_data")
        d = o.to_dict()
        expected = {
            "health_score", "cost_delta_monthly",
            "active_risks", "highest_risk_severity",
            "biggest_change", "top_changes",
            "cost_opportunities", "upcoming_risks",
            "recent_incidents", "generated_at",
            "data_freshness_seconds", "empty_state_reason",
        }
        assert set(d.keys()) == expected

    def test_change_item_fields(self):
        c = ChangeItem(
            deployment="pay", namespace="default",
            metric="memory", delta_pct=31.2, trend="up",
            current_value=186.0, previous_value=142.0,
            unit="Mi",
        )
        assert c.trend in ("up", "down")
        assert c.unit == "Mi"
        assert c.delta_pct == 31.2

    def test_cost_opportunity_fields(self):
        c = CostOpportunity(
            deployment="api", namespace="prod",
            action="right-size cpu (decrease)",
            savings_monthly=18.50, confidence=72,
            risk="low",
        )
        assert c.risk in ("low", "medium", "high")

    def test_risk_item_fields(self):
        r = RiskItem(
            deployment="pay", namespace="default",
            risk_type="memory_oom", severity="critical",
            hours_remaining=2.5, message="OOM in ~2.5h",
            recommendation="Increase memory",
            confidence=85,
        )
        assert r.severity in ("critical", "high", "medium")

    def test_incident_item_has_title_and_description(self):
        i = IncidentItem(
            deployment="billing", namespace="prod",
            severity="critical",
            title="Health score dropped",
            description="82 → 41 (CrashLoopBackOff)",
            health_before=82, health_after=41,
            occurred_at="2024-01-15T10:30:00",
        )
        assert i.title != ""
        assert i.description != ""


# --- Unit: weighted health ---


class TestWeightedHealth:
    def test_empty_returns_100(self):
        assert _weighted_health([]) == 100

    def test_single_deployment(self):
        deps = [{"health_score": 75, "pod_count": 3}]
        assert _weighted_health(deps) == 75

    def test_weighted_favors_larger_deployments(self):
        """Critical small deploy shouldn't mask large healthy."""
        deps = [
            {"health_score": 20, "pod_count": 1},   # tiny
            {"health_score": 95, "pod_count": 10},   # large
        ]
        score = _weighted_health(deps)
        # (20*1 + 95*10) / 11 = 88.18
        assert score == 88

    def test_weighted_flags_critical_large_deployment(self):
        """Critical large deploy dominates score."""
        deps = [
            {"health_score": 20, "pod_count": 10},   # large critical
            {"health_score": 95, "pod_count": 1},    # tiny healthy
        ]
        score = _weighted_health(deps)
        # (20*10 + 95*1) / 11 = 26.8
        assert score == 26


# --- Unit: incident mapping ---


class TestIncidentMapping:
    def test_maps_reason_to_human_title(self):
        raw = {
            "object": "billing-api",
            "namespace": "prod",
            "severity": "critical",
            "reason": "healthy_to_critical",
            "health_before": 92,
            "health_after": 30,
            "details": "CrashLoopBackOff",
            "ts": "2024-01-15T10:30:00",
        }
        item = _map_incident(raw)
        assert item.title == "Critical failure"
        assert "92 → 30" in item.description
        assert "CrashLoopBackOff" in item.description

    def test_unknown_reason_gets_default_title(self):
        raw = {
            "object": "x",
            "namespace": "ns",
            "severity": "medium",
            "reason": "something_unexpected",
            "health_before": 80,
            "health_after": 60,
            "details": "",
            "ts": "",
        }
        item = _map_incident(raw)
        assert item.title == "Health change detected"

    def test_health_drop_reason(self):
        raw = {
            "object": "api",
            "namespace": "ns",
            "severity": "high",
            "reason": "health_drop_82->41",
            "health_before": 82,
            "health_after": 41,
            "details": "",
            "ts": "2024-01-15T10:00:00",
        }
        item = _map_incident(raw)
        assert item.title == "Health score dropped"


# --- Unit: opportunity action ---


class TestOpportunityAction:
    def test_cpu_only(self):
        rec = {"direction": {"cpu": "decrease", "mem": "keep"}}
        assert _opportunity_action(rec) == "right-size cpu (decrease)"

    def test_mem_only(self):
        rec = {"direction": {"cpu": "keep", "mem": "decrease"}}
        assert _opportunity_action(rec) == "right-size memory (decrease)"

    def test_both(self):
        rec = {"direction": {"cpu": "decrease", "mem": "decrease"}}
        assert _opportunity_action(rec) == "right-size cpu+memory"

    def test_keep_both(self):
        rec = {"direction": {"cpu": "keep", "mem": "keep"}}
        assert _opportunity_action(rec) == "review resources"


# --- Integration: build_overview scenarios ---


class TestBuildOverviewNoData:
    """Scenario: fresh install, no metrics collected yet."""

    @patch("core.analytics.overview._get_freshness_seconds", return_value=0)
    @patch("core.analytics.overview._compute_changes", return_value=[])
    @patch("core.analytics.overview._compute_cost_delta", return_value=0.0)
    @patch("core.analytics.rightsizing.pod_rightsizing", return_value=[])
    @patch("core.analytics.predictive.check_predictive_alerts", return_value=[])
    @patch("core.analytics.health.open_incidents", return_value=[])
    @patch("core.analytics.health.deployment_health_current", return_value=[])
    @patch("core.analytics.engine.get_conn")
    def test_returns_empty_state(self, mock_conn, *mocks):
        mock_conn.return_value = MagicMock()
        result = build_overview()
        assert result.empty_state_reason == "no_data"
        assert result.health_score == 100
        assert result.active_risks == 0
        assert result.biggest_change is None
        assert result.top_changes == []
        assert result.cost_opportunities == []

    @patch("core.analytics.overview._get_freshness_seconds", return_value=0)
    @patch("core.analytics.overview._compute_changes", return_value=[])
    @patch("core.analytics.overview._compute_cost_delta", return_value=0.0)
    @patch("core.analytics.rightsizing.pod_rightsizing", return_value=[])
    @patch("core.analytics.predictive.check_predictive_alerts", return_value=[])
    @patch("core.analytics.health.open_incidents", return_value=[])
    @patch("core.analytics.health.deployment_health_current", return_value=[])
    @patch("core.analytics.engine.get_conn")
    def test_generated_at_is_utc_with_tz(self, mock_conn, *mocks):
        mock_conn.return_value = MagicMock()
        result = build_overview()
        assert "+" in result.generated_at or "Z" in result.generated_at


class TestBuildOverviewNormal:
    """Scenario: healthy cluster with some data."""

    @patch("core.analytics.overview._get_freshness_seconds", return_value=120)
    @patch("core.analytics.overview._compute_changes")
    @patch("core.analytics.overview._compute_cost_delta", return_value=12.50)
    @patch("core.analytics.rightsizing.pod_rightsizing")
    @patch("core.analytics.predictive.check_predictive_alerts", return_value=[])
    @patch("core.analytics.health.open_incidents", return_value=[])
    @patch("core.analytics.health.deployment_health_current")
    @patch("core.analytics.engine.get_conn")
    def test_normal_cluster(self, mock_conn, mock_health,
                            mock_incidents, mock_preds,
                            mock_rights, mock_cost_delta,
                            mock_changes, mock_fresh):
        mock_conn.return_value = MagicMock()
        mock_health.return_value = [
            {"health_score": 95, "pod_count": 5},
            {"health_score": 88, "pod_count": 3},
        ]
        mock_rights.return_value = [{
            "deployment": "api",
            "namespace": "default",
            "direction": {"cpu": "decrease", "mem": "keep"},
            "total_savings_monthly": 8.50,
            "confidence": 75,
            "risk": "low",
        }]
        mock_changes.return_value = [
            ChangeItem(
                deployment="pay", namespace="default",
                metric="memory", delta_pct=15.2,
                trend="up", current_value=180.0,
                previous_value=156.0, unit="Mi",
            ),
        ]

        result = build_overview()
        assert result.empty_state_reason is None
        assert result.health_score == 92  # (95*5 + 88*3) / 8
        assert result.cost_delta_monthly == 12.50
        assert result.active_risks == 0
        assert result.highest_risk_severity is None
        assert len(result.cost_opportunities) == 1
        assert result.cost_opportunities[0].savings_monthly == 8.50
        assert result.biggest_change is not None
        assert result.biggest_change.deployment == "pay"
        assert result.data_freshness_seconds == 120


class TestBuildOverviewHighRisk:
    """Scenario: cluster with critical predictions."""

    @patch("core.analytics.overview._get_freshness_seconds", return_value=60)
    @patch("core.analytics.overview._compute_changes", return_value=[])
    @patch("core.analytics.overview._compute_cost_delta", return_value=47.0)
    @patch("core.analytics.rightsizing.pod_rightsizing", return_value=[])
    @patch("core.analytics.predictive.check_predictive_alerts")
    @patch("core.analytics.health.open_incidents")
    @patch("core.analytics.health.deployment_health_current")
    @patch("core.analytics.engine.get_conn")
    def test_high_risk_cluster(self, mock_conn, mock_health,
                               mock_incidents, mock_preds, *mocks):
        mock_conn.return_value = MagicMock()
        mock_health.return_value = [
            {"health_score": 30, "pod_count": 5},
            {"health_score": 90, "pod_count": 2},
        ]
        mock_preds.return_value = [
            {
                "type": "memory_oom_predicted",
                "severity": "critical",
                "deployment": "payment-api",
                "namespace": "prod",
                "message": "OOM in ~2h",
                "hours_remaining": 2.1,
                "recommendation": "Increase memory",
                "confidence": 88,
            },
            {
                "type": "cpu_saturation_predicted",
                "severity": "high",
                "deployment": "search",
                "namespace": "prod",
                "message": "CPU saturated in ~6h",
                "hours_remaining": 6.0,
                "recommendation": "Scale out",
                "confidence": 72,
            },
        ]
        mock_incidents.return_value = [{
            "object": "payment-api",
            "namespace": "prod",
            "severity": "critical",
            "reason": "healthy_to_critical",
            "health_before": 90,
            "health_after": 30,
            "details": "CrashLoopBackOff",
            "ts": "2024-01-15T10:30:00",
        }]

        result = build_overview()

        # Health weighted: (30*5 + 90*2) / 7 = 47
        assert result.health_score == 47
        assert result.active_risks == 2
        assert result.highest_risk_severity == "critical"
        assert len(result.upcoming_risks) == 2
        assert result.upcoming_risks[0].severity == "critical"
        assert result.upcoming_risks[0].deployment == "payment-api"
        assert len(result.recent_incidents) == 1
        assert result.recent_incidents[0].title == "Critical failure"
        assert result.recent_incidents[0].health_before == 90


class TestBuildOverviewDBUnavailable:
    """Scenario: DuckDB import fails or DB is corrupted."""

    @patch(
        "core.analytics.engine.get_conn",
        side_effect=ImportError("duckdb not installed"),
    )
    def test_import_error(self, mock_conn):
        result = build_overview()
        assert result.empty_state_reason == "analytics_unavailable"
        assert result.health_score == 0
        assert result.active_risks == 0

    @patch(
        "core.analytics.engine.get_conn",
        side_effect=RuntimeError("DB corrupted"),
    )
    def test_runtime_error(self, mock_conn):
        result = build_overview()
        assert result.empty_state_reason == "analytics_unavailable"
        assert result.health_score == 0


# --- Integration: API route ---


class TestAPIRoute:
    """Verify the FastAPI route returns correct shape."""

    @patch("core.analytics.overview.build_overview")
    def test_route_returns_dict(self, mock_build):
        mock_build.return_value = _empty("no_data")

        from api.routes.analytics import get_analytics_overview
        result = get_analytics_overview()

        assert isinstance(result, dict)
        assert "health_score" in result
        assert "empty_state_reason" in result

    @patch("core.analytics.overview.build_overview")
    def test_route_caches(self, mock_build):
        mock_build.return_value = _empty("no_data")

        from api.routes.analytics import (
            get_analytics_overview, _invalidate_overview_cache,
        )
        _invalidate_overview_cache()

        # First call builds
        get_analytics_overview()
        assert mock_build.call_count == 1

        # Second call uses cache
        get_analytics_overview()
        assert mock_build.call_count == 1

        # After invalidation, rebuilds
        _invalidate_overview_cache()
        get_analytics_overview()
        assert mock_build.call_count == 2
