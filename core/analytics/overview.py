"""
Analytics Overview — single aggregated payload for the
Analytics landing page. Composes data from health, cost,
predictive, and incident modules into one response.

No presentation formatting. Angular owns display decisions.
"""

from __future__ import annotations
from dataclasses import dataclass, field, asdict
from datetime import datetime, timezone
from typing import Literal

# Severity rank for sorting
_SEV_RANK = {"critical": 0, "high": 1, "medium": 2}

# Incident reason → human title mapping
_INCIDENT_TITLES = {
    "healthy_to_warning": "Degraded from healthy",
    "healthy_to_degraded": "Degraded from healthy",
    "healthy_to_critical": "Critical failure",
    "warning_to_degraded": "Further degradation",
    "warning_to_critical": "Escalated to critical",
    "health_drop": "Health score dropped",
    "restart_spike": "Restart spike detected",
    "oomkill": "OOMKilled",
}


# --- Domain Contract ---


@dataclass
class ChangeItem:
    deployment: str
    namespace: str
    metric: str
    delta_pct: float
    trend: Literal["up", "down"]
    current_value: float
    previous_value: float
    unit: str


@dataclass
class CostOpportunity:
    deployment: str
    namespace: str
    action: str
    savings_monthly: float
    confidence: int
    risk: Literal["low", "medium", "high"]


@dataclass
class RiskItem:
    deployment: str
    namespace: str
    risk_type: str
    severity: Literal["critical", "high", "medium"]
    hours_remaining: float
    message: str
    recommendation: str
    confidence: int


@dataclass
class IncidentItem:
    deployment: str
    namespace: str
    severity: str
    title: str
    description: str
    health_before: int
    health_after: int
    occurred_at: str


@dataclass
class AnalyticsOverview:
    health_score: int
    cost_delta_monthly: float
    active_risks: int
    highest_risk_severity: str | None
    biggest_change: ChangeItem | None

    top_changes: list[ChangeItem] = field(default_factory=list)
    cost_opportunities: list[CostOpportunity] = field(
        default_factory=list
    )
    upcoming_risks: list[RiskItem] = field(default_factory=list)
    recent_incidents: list[IncidentItem] = field(
        default_factory=list
    )

    generated_at: str = ""
    data_freshness_seconds: int = 0
    empty_state_reason: str | None = None

    def to_dict(self):
        return asdict(self)


# --- Composer ---


def build_overview() -> AnalyticsOverview:
    """
    Compose overview from existing domain modules.
    Orchestration only — no direct DuckDB queries.
    """
    try:
        from core.analytics.engine import get_conn
        get_conn()
    except ImportError:
        return _empty("analytics_unavailable")
    except Exception:
        return _empty("analytics_unavailable")

    from core.analytics.health import (
        deployment_health_current, open_incidents,
    )
    from core.analytics.predictive import check_predictive_alerts
    from core.analytics.rightsizing import pod_rightsizing

    now = datetime.now(timezone.utc)

    # --- Health score (resource-weighted) ---
    dep_health = _safe(deployment_health_current, [])
    health_score = _weighted_health(dep_health)

    # --- Cost delta ---
    cost_delta = _compute_cost_delta()

    # --- Predictions → risks ---
    predictions = _safe(check_predictive_alerts, [])
    predictions.sort(
        key=lambda p: _SEV_RANK.get(p.get("severity", ""), 9)
    )

    upcoming_risks = [
        RiskItem(
            deployment=p["deployment"],
            namespace=p["namespace"],
            risk_type=p["type"],
            severity=p["severity"],
            hours_remaining=p.get("hours_remaining", 0),
            message=p["message"],
            recommendation=p.get("recommendation", ""),
            confidence=p.get("confidence", 0),
        )
        for p in predictions[:5]
    ]

    highest_risk_severity = (
        predictions[0]["severity"] if predictions else None
    )

    # --- Cost opportunities ---
    recs = _safe(lambda: pod_rightsizing(days=7), [])
    cost_opportunities = [
        CostOpportunity(
            deployment=r["deployment"],
            namespace=r["namespace"],
            action=_opportunity_action(r),
            savings_monthly=r["total_savings_monthly"],
            confidence=r["confidence"],
            risk=r["risk"],
        )
        for r in recs[:5]
    ]

    # --- Changes since yesterday ---
    top_changes = _compute_changes()

    # --- Recent incidents ---
    incidents_raw = _safe(open_incidents, [])
    recent_incidents = [
        _map_incident(i) for i in incidents_raw[:5]
    ]

    # --- Biggest change ---
    biggest_change = top_changes[0] if top_changes else None

    # --- Freshness ---
    freshness = _get_freshness_seconds()

    # --- Empty state ---
    has_data = bool(
        dep_health or top_changes or predictions or recs
    )
    empty_reason = None if has_data else "no_data"

    return AnalyticsOverview(
        health_score=health_score,
        cost_delta_monthly=cost_delta,
        active_risks=len(predictions),
        highest_risk_severity=highest_risk_severity,
        biggest_change=biggest_change,
        top_changes=top_changes[:5],
        cost_opportunities=cost_opportunities,
        upcoming_risks=upcoming_risks,
        recent_incidents=recent_incidents,
        generated_at=now.isoformat(),
        data_freshness_seconds=freshness,
        empty_state_reason=empty_reason,
    )


# --- Private Helpers ---


def _weighted_health(dep_health: list) -> int:
    """
    Resource-weighted health score.
    Weight = cpu_request + mem_request equivalent.
    Falls back to equal weighting if resource data missing.
    """
    if not dep_health:
        return 100

    total_weight = 0
    weighted_sum = 0

    for d in dep_health:
        # Use pod_count as proxy weight when requests
        # aren't available in the health snapshot
        weight = max(d.get("pod_count", 1), 1)
        weighted_sum += d["health_score"] * weight
        total_weight += weight

    if total_weight == 0:
        return 100

    return int(weighted_sum / total_weight)


def _compute_cost_delta() -> float:
    """
    Compare current 30d cost vs prior 30d cost.
    Returns delta in $/month (positive = spending more).
    """
    try:
        from core.analytics.engine import execute_one
        from core.context import context

        ctx = context.current_context
        ctx_filter = (
            f"AND context = '{ctx}'" if ctx else ""
        )

        row = execute_one(f"""
            SELECT
                COALESCE(SUM(CASE
                    WHEN day >= CURRENT_DATE - INTERVAL '30 days'
                    THEN cost_estimate_usd END), 0) AS current_30d,
                COALESCE(SUM(CASE
                    WHEN day >= CURRENT_DATE - INTERVAL '60 days'
                    AND day < CURRENT_DATE - INTERVAL '30 days'
                    THEN cost_estimate_usd END), 0) AS previous_30d
            FROM daily_summary
            WHERE day >= CURRENT_DATE - INTERVAL '60 days'
              {ctx_filter}
        """)

        if not row or row[0] is None:
            return 0.0

        current = row[0] or 0
        previous = row[1] or 0
        return round(current - previous, 2)
    except Exception:
        return 0.0


def _compute_changes() -> list[ChangeItem]:
    """
    Top resource changes: last 24h vs prior 24h.
    Returns up to 5 items sorted by abs(delta_pct).
    """
    try:
        from core.analytics.engine import execute
        from core.context import context

        ctx = context.current_context
        ctx_filter = (
            f"AND context = '{ctx}'" if ctx else ""
        )

        rows = execute(f"""
            WITH recent AS (
                SELECT deployment, namespace,
                    AVG(cpu_avg)::INTEGER AS cpu,
                    AVG(mem_avg)::INTEGER AS mem
                FROM hourly_pod_metrics
                WHERE hour >= NOW() - INTERVAL '24 hours'
                  AND deployment != ''
                  {ctx_filter}
                GROUP BY deployment, namespace
            ),
            prior AS (
                SELECT deployment, namespace,
                    AVG(cpu_avg)::INTEGER AS cpu,
                    AVG(mem_avg)::INTEGER AS mem
                FROM hourly_pod_metrics
                WHERE hour >= NOW() - INTERVAL '48 hours'
                  AND hour < NOW() - INTERVAL '24 hours'
                  AND deployment != ''
                  {ctx_filter}
                GROUP BY deployment, namespace
            )
            SELECT
                r.deployment, r.namespace,
                r.cpu AS cpu_now, p.cpu AS cpu_prev,
                r.mem AS mem_now, p.mem AS mem_prev
            FROM recent r
            JOIN prior p
              ON r.deployment = p.deployment
              AND r.namespace = p.namespace
            WHERE p.cpu > 0 OR p.mem > 0
        """)

        changes = []
        for row in rows:
            deploy, ns = row[0], row[1]
            cpu_now, cpu_prev = row[2] or 0, row[3] or 0
            mem_now, mem_prev = row[4] or 0, row[5] or 0

            # Pick the larger % change between cpu and mem
            cpu_pct = (
                (cpu_now - cpu_prev) * 100.0 / cpu_prev
                if cpu_prev > 0 else 0
            )
            mem_pct = (
                (mem_now - mem_prev) * 100.0 / mem_prev
                if mem_prev > 0 else 0
            )

            if abs(mem_pct) >= abs(cpu_pct) and mem_prev > 0:
                changes.append(ChangeItem(
                    deployment=deploy,
                    namespace=ns,
                    metric="memory",
                    delta_pct=round(mem_pct, 1),
                    trend="up" if mem_pct > 0 else "down",
                    current_value=float(mem_now),
                    previous_value=float(mem_prev),
                    unit="Mi",
                ))
            elif cpu_prev > 0:
                changes.append(ChangeItem(
                    deployment=deploy,
                    namespace=ns,
                    metric="cpu",
                    delta_pct=round(cpu_pct, 1),
                    trend="up" if cpu_pct > 0 else "down",
                    current_value=float(cpu_now),
                    previous_value=float(cpu_prev),
                    unit="m",
                ))

        # Sort by absolute delta, filter out noise (<5%)
        changes = [
            c for c in changes if abs(c.delta_pct) >= 5.0
        ]
        changes.sort(key=lambda c: abs(c.delta_pct), reverse=True)
        return changes[:5]
    except Exception:
        return []


def _get_freshness_seconds() -> int:
    """Seconds since last collection."""
    try:
        from core.analytics.engine import execute_one

        row = execute_one(
            "SELECT MAX(ts) FROM collection_log"
        )
        if not row or not row[0]:
            return 0

        last = row[0]
        if isinstance(last, str):
            last = datetime.fromisoformat(last)

        if last.tzinfo is None:
            now = datetime.utcnow()
        else:
            now = datetime.now(timezone.utc)

        delta = (now - last).total_seconds()
        return max(0, int(delta))
    except Exception:
        return 0


def _opportunity_action(rec: dict) -> str:
    """Build action string from rightsizing recommendation."""
    cpu_dir = rec.get("direction", {}).get("cpu", "keep")
    mem_dir = rec.get("direction", {}).get("mem", "keep")
    if cpu_dir != "keep" and mem_dir != "keep":
        return "right-size cpu+memory"
    if cpu_dir != "keep":
        return f"right-size cpu ({cpu_dir})"
    if mem_dir != "keep":
        return f"right-size memory ({mem_dir})"
    return "review resources"


def _map_incident(i: dict) -> IncidentItem:
    """Map raw incident candidate to IncidentItem."""
    reason = i.get("reason", "")
    health_before = i.get("health_before", 0)
    health_after = i.get("health_after", 0)

    # Resolve title
    title = "Health change detected"
    for key, t in _INCIDENT_TITLES.items():
        if key in reason:
            title = t
            break

    # Build description
    details = i.get("details", "")
    desc = f"{health_before} → {health_after}"
    if details:
        desc += f" ({details})"

    return IncidentItem(
        deployment=i.get("object", ""),
        namespace=i.get("namespace", ""),
        severity=i.get("severity", "medium"),
        title=title,
        description=desc,
        health_before=health_before,
        health_after=health_after,
        occurred_at=i.get("ts", ""),
    )


def _empty(reason: str) -> AnalyticsOverview:
    """Return empty overview with reason."""
    return AnalyticsOverview(
        health_score=0,
        cost_delta_monthly=0.0,
        active_risks=0,
        highest_risk_severity=None,
        biggest_change=None,
        generated_at=datetime.now(timezone.utc).isoformat(),
        data_freshness_seconds=0,
        empty_state_reason=reason,
    )


def _safe(fn, default):
    """Call fn, return default on any exception."""
    try:
        return fn()
    except Exception:
        return default
