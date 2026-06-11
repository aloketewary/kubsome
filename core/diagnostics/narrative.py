"""
AI Explanation Layer — interprets investigation artifacts
into human-readable narratives.

Rules:
    - Never creates findings, recommendations, or plans
    - Never accesses cluster state directly
    - Only explains existing observations, findings, and diffs

Input: InvestigationReport + Previous Report + Diff + Timeline
Output: InvestigationNarrative
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime

from core.diagnostics.models import (
    InvestigationReport,
    Finding,
    Severity,
)
from core.diagnostics.changes import ReportDiff
from core.diagnostics.registry import (
    FindingType,
    get_explanation,
)


@dataclass
class InvestigationNarrative:
    summary: str
    likely_sequence: list[str] = field(
        default_factory=list
    )
    priority_findings: list[str] = field(
        default_factory=list
    )
    change_summary: str = ""
    generated_at: datetime | None = None


# Severity ordering for prioritization
_SEVERITY_RANK = {
    Severity.CRITICAL: 4,
    Severity.HIGH: 3,
    Severity.MEDIUM: 2,
    Severity.LOW: 1,
    Severity.INFO: 0,
}

# Causal ordering — if A causes B, A comes first
_CAUSAL_ORDER = [
    FindingType.OOM_KILL.value,
    FindingType.MISSING_SECRET.value,
    FindingType.MISSING_CONFIGMAP.value,
    FindingType.CONFIG_ERROR.value,
    FindingType.IMAGE_PULL_ERROR.value,
    FindingType.INIT_CONTAINER_FAILED.value,
    FindingType.RBAC_DENIED.value,
    FindingType.UPSTREAM_DEPENDENCY_FAILURE.value,
    FindingType.FAILED_MOUNT.value,
    FindingType.PVC_PENDING.value,
    FindingType.FAILED_SCHEDULING.value,
    FindingType.NODE_PRESSURE.value,
    FindingType.PENDING_POD.value,
    FindingType.EXIT_NONZERO.value,
    FindingType.LIVENESS_FAILING.value,
    FindingType.READINESS_FAILING.value,
    FindingType.PROBE_FAILING.value,
    FindingType.DNS_FAILURE.value,
    FindingType.NETWORK_POLICY_BLOCKED.value,
    FindingType.DOWNSTREAM_TIMEOUT.value,
    FindingType.HIGH_RESTARTS.value,
    FindingType.CRASH_LOOP.value,
    FindingType.CASCADING_FAILURE.value,
    FindingType.EVICTED.value,
    FindingType.RESOURCE_QUOTA_EXCEEDED.value,
    FindingType.HIGH_ERROR_RATE.value,
    FindingType.ERRORS_IN_LOGS.value,
    FindingType.SERVICE_ENDPOINT_MISSING.value,
    FindingType.NO_RESOURCE_LIMITS.value,
    FindingType.NO_PROBES.value,
]


def explain(report, previous=None, diff=None,
            timeline=None):
    """
    Generate an InvestigationNarrative from investigation
    artifacts. AI interprets — never decides.
    """
    if not report or not report.findings:
        return InvestigationNarrative(
            summary="No issues found.",
            generated_at=report.generated_at
            if report else None,
        )

    # Filter non-healthy findings
    findings = [
        f for f in report.findings
        if f.id != "healthy"
    ]

    if not findings:
        return InvestigationNarrative(
            summary=(
                f"{report.target.name} appears healthy. "
                f"No issues detected."
            ),
            generated_at=report.generated_at,
        )

    # Build summary
    summary = _build_summary(report, findings, diff)

    # Build likely sequence (causal chain)
    sequence = _build_sequence(
        findings, report, timeline
    )

    # Priority ordering
    priority = _build_priority(findings)

    # Change summary
    change_text = _build_change_summary(diff)

    return InvestigationNarrative(
        summary=summary,
        likely_sequence=sequence,
        priority_findings=priority,
        change_summary=change_text,
        generated_at=report.generated_at,
    )


def _build_summary(report, findings, diff):
    """Build a one-sentence summary."""
    target = report.target.name
    critical = [
        f for f in findings
        if f.severity == Severity.CRITICAL
    ]

    if not critical:
        return (
            f"{target} has "
            f"{len(findings)} minor issue(s)."
        )

    # Use the highest-priority finding for summary
    primary = _primary_cause(critical)

    if diff and diff.new_findings:
        return (
            f"{target} became unhealthy: "
            f"{primary.title}."
        )

    return (
        f"{target} is unhealthy: "
        f"{primary.title}."
    )


def _build_sequence(findings, report, timeline):
    """
    Build a likely causal sequence from findings
    and timeline events.
    """
    # Sort findings by causal order
    typed = [
        f for f in findings if f.finding_type
    ]

    def causal_rank(f):
        try:
            return _CAUSAL_ORDER.index(
                f.finding_type
            )
        except ValueError:
            return 999

    sorted_findings = sorted(typed, key=causal_rank)

    sequence = []
    for f in sorted_findings:
        # Get registry explanation for context
        try:
            ft = FindingType(f.finding_type)
            explanation = get_explanation(ft)
        except (ValueError, KeyError):
            explanation = ""

        step = f.conclusion
        if explanation:
            # Add brief cause from registry
            first_sentence = explanation.split(".")[0]
            step = f"{f.title}. {first_sentence}."

        sequence.append(step)

    return sequence


def _build_priority(findings):
    """Rank findings by severity and causal importance."""
    ranked = sorted(
        [f for f in findings if f.id != "healthy"],
        key=lambda f: (
            -_SEVERITY_RANK.get(f.severity, 0),
            _causal_position(f),
        ),
    )
    return [
        f"{f.severity.value.upper()}: {f.title}"
        for f in ranked
    ]


def _build_change_summary(diff):
    """Summarize what changed since last investigation."""
    if not diff:
        return ""

    parts = []
    if diff.new_findings:
        names = [
            f.finding_type or f.title
            for f in diff.new_findings
        ]
        parts.append(
            f"New: {', '.join(names)}"
        )
    if diff.resolved_findings:
        names = [
            f.finding_type or f.title
            for f in diff.resolved_findings
        ]
        parts.append(
            f"Resolved: {', '.join(names)}"
        )
    if diff.escalated_findings:
        names = [
            f.finding_type or f.title
            for f in diff.escalated_findings
        ]
        parts.append(
            f"Escalated: {', '.join(names)}"
        )

    return " | ".join(parts) if parts else "No changes."


def _primary_cause(findings):
    """Find the most likely root cause finding."""
    typed = [f for f in findings if f.finding_type]
    if not typed:
        return findings[0]

    # Pick the one highest in causal order
    def rank(f):
        try:
            return _CAUSAL_ORDER.index(
                f.finding_type
            )
        except ValueError:
            return 999

    return min(typed, key=rank)


def _causal_position(f):
    """Lower = more likely root cause."""
    if not f.finding_type:
        return 999
    try:
        return _CAUSAL_ORDER.index(f.finding_type)
    except ValueError:
        return 999
