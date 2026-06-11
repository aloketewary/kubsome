"""
Incident Mode — Kubernetes incident reconstruction
from investigation artifacts.

Scope: reconstruct what happened, not manage workflows.
No PagerDuty, no Jira, no external integrations yet.

Auto-creates incidents from clustered critical findings.
"""

from __future__ import annotations

import json
import os
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone, timedelta
from enum import Enum
from pathlib import Path

from core.diagnostics.models import (
    ResourceRef,
    InvestigationReport,
    Finding,
    Severity,
    SCHEMA_VERSION,
)


INCIDENTS_DIR = os.path.expanduser(
    "~/.kubsome/incidents"
)

# Auto-create if N critical findings within this window
AUTO_CREATE_THRESHOLD = 2
AUTO_CREATE_WINDOW = timedelta(minutes=10)


class IncidentStatus(Enum):
    ACTIVE = "active"
    INVESTIGATING = "investigating"
    RESOLVED = "resolved"


class TimelineEventType(Enum):
    INCIDENT_OPENED = "incident_opened"
    INCIDENT_RESOLVED = "incident_resolved"
    FINDING_NEW = "finding_new"
    FINDING_RESOLVED = "finding_resolved"
    FINDING_ESCALATED = "finding_escalated"
    OOM_KILL = "oom_kill"
    PROBE_FAILURE = "probe_failure"
    CRASH_LOOP = "crash_loop"
    DEPLOYMENT_ROLLOUT = "deployment_rollout"
    RESTART = "restart"
    NOTE_ADDED = "note_added"


@dataclass
class TimelineEvent:
    timestamp: datetime
    event_type: TimelineEventType
    resource: str
    message: str
    metadata: dict = field(default_factory=dict)


@dataclass
class Incident:
    id: str
    started_at: datetime
    status: IncidentStatus
    title: str
    affected_resources: list[ResourceRef] = field(
        default_factory=list
    )
    timeline: list[TimelineEvent] = field(
        default_factory=list
    )
    root_findings: list[str] = field(
        default_factory=list
    )
    resolution_summary: str | None = None
    resolved_at: datetime | None = None

    def add_event(self, event_type, resource,
                  message, metadata=None):
        """Append a typed timeline event."""
        self.timeline.append(TimelineEvent(
            timestamp=datetime.now(timezone.utc),
            event_type=event_type,
            resource=resource,
            message=message,
            metadata=metadata or {},
        ))

    def resolve(self, summary):
        """Mark incident as resolved."""
        self.status = IncidentStatus.RESOLVED
        self.resolved_at = datetime.now(timezone.utc)
        self.resolution_summary = summary
        self.add_event(
            TimelineEventType.INCIDENT_RESOLVED,
            resource="",
            message=summary,
        )

    @property
    def duration(self):
        end = self.resolved_at or datetime.now(
            timezone.utc
        )
        return end - self.started_at


# --- Incident Store ---

def _incidents_path():
    os.makedirs(INCIDENTS_DIR, exist_ok=True)
    return INCIDENTS_DIR


def save_incident(incident):
    """Persist incident to JSON."""
    directory = _incidents_path()
    filepath = os.path.join(
        directory, f"{incident.id}.json"
    )
    data = _serialize(incident)
    with open(filepath, "w") as f:
        json.dump(data, f, indent=2, default=str)
    return filepath


def load_incident(incident_id):
    """Load incident by ID."""
    filepath = os.path.join(
        _incidents_path(), f"{incident_id}.json"
    )
    if not os.path.exists(filepath):
        return None
    with open(filepath, "r") as f:
        data = json.load(f)
    return _deserialize(data)


def list_incidents(status=None):
    """List all incidents, optionally filtered by status."""
    directory = _incidents_path()
    incidents = []
    for fp in sorted(
        Path(directory).glob("*.json"), reverse=True
    ):
        inc = load_incident(fp.stem)
        if inc and (
            status is None or inc.status == status
        ):
            incidents.append(inc)
    return incidents


def active_incidents():
    """Get currently active incidents."""
    return [
        i for i in list_incidents()
        if i.status != IncidentStatus.RESOLVED
    ]


# --- Auto-creation from reports ---

def check_auto_create(report):
    """
    Check if a report should trigger a new incident.
    Auto-creates if critical findings cluster within
    the time window and no active incident exists
    for the same resource.
    """
    critical = [
        f for f in report.findings
        if f.severity == Severity.CRITICAL
        and f.id != "healthy"
    ]

    if len(critical) < AUTO_CREATE_THRESHOLD:
        return None

    # Check if active incident already exists
    # for this resource
    for inc in active_incidents():
        for res in inc.affected_resources:
            if (
                res.name == report.target.name
                and res.namespace == report.target.namespace
            ):
                # Add findings to existing incident
                _enrich_incident(inc, report, critical)
                save_incident(inc)
                return inc

    # Create new incident
    return create_from_report(report, critical)


def create_from_report(report, critical_findings):
    """Create an incident from an investigation report."""
    incident = Incident(
        id=_generate_id(),
        started_at=report.generated_at,
        status=IncidentStatus.ACTIVE,
        title=_derive_title(
            report.target, critical_findings
        ),
        affected_resources=[report.target],
        root_findings=[
            f.finding_type
            for f in critical_findings
            if f.finding_type
        ],
    )

    # Opening event
    incident.add_event(
        TimelineEventType.INCIDENT_OPENED,
        resource=report.target.name,
        message=(
            f"Auto-created: {len(critical_findings)} "
            f"critical findings detected"
        ),
    )

    # Add finding events
    for f in critical_findings:
        event_type = _finding_to_event_type(f)
        incident.add_event(
            event_type,
            resource=report.target.name,
            message=f.conclusion,
            metadata={
                "finding_id": f.id,
                "finding_type": f.finding_type,
            },
        )

    save_incident(incident)
    return incident


def _enrich_incident(incident, report, findings):
    """Add new findings to an existing incident."""
    existing_types = set(incident.root_findings)
    for f in findings:
        if f.finding_type and \
                f.finding_type not in existing_types:
            incident.root_findings.append(
                f.finding_type
            )
            incident.add_event(
                _finding_to_event_type(f),
                resource=report.target.name,
                message=f.conclusion,
                metadata={
                    "finding_id": f.id,
                    "finding_type": f.finding_type,
                },
            )

    # Add resource if not already tracked
    if not any(
        r.name == report.target.name
        and r.namespace == report.target.namespace
        for r in incident.affected_resources
    ):
        incident.affected_resources.append(
            report.target
        )


def _finding_to_event_type(finding):
    """Map finding type to timeline event type."""
    mapping = {
        "oom_kill": TimelineEventType.OOM_KILL,
        "probe_failing": TimelineEventType.PROBE_FAILURE,
        "crash_loop": TimelineEventType.CRASH_LOOP,
        "high_restarts": TimelineEventType.RESTART,
    }
    return mapping.get(
        finding.finding_type,
        TimelineEventType.FINDING_NEW,
    )


def _derive_title(target, findings):
    """Generate incident title from findings."""
    primary = findings[0] if findings else None
    if primary:
        return (
            f"{target.name}: {primary.title}"
        )
    return f"{target.name}: multiple critical issues"


def _generate_id():
    """Short unique ID for incidents."""
    return uuid.uuid4().hex[:8]


# --- Serialization ---

def _serialize(incident):
    return {
        "id": incident.id,
        "started_at": incident.started_at.isoformat(),
        "status": incident.status.value,
        "title": incident.title,
        "affected_resources": [
            {
                "kind": r.kind,
                "name": r.name,
                "namespace": r.namespace,
                "context": r.context,
            }
            for r in incident.affected_resources
        ],
        "timeline": [
            {
                "timestamp": e.timestamp.isoformat(),
                "event_type": e.event_type.value,
                "resource": e.resource,
                "message": e.message,
                "metadata": e.metadata,
            }
            for e in incident.timeline
        ],
        "root_findings": incident.root_findings,
        "resolution_summary": incident.resolution_summary,
        "resolved_at": (
            incident.resolved_at.isoformat()
            if incident.resolved_at else None
        ),
    }


def _deserialize(data):
    return Incident(
        id=data["id"],
        started_at=datetime.fromisoformat(
            data["started_at"]
        ),
        status=IncidentStatus(data["status"]),
        title=data["title"],
        affected_resources=[
            ResourceRef(**r)
            for r in data.get(
                "affected_resources", []
            )
        ],
        timeline=[
            TimelineEvent(
                timestamp=datetime.fromisoformat(
                    e["timestamp"]
                ),
                event_type=TimelineEventType(
                    e["event_type"]
                ),
                resource=e["resource"],
                message=e["message"],
                metadata=e.get("metadata", {}),
            )
            for e in data.get("timeline", [])
        ],
        root_findings=data.get("root_findings", []),
        resolution_summary=data.get(
            "resolution_summary"
        ),
        resolved_at=(
            datetime.fromisoformat(data["resolved_at"])
            if data.get("resolved_at") else None
        ),
    )
