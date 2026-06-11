"""
Snapshot Store — persists InvestigationReports as JSON
for timeline queries, trend detection, and incident mode.

Storage layout:
    ~/.kubsome/snapshots/<namespace>/<resource_kind>/<name>/<timestamp>.json
"""

import json
import os
from dataclasses import asdict
from datetime import datetime, timezone
from enum import Enum
from pathlib import Path

from core.diagnostics.models import (
    InvestigationReport,
    ResourceRef,
    Observation,
    Finding,
    Recommendation,
    ExecutionPlan,
    Severity,
    Risk,
    ObservationSource,
    SCHEMA_VERSION,
)


SNAPSHOTS_DIR = os.path.expanduser(
    "~/.kubsome/snapshots"
)


class _EnumEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, Enum):
            return obj.value
        if isinstance(obj, datetime):
            return obj.isoformat()
        return super().default(obj)


def _snapshot_dir(target):
    """Build directory path for a resource target."""
    return os.path.join(
        SNAPSHOTS_DIR,
        target.namespace,
        target.kind.lower(),
        target.name,
    )


def save(report):
    """
    Persist an InvestigationReport as a JSON snapshot.
    Returns the snapshot file path.
    """
    directory = _snapshot_dir(report.target)
    os.makedirs(directory, exist_ok=True)

    ts = report.generated_at.strftime(
        "%Y%m%dT%H%M%S"
    )
    filename = f"{ts}.json"
    filepath = os.path.join(directory, filename)

    data = asdict(report)
    with open(filepath, "w") as f:
        json.dump(data, f, cls=_EnumEncoder, indent=2)

    # Prune old snapshots (keep last 50)
    _prune(directory, keep=50)

    return filepath


def load(filepath):
    """Load a single snapshot from file path."""
    with open(filepath, "r") as f:
        data = json.load(f)
    return _deserialize(data)


def latest(target):
    """Load the most recent snapshot for a target."""
    directory = _snapshot_dir(target)
    if not os.path.isdir(directory):
        return None

    files = sorted(Path(directory).glob("*.json"))
    if not files:
        return None

    return load(str(files[-1]))


def history(target, limit=20):
    """
    Load recent snapshots for a target.
    Returns list of InvestigationReport, newest first.
    """
    directory = _snapshot_dir(target)
    if not os.path.isdir(directory):
        return []

    files = sorted(
        Path(directory).glob("*.json"), reverse=True
    )
    results = []
    for fp in files[:limit]:
        results.append(load(str(fp)))
    return results


def between(target, start, end):
    """
    Load snapshots between two datetimes.
    Returns list of InvestigationReport, oldest first.
    """
    directory = _snapshot_dir(target)
    if not os.path.isdir(directory):
        return []

    results = []
    for fp in sorted(Path(directory).glob("*.json")):
        ts_str = fp.stem  # e.g. 20260611T100100
        try:
            ts = datetime.strptime(
                ts_str, "%Y%m%dT%H%M%S"
            ).replace(tzinfo=timezone.utc)
        except ValueError:
            continue
        if start <= ts <= end:
            results.append(load(str(fp)))
    return results


def timeline(target, limit=20):
    """
    Build a finding timeline from stored snapshots.
    Returns list of {timestamp, finding_type, severity, title}.
    """
    reports = history(target, limit=limit)
    events = []

    seen = set()
    for report in reversed(reports):
        for f in report.findings:
            if f.id == "healthy":
                continue
            key = (
                report.generated_at.isoformat(),
                f.finding_type,
            )
            if key in seen:
                continue
            seen.add(key)
            events.append({
                "timestamp": report.generated_at,
                "finding_type": f.finding_type,
                "severity": f.severity,
                "title": f.title,
                "finding_id": f.id,
            })

    return events


def _prune(directory, keep=50):
    """Keep only the most recent N snapshots."""
    files = sorted(Path(directory).glob("*.json"))
    if len(files) <= keep:
        return
    for fp in files[:-keep]:
        fp.unlink()


# --- Deserialization ---

def _deserialize(data):
    """Reconstruct InvestigationReport from dict."""
    target = ResourceRef(**data["target"])

    generated_at = data["generated_at"]
    if isinstance(generated_at, str):
        generated_at = datetime.fromisoformat(
            generated_at
        )

    observations = [
        Observation(
            id=o["id"],
            source=ObservationSource(o["source"]),
            message=o["message"],
            timestamp=(
                datetime.fromisoformat(o["timestamp"])
                if o.get("timestamp")
                else None
            ),
            verified=o.get("verified", True),
            raw_ref=o.get("raw_ref", ""),
            metadata=o.get("metadata", {}),
        )
        for o in data.get("observations", [])
    ]

    findings = [
        Finding(
            id=f["id"],
            severity=Severity(f["severity"]),
            title=f["title"],
            conclusion=f["conclusion"],
            finding_type=f.get("finding_type"),
            evidence_ids=f.get("evidence_ids", []),
            related_finding_ids=f.get(
                "related_finding_ids", []
            ),
            verification_commands=f.get(
                "verification_commands", []
            ),
        )
        for f in data.get("findings", [])
    ]

    recommendations = [
        Recommendation(
            id=r["id"],
            finding_id=r["finding_id"],
            action=r["action"],
            risk=Risk(r["risk"]),
        )
        for r in data.get("recommendations", [])
    ]

    execution_plans = [
        ExecutionPlan(
            id=p["id"],
            finding_ids=p["finding_ids"],
            steps=p["steps"],
            risk=Risk(p["risk"]),
            reversible=p.get("reversible", True),
        )
        for p in data.get("execution_plans", [])
    ]

    return InvestigationReport(
        target=target,
        generated_at=generated_at,
        schema_version=data.get(
            "schema_version", SCHEMA_VERSION
        ),
        observations=observations,
        findings=findings,
        recommendations=recommendations,
        execution_plans=execution_plans,
    )
