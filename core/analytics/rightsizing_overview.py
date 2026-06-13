"""
Rightsizing Overview — single aggregated payload for the
Right-Sizing landing page. Decision-centric, not data-centric.

Answers:
  1. How much can I save?
  2. What can break?
  3. What can I safely change today?
"""

from __future__ import annotations
from dataclasses import dataclass, field, asdict
from datetime import datetime, timezone
from typing import Literal


# --- Domain Contract ---


@dataclass
class OpportunityItem:
    deployment: str
    namespace: str
    savings_monthly: float
    confidence: int
    risk: Literal["low", "medium", "high"]
    reason: str
    score: float              # savings * confidence / 100
    cpu_current: int          # millicores
    cpu_recommended: int
    cpu_limit_recommended: int
    mem_current: int          # Mi
    mem_recommended: int
    mem_limit_recommended: int
    cpu_p95: int
    mem_p95: int
    pods: int
    workload_type: str
    cpu_volatile: bool
    mem_volatile: bool


@dataclass
class RiskWorkload:
    deployment: str
    namespace: str
    severity: Literal["critical", "high", "medium"]
    resource: str             # "memory", "cpu"
    utilization_pct: float
    request: int
    p95: int
    unit: str                 # "Mi", "m"
    restarts: int
    action: str               # "Increase mem to 650Mi"


@dataclass
class ExecutionPhase:
    label: str
    count: int
    savings_monthly: float
    auto_apply: bool
    items: list[ExecutionItem] = field(default_factory=list)


@dataclass
class ExecutionItem:
    deployment: str
    namespace: str
    savings_monthly: float
    confidence: int
    risk: str


@dataclass
class RightsizingOverview:
    # Hero
    deployments_analyzed: int
    total_savings_monthly: float
    at_risk_count: int
    safe_to_apply: int

    # Sections
    opportunities: list[OpportunityItem] = field(
        default_factory=list
    )
    risks: list[RiskWorkload] = field(default_factory=list)
    execution: list[ExecutionPhase] = field(
        default_factory=list
    )

    # Meta
    generated_at: str = ""
    data_freshness_seconds: int = 0
    empty_state_reason: str | None = None

    def to_dict(self):
        return asdict(self)


# --- Composer ---


def build_rightsizing_overview(
    days: int = 7, namespace: str | None = None
) -> RightsizingOverview:
    """
    Compose rightsizing overview from existing modules.
    Orchestration only.
    """
    try:
        from core.analytics.engine import get_conn
        get_conn()
    except (ImportError, Exception):
        return _empty("analytics_unavailable")

    from core.analytics.rightsizing import (
        pod_rightsizing, underprovisioned, safe_rollout_plan,
        usage_summary,
    )

    now = datetime.now(timezone.utc)

    # --- Recommendations ---
    recs = _safe(
        lambda: pod_rightsizing(days=days, namespace=namespace),
        []
    )

    # --- At risk ---
    at_risk = _safe(
        lambda: underprovisioned(days=days, namespace=namespace),
        []
    )

    # --- Rollout plan ---
    plan = safe_rollout_plan(recs) if recs else {}

    # --- Summary ---
    summary = _safe(
        lambda: usage_summary(days=days, namespace=namespace),
        {"deployments": 0}
    )

    # --- Build opportunities (sorted by score) ---
    opportunities = []
    for r in recs:
        score = r["total_savings_monthly"] * r["confidence"] / 100
        opportunities.append(OpportunityItem(
            deployment=r["deployment"],
            namespace=r["namespace"],
            savings_monthly=r["total_savings_monthly"],
            confidence=r["confidence"],
            risk=r["risk"],
            reason=r.get("reason", ""),
            score=round(score, 2),
            cpu_current=r["current"]["cpu_request"],
            cpu_recommended=r["recommended"]["cpu_request"],
            cpu_limit_recommended=r["recommended"]["cpu_limit"],
            mem_current=r["current"]["mem_request"],
            mem_recommended=r["recommended"]["mem_request"],
            mem_limit_recommended=r["recommended"]["mem_limit"],
            cpu_p95=r["usage"]["cpu_p95"],
            mem_p95=r["usage"]["mem_p95"],
            pods=r.get("pods", 1),
            workload_type=r.get("workload_type", "deployment"),
            cpu_volatile=r["usage"].get("cpu_volatile", False),
            mem_volatile=r["usage"].get("mem_volatile", False),
        ))
    opportunities.sort(key=lambda o: o.score, reverse=True)

    # --- Build risks (grouped by severity) ---
    sev_rank = {"critical": 0, "high": 1, "medium": 2}
    risks = []
    for item in at_risk:
        mem_pct = item.get("mem_util_pct") or 0
        cpu_pct = item.get("cpu_util_pct") or 0

        if mem_pct >= 95 or cpu_pct >= 95:
            severity = "critical"
        elif mem_pct >= 90 or cpu_pct >= 90:
            severity = "high"
        else:
            severity = "medium"

        # Pick dominant resource
        if mem_pct >= cpu_pct:
            resource, util, req, p95, unit = (
                "memory", mem_pct,
                item.get("mem_request", 0),
                item.get("mem_p95", 0), "Mi"
            )
        else:
            resource, util, req, p95, unit = (
                "cpu", cpu_pct,
                item.get("cpu_request", 0),
                item.get("cpu_p95", 0), "m"
            )

        risks.append(RiskWorkload(
            deployment=item["deployment"],
            namespace=item["namespace"],
            severity=severity,
            resource=resource,
            utilization_pct=util,
            request=req,
            p95=p95,
            unit=unit,
            restarts=item.get("restarts", 0),
            action=item.get("action", "Review resource limits"),
        ))
    risks.sort(key=lambda r: sev_rank.get(r.severity, 9))

    # --- Build execution phases ---
    execution = []
    safe_count = 0
    for phase_key in ("phase_1", "phase_2", "phase_3"):
        phase = plan.get(phase_key, {})
        items = phase.get("items", [])
        phase_savings = sum(
            i.get("total_savings_monthly", 0) for i in items
        )
        auto = phase.get("auto_apply", False)

        if phase_key == "phase_1":
            safe_count = len(items)

        execution.append(ExecutionPhase(
            label=phase.get("label", phase_key),
            count=len(items),
            savings_monthly=round(phase_savings, 2),
            auto_apply=auto,
            items=[
                ExecutionItem(
                    deployment=i["deployment"],
                    namespace=i["namespace"],
                    savings_monthly=i.get(
                        "total_savings_monthly", 0
                    ),
                    confidence=i.get("confidence", 0),
                    risk=i.get("risk", "medium"),
                )
                for i in items
            ],
        ))

    # --- Freshness ---
    freshness = _get_freshness()

    # --- Empty state ---
    has_data = bool(recs or at_risk)
    empty_reason = None if has_data else "no_data"

    return RightsizingOverview(
        deployments_analyzed=summary.get("deployments", 0),
        total_savings_monthly=round(
            sum(r.savings_monthly for r in opportunities), 2
        ),
        at_risk_count=len(risks),
        safe_to_apply=safe_count,
        opportunities=opportunities,
        risks=risks,
        execution=execution,
        generated_at=now.isoformat(),
        data_freshness_seconds=freshness,
        empty_state_reason=empty_reason,
    )


# --- Helpers ---


def _get_freshness() -> int:
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
        return max(0, int((now - last).total_seconds()))
    except Exception:
        return 0


def _empty(reason: str) -> RightsizingOverview:
    return RightsizingOverview(
        deployments_analyzed=0,
        total_savings_monthly=0.0,
        at_risk_count=0,
        safe_to_apply=0,
        generated_at=datetime.now(timezone.utc).isoformat(),
        data_freshness_seconds=0,
        empty_state_reason=reason,
    )


def _safe(fn, default):
    try:
        return fn()
    except Exception:
        return default
