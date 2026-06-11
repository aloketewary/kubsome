"""
Alert Enrichment — consumes external alerts and attaches
investigation context (findings, narrative, recommendations).

Does NOT:
    - Define alert rules
    - Route alerts
    - Schedule or escalate

Only enriches alerts with Kubsome investigation artifacts.
"""

from dataclasses import dataclass, field
from datetime import datetime, timezone

from core.diagnostics.models import (
    ResourceRef,
    InvestigationReport,
    Severity,
)
from core.diagnostics.narrative import (
    InvestigationNarrative,
)
from core.diagnostics.registry import FindingType


@dataclass
class Alert:
    """External alert representation."""
    source: str          # "prometheus", "alertmanager", etc.
    name: str            # alert name
    resource_name: str   # affected resource
    namespace: str
    message: str
    fired_at: datetime
    labels: dict = field(default_factory=dict)


@dataclass
class EnrichedAlert:
    """Alert with investigation context attached."""
    alert: Alert
    report: InvestigationReport | None
    narrative: InvestigationNarrative | None
    top_findings: list[str] = field(
        default_factory=list
    )
    recommended_action: str = ""
    action_risk: str = ""
    enriched_at: datetime = field(
        default_factory=lambda: datetime.now(
            timezone.utc
        )
    )

    @property
    def has_context(self):
        return self.report is not None


def enrich(alert):
    """
    Enrich an alert with investigation artifacts.

    Flow:
        Alert → Investigate → Attach Findings → Narrative
    """
    from core.diagnostics.engine import investigate
    from core.diagnostics.narrative import explain
    from core.diagnostics.changes import what_changed
    from core.collectors.diagnosis import (
        collect_diagnosis,
    )
    from core.resolver import resolve_pod_name

    # Resolve resource
    matches = resolve_pod_name(alert.resource_name)
    if not matches:
        return EnrichedAlert(
            alert=alert,
            report=None,
            narrative=None,
        )

    pod_name = matches[0]

    # Collect and investigate
    data = collect_diagnosis(pod_name)
    if not data:
        return EnrichedAlert(
            alert=alert,
            report=None,
            narrative=None,
        )

    report = investigate(data)
    if not report:
        return EnrichedAlert(
            alert=alert,
            report=None,
            narrative=None,
        )

    # Build narrative with diff context
    target = report.target
    diff = what_changed(target)
    narrative = explain(report, diff=diff)

    # Extract top findings and recommendation
    critical = [
        f for f in report.findings
        if f.severity in (
            Severity.CRITICAL, Severity.HIGH
        )
        and f.id != "healthy"
    ]

    top_findings = [
        f"{f.severity.value.upper()}: {f.title}"
        for f in critical[:5]
    ]

    # First recommendation from report
    action = ""
    risk = ""
    if report.recommendations:
        action = report.recommendations[0].action
        risk = report.recommendations[0].risk.value

    return EnrichedAlert(
        alert=alert,
        report=report,
        narrative=narrative,
        top_findings=top_findings,
        recommended_action=action,
        action_risk=risk,
    )


def enrich_from_report(alert, report):
    """
    Enrich an alert with a pre-existing report.
    Use when investigation already happened.
    """
    from core.diagnostics.narrative import explain
    from core.diagnostics.changes import what_changed

    target = report.target
    diff = what_changed(target)
    narrative = explain(report, diff=diff)

    critical = [
        f for f in report.findings
        if f.severity in (
            Severity.CRITICAL, Severity.HIGH
        )
        and f.id != "healthy"
    ]

    top_findings = [
        f"{f.severity.value.upper()}: {f.title}"
        for f in critical[:5]
    ]

    action = ""
    risk = ""
    if report.recommendations:
        action = report.recommendations[0].action
        risk = report.recommendations[0].risk.value

    return EnrichedAlert(
        alert=alert,
        report=report,
        narrative=narrative,
        top_findings=top_findings,
        recommended_action=action,
        action_risk=risk,
    )


def format_enrichment(enriched):
    """
    Format enriched alert as text block.
    Suitable for Slack, terminal, or log output.
    """
    if not enriched.has_context:
        return (
            f"{enriched.alert.name}\n"
            f"{enriched.alert.message}\n"
            f"(No investigation context available)"
        )

    lines = [
        f"{enriched.alert.name}",
        f"{enriched.alert.message}",
        "",
        "Investigation:",
    ]

    for f in enriched.top_findings:
        lines.append(f"  ✓ {f}")

    if enriched.narrative and \
            enriched.narrative.likely_sequence:
        lines.append("")
        lines.append("Likely Sequence:")
        for step in enriched.narrative.likely_sequence:
            lines.append(f"  {step}")

    if enriched.recommended_action:
        lines.append("")
        lines.append(
            f"Recommended Action: "
            f"{enriched.recommended_action}"
        )
        lines.append(
            f"Risk: {enriched.action_risk}"
        )

    return "\n".join(lines)
