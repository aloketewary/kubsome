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


def stop_incident():
    """Stop active incident and export report."""
    incident = _load()
    if not incident:
        return None

    incident["ended"] = datetime.now().isoformat()
    incident["timeline"].append({
        "time": datetime.now().isoformat(),
        "event": "Incident closed",
        "detail": "",
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

    return {
        "time": datetime.now().isoformat(),
        "context": context.current_context,
        "namespace": context.namespace,
        "pods": pods,
        "events": events,
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
