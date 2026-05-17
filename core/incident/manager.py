"""
Incident Mode — capture operational context during
debugging sessions.

Features:
- Start/stop incident tracking
- Add notes with timestamps
- Snapshot current cluster state
- Export incident report
"""

import json
import os
from datetime import datetime
from pathlib import Path

from core.context import context
from core.collectors.pods import collect_pods
from core.collectors.events import collect_events

INCIDENTS_DIR = Path.home() / ".kubsome" / "incidents"


def ensure_dir():
    INCIDENTS_DIR.mkdir(parents=True, exist_ok=True)


def _current_file():
    return INCIDENTS_DIR / "active_incident.json"


def start_incident(title=""):
    """Start a new incident session."""
    ensure_dir()

    incident = {
        "id": datetime.now().strftime("%Y%m%d_%H%M%S"),
        "title": title or "Untitled Incident",
        "started": datetime.now().isoformat(),
        "context": context.current_context,
        "namespace": context.namespace,
        "timeline": [],
        "notes": [],
        "snapshots": [],
    }

    # Initial snapshot
    snapshot = _take_snapshot()
    incident["snapshots"].append(snapshot)
    incident["timeline"].append({
        "time": datetime.now().isoformat(),
        "event": "Incident started",
        "detail": title,
    })

    _save(incident)
    return incident


def stop_incident(root_cause="", resolution="", lessons_learned=""):
    """Stop active incident and export report."""
    incident = _load()
    if not incident:
        return None

    incident["ended"] = datetime.now().isoformat()
    if root_cause:
        incident["root_cause"] = root_cause
    if resolution:
        incident["resolution"] = resolution
    if lessons_learned:
        incident["lessons_learned"] = lessons_learned
    incident["timeline"].append({
        "time": datetime.now().isoformat(),
        "event": "Incident closed",
        "detail": resolution or "",
    })

    # Final snapshot
    snapshot = _take_snapshot()
    incident["snapshots"].append(snapshot)

    # Export to file
    export_path = (
        INCIDENTS_DIR
        / f"incident_{incident['id']}.json"
    )
    with open(export_path, "w") as f:
        json.dump(incident, f, indent=2)

    # Remove active
    _current_file().unlink(missing_ok=True)

    return incident, str(export_path)


def add_note(note):
    """Add a note to the active incident."""
    incident = _load()
    if not incident:
        return False

    incident["notes"].append({
        "time": datetime.now().isoformat(),
        "text": note,
    })
    incident["timeline"].append({
        "time": datetime.now().isoformat(),
        "event": "Note added",
        "detail": note,
    })

    _save(incident)
    return True


def add_action(action, target="", result=""):
    """Log a remediation action taken during the incident."""
    incident = _load()
    if not incident:
        return False

    if "actions" not in incident:
        incident["actions"] = []

    incident["actions"].append({
        "time": datetime.now().isoformat(),
        "action": action,
        "target": target,
        "result": result,
    })
    incident["timeline"].append({
        "time": datetime.now().isoformat(),
        "event": f"Action: {action}",
        "detail": f"{target} — {result}" if result else target,
    })

    _save(incident)
    return True


def snapshot():
    """Take a snapshot of current state."""
    incident = _load()
    if not incident:
        return False

    snap = _take_snapshot()
    incident["snapshots"].append(snap)
    incident["timeline"].append({
        "time": datetime.now().isoformat(),
        "event": "Snapshot taken",
        "detail": "",
    })

    _save(incident)
    return True


def get_active():
    """Get active incident or None."""
    return _load()


def _take_snapshot():
    try:
        pods = collect_pods()
        events = collect_events(limit=20)
    except Exception:
        pods = []
        events = []

    # Include metrics if available
    metrics = []
    try:
        from core.collectors.metrics import top_pods
        metrics = top_pods()
    except Exception:
        pass

    return {
        "time": datetime.now().isoformat(),
        "context": context.current_context,
        "namespace": context.namespace,
        "pods": pods,
        "events": events,
        "metrics": metrics,
    }


def _save(incident):
    ensure_dir()
    with open(_current_file(), "w") as f:
        json.dump(incident, f, indent=2)


def _load():
    path = _current_file()
    if not path.exists():
        return None
    with open(path, "r") as f:
        return json.load(f)


def share_incident(incident_id=None):
    """
    Share an incident report via configured webhooks.
    If incident_id is None, shares the active incident.
    Returns (success, message).
    """
    if incident_id:
        path = INCIDENTS_DIR / f"incident_{incident_id}.json"
        if not path.exists():
            return False, f"Incident {incident_id} not found"
        with open(path, "r") as f:
            incident = json.load(f)
    else:
        incident = _load()
        if not incident:
            return False, "No active incident"

    # Build Markdown summary
    md = _incident_to_markdown(incident)

    # Send via webhook
    from core.notify import notify_webhook
    title = f"Incident: {incident.get('title', 'Untitled')}"
    notify_webhook(title, md, "warning")

    return True, f"Shared '{incident['title']}' to webhooks"


def _incident_to_markdown(incident):
    """Convert incident to shareable Markdown."""
    lines = [
        f"**{incident.get('title', 'Untitled')}**",
        f"ID: {incident.get('id', '')}",
        f"Context: {incident.get('context', '')} / "
        f"{incident.get('namespace', '')}",
        f"Started: {incident.get('started', '')[:16]}",
    ]

    if incident.get("ended"):
        lines.append(f"Ended: {incident['ended'][:16]}")

    if incident.get("root_cause"):
        lines.append(f"\n**Root Cause:** {incident['root_cause']}")

    if incident.get("resolution"):
        lines.append(f"**Resolution:** {incident['resolution']}")

    if incident.get("notes"):
        lines.append(f"\n**Notes ({len(incident['notes'])}):**")
        for note in incident["notes"][-5:]:
            lines.append(
                f"  • [{note['time'][11:16]}] {note['text']}"
            )

    if incident.get("actions"):
        lines.append(f"\n**Actions ({len(incident['actions'])}):**")
        for a in incident["actions"][-5:]:
            lines.append(
                f"  • {a['action']} → {a.get('result', '')}"
            )

    if incident.get("timeline"):
        lines.append(
            f"\n_Timeline: {len(incident['timeline'])} events_"
        )

    return "\n".join(lines)
