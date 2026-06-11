"""
Change Detection — diffs two InvestigationReports
to surface new, resolved, and persistent findings.

Enables:
    kubsome what-changed payment-api
    kubsome diff payment-api
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime

from core.diagnostics.models import (
    InvestigationReport,
    Finding,
    Severity,
)


@dataclass
class ReportDiff:
    target_name: str
    previous_at: datetime | None
    current_at: datetime
    new_findings: list[Finding] = field(
        default_factory=list
    )
    resolved_findings: list[Finding] = field(
        default_factory=list
    )
    persistent_findings: list[Finding] = field(
        default_factory=list
    )
    escalated_findings: list[Finding] = field(
        default_factory=list
    )
    deescalated_findings: list[Finding] = field(
        default_factory=list
    )

    @property
    def has_changes(self):
        return bool(
            self.new_findings
            or self.resolved_findings
            or self.escalated_findings
            or self.deescalated_findings
        )

    @property
    def summary(self):
        parts = []
        if self.new_findings:
            parts.append(
                f"+{len(self.new_findings)} new"
            )
        if self.resolved_findings:
            parts.append(
                f"-{len(self.resolved_findings)} resolved"
            )
        if self.escalated_findings:
            parts.append(
                f"↑{len(self.escalated_findings)} "
                f"escalated"
            )
        if self.persistent_findings:
            parts.append(
                f"={len(self.persistent_findings)} "
                f"unchanged"
            )
        return ", ".join(parts) if parts else "No changes"


def diff_reports(current, previous=None):
    """
    Compare two InvestigationReports.
    If previous is None, all current findings are 'new'.
    """
    target_name = current.target.name

    if previous is None:
        return ReportDiff(
            target_name=target_name,
            previous_at=None,
            current_at=current.generated_at,
            new_findings=[
                f for f in current.findings
                if f.id != "healthy"
            ],
        )

    # Key findings by finding_type (canonical)
    # Fall back to id for untyped findings
    prev_map = {}
    for f in previous.findings:
        if f.id == "healthy":
            continue
        key = f.finding_type or f.id
        prev_map[key] = f

    curr_map = {}
    for f in current.findings:
        if f.id == "healthy":
            continue
        key = f.finding_type or f.id
        curr_map[key] = f

    prev_keys = set(prev_map.keys())
    curr_keys = set(curr_map.keys())

    new_keys = curr_keys - prev_keys
    resolved_keys = prev_keys - curr_keys
    common_keys = curr_keys & prev_keys

    new_findings = [
        curr_map[k] for k in new_keys
    ]
    resolved_findings = [
        prev_map[k] for k in resolved_keys
    ]

    persistent = []
    escalated = []
    deescalated = []

    severity_rank = {
        Severity.INFO: 0,
        Severity.LOW: 1,
        Severity.MEDIUM: 2,
        Severity.HIGH: 3,
        Severity.CRITICAL: 4,
    }

    for k in common_keys:
        curr_f = curr_map[k]
        prev_f = prev_map[k]
        curr_rank = severity_rank.get(
            curr_f.severity, 0
        )
        prev_rank = severity_rank.get(
            prev_f.severity, 0
        )

        if curr_rank > prev_rank:
            escalated.append(curr_f)
        elif curr_rank < prev_rank:
            deescalated.append(curr_f)
        else:
            persistent.append(curr_f)

    return ReportDiff(
        target_name=target_name,
        previous_at=previous.generated_at,
        current_at=current.generated_at,
        new_findings=new_findings,
        resolved_findings=resolved_findings,
        persistent_findings=persistent,
        escalated_findings=escalated,
        deescalated_findings=deescalated,
    )


def what_changed(target):
    """
    Compare latest two snapshots for a resource.
    Returns ReportDiff or None if no history.
    """
    from core.diagnostics import snapshots

    reports = snapshots.history(target, limit=2)
    if not reports:
        return None

    current = reports[0]
    previous = reports[1] if len(reports) > 1 else None

    return diff_reports(current, previous)
