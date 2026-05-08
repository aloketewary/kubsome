"""
Change Tracking — capture state snapshots and detect drift.
Stores snapshots in ~/.kubsome/snapshots/
"""

import json
from datetime import datetime
from pathlib import Path

from core.context import context
from core.collectors.pods import collect_pods
from core.collectors.deployments import collect_deployments
from core.collectors.events import collect_events


SNAPSHOTS_DIR = Path.home() / ".kubsome" / "snapshots"


def take_state_snapshot():
    """Capture current namespace state."""
    SNAPSHOTS_DIR.mkdir(parents=True, exist_ok=True)

    pods = collect_pods()
    deployments = collect_deployments()

    snapshot = {
        "timestamp": datetime.now().isoformat(),
        "context": context.current_context,
        "namespace": context.namespace,
        "pods": pods,
        "deployments": deployments,
    }

    filename = (
        f"{context.namespace}_"
        f"{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
    )
    path = SNAPSHOTS_DIR / filename

    with open(path, "w") as f:
        json.dump(snapshot, f, indent=2)

    return str(path)


def get_latest_snapshot():
    """Get the most recent snapshot for current namespace."""
    SNAPSHOTS_DIR.mkdir(parents=True, exist_ok=True)

    prefix = f"{context.namespace}_"
    files = sorted(
        [f for f in SNAPSHOTS_DIR.glob(f"{prefix}*.json")],
        reverse=True
    )

    if not files:
        return None

    with open(files[0], "r") as f:
        return json.load(f)


def diff_snapshots(old_snapshot, current=None):
    """Compare a snapshot against current state."""
    if not old_snapshot:
        return None

    # Get current state
    if current is None:
        current_pods = collect_pods()
        current_deps = collect_deployments()
    else:
        current_pods = current.get("pods", [])
        current_deps = current.get("deployments", [])

    old_pods = old_snapshot.get("pods", [])
    old_deps = old_snapshot.get("deployments", [])

    changes = {
        "timestamp": old_snapshot.get("timestamp", ""),
        "pods": _diff_resources(old_pods, current_pods, "name"),
        "deployments": _diff_resources(old_deps, current_deps, "name"),
    }

    return changes


def build_changelog():
    """Build a changelog from recent events — what happened today."""
    events = collect_events(limit=100)

    # Group by hour
    hours = {}
    for ev in events:
        ts = ev.get("last_seen", "")[:13]  # YYYY-MM-DDTHH
        if ts not in hours:
            hours[ts] = []
        hours[ts].append(ev)

    # Summarize changes
    changelog = []

    # Deployments that scaled
    scaling_events = [
        e for e in events
        if e["reason"] == "ScalingReplicaSet"
    ]
    if scaling_events:
        objects = set(e["object"] for e in scaling_events)
        changelog.append({
            "type": "scaling",
            "summary": f"{len(objects)} deployments scaled",
            "details": list(objects)[:5],
        })

    # Pods created/killed
    created = [
        e for e in events if e["reason"] == "Created"
    ]
    killed = [
        e for e in events if e["reason"] == "Killing"
    ]
    if created or killed:
        changelog.append({
            "type": "lifecycle",
            "summary": (
                f"{len(created)} created, "
                f"{len(killed)} killed"
            ),
            "details": [],
        })

    # Failures
    failures = [
        e for e in events
        if e["reason"] in (
            "BackOff", "Failed", "FailedScheduling",
            "Unhealthy", "OOMKilling"
        )
    ]
    if failures:
        reasons = {}
        for f in failures:
            reasons[f["reason"]] = reasons.get(
                f["reason"], 0
            ) + 1
        changelog.append({
            "type": "failures",
            "summary": f"{len(failures)} failure events",
            "details": [
                f"{r}: {c}×" for r, c in reasons.items()
            ],
        })

    # Image pulls (new deployments)
    pulls = [
        e for e in events if e["reason"] == "Pulled"
    ]
    if pulls:
        images = set(e["object"] for e in pulls)
        changelog.append({
            "type": "deployments",
            "summary": f"{len(images)} new images pulled",
            "details": list(images)[:5],
        })

    return changelog


def resource_history(resource_name):
    """Get lifecycle events for a specific resource."""
    events = collect_events(limit=100)

    history = [
        e for e in events
        if resource_name.lower() in e.get("object", "").lower()
    ]

    return sorted(history, key=lambda e: e.get("last_seen", ""))


def _diff_resources(old_list, new_list, key):
    """Diff two lists of resources by key field."""
    old_names = {r[key] for r in old_list}
    new_names = {r[key] for r in new_list}

    added = new_names - old_names
    removed = old_names - new_names
    common = old_names & new_names

    changed = []
    for name in common:
        old_r = next(r for r in old_list if r[key] == name)
        new_r = next(r for r in new_list if r[key] == name)

        diffs = []
        if old_r.get("status") != new_r.get("status"):
            diffs.append(
                f"status: {old_r.get('status')} → {new_r.get('status')}"
            )
        if old_r.get("restarts", 0) != new_r.get("restarts", 0):
            diffs.append(
                f"restarts: {old_r.get('restarts', 0)} → {new_r.get('restarts', 0)}"
            )
        if old_r.get("available") != new_r.get("available"):
            diffs.append(
                f"available: {old_r.get('available')} → {new_r.get('available')}"
            )

        if diffs:
            changed.append({"name": name, "changes": diffs})

    return {
        "added": sorted(added),
        "removed": sorted(removed),
        "changed": changed,
    }
