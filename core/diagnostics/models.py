"""
Investigation Report domain models.

Core objects that flow through diagnose → evidence → plan → execute.
All interfaces (CLI, TUI, API, Web UI) render the same report.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Any, Optional

SCHEMA_VERSION = "1"


class Severity(Enum):
    CRITICAL = "critical"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"
    INFO = "info"


class Risk(Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    DANGEROUS = "dangerous"


class ObservationSource(Enum):
    EVENT = "event"
    LOG = "log"
    METRICS = "metrics"
    RESOURCE = "resource"
    CONFIG = "config"
    CORRELATED_LOG = "correlated_log"
    CROSS_SERVICE_EVENT = "cross_service_event"


@dataclass
class ResourceRef:
    kind: str
    name: str
    namespace: str
    context: str


@dataclass
class Observation:
    id: str
    source: ObservationSource
    message: str
    timestamp: datetime | None = None
    verified: bool = True
    raw_ref: str = ""
    metadata: dict[str, Any] = field(
        default_factory=dict
    )


@dataclass
class Finding:
    id: str
    severity: Severity
    title: str
    conclusion: str
    finding_type: str | None = None
    evidence_ids: list[str] = field(
        default_factory=list
    )
    related_finding_ids: list[str] = field(
        default_factory=list
    )
    verification_commands: list[str] = field(
        default_factory=list
    )


@dataclass
class Recommendation:
    id: str
    finding_id: str
    action: str
    risk: Risk


@dataclass
class ExecutionPlan:
    id: str
    finding_ids: list[str]
    steps: list[str]
    risk: Risk
    reversible: bool = True


class ValidationError(Exception):
    """Raised when report integrity checks fail."""
    pass


@dataclass
class InvestigationReport:
    target: ResourceRef
    generated_at: datetime
    schema_version: str = SCHEMA_VERSION
    observations: list[Observation] = field(
        default_factory=list
    )
    findings: list[Finding] = field(
        default_factory=list
    )
    recommendations: list[Recommendation] = field(
        default_factory=list
    )
    execution_plans: list[ExecutionPlan] = field(
        default_factory=list
    )

    @property
    def severity_counts(self):
        counts = {}
        for f in self.findings:
            counts[f.severity] = counts.get(
                f.severity, 0
            ) + 1
        return counts

    @property
    def has_critical(self):
        return any(
            f.severity == Severity.CRITICAL
            for f in self.findings
        )

    def validate(self):
        """
        Enforce report integrity.
        Raises ValidationError on failure.
        """
        errors = []
        obs_ids = {o.id for o in self.observations}
        finding_ids = {f.id for f in self.findings}

        # Every finding must have evidence
        for f in self.findings:
            if f.id == "healthy":
                continue
            if not f.evidence_ids:
                errors.append(
                    f"Finding '{f.id}' has no evidence"
                )
            for eid in f.evidence_ids:
                if eid not in obs_ids:
                    errors.append(
                        f"Finding '{f.id}' references "
                        f"missing observation '{eid}'"
                    )
            for rid in f.related_finding_ids:
                if rid not in finding_ids:
                    errors.append(
                        f"Finding '{f.id}' references "
                        f"missing related finding "
                        f"'{rid}'"
                    )

        # Every recommendation must reference valid finding
        for r in self.recommendations:
            if r.finding_id not in finding_ids:
                errors.append(
                    f"Recommendation '{r.id}' references "
                    f"missing finding '{r.finding_id}'"
                )

        # Every plan must reference valid findings
        for p in self.execution_plans:
            for fid in p.finding_ids:
                if fid not in finding_ids:
                    errors.append(
                        f"ExecutionPlan '{p.id}' "
                        f"references missing finding "
                        f"'{fid}'"
                    )

        if errors:
            raise ValidationError(
                f"{len(errors)} integrity errors:\n"
                + "\n".join(
                    f"  - {e}" for e in errors
                )
            )


@dataclass
class ServiceInvestigationReport(InvestigationReport):
    """Service-level report containing child pod reports."""
    affected_pods: list[ResourceRef] = field(
        default_factory=list
    )
    child_reports: list[InvestigationReport] = field(
        default_factory=list
    )


def make_observation_id(source, reason, container=""):
    """
    Generate stable observation IDs from content.
    Enables cross-referencing across reports.
    """
    parts = [source.value, reason]
    if container:
        parts.append(container)
    return "obs_" + "_".join(
        p.lower().replace(" ", "_")
        for p in parts
    )
