"""
Cluster Diff Timeline — detect resource mutations
in the last N hours by analyzing events and
comparing current state.
"""

import subprocess
import json
from datetime import datetime, timezone, timedelta

from core.context import context


def collect_diff_timeline(hours=24):
    """
    Collect resource changes in the last N hours.
    Returns categorized mutations.
    """
    ctx = context.current_context
    ns = context.namespace

    events = _get_recent_events(ctx, ns, hours)
    changes = _categorize_changes(events)

    return {
        "context": ctx,
        "namespace": ns,
        "hours": hours,
        "changes": changes,
        "total": sum(len(v) for v in changes.values()),
    }


def _get_recent_events(ctx, ns, hours):
    """Get events from the last N hours."""
    cmd = (
        f"kubectl --context {ctx} "
        f"get events -n {ns} -o json "
        f"--sort-by=.lastTimestamp"
    )
    result = subprocess.run(
        cmd, shell=True,
        capture_output=True, text=True,
        timeout=15,
    )
    if result.returncode != 0:
        return []

    data = json.loads(result.stdout)
    cutoff = datetime.now(timezone.utc) - timedelta(hours=hours)
    events = []

    for item in data.get("items", []):
        ts_str = (
            item.get("lastTimestamp")
            or item.get("eventTime")
            or ""
        )
        if not ts_str:
            continue

        try:
            ts = datetime.fromisoformat(
                ts_str.replace("Z", "+00:00")
            )
            if ts >= cutoff:
                events.append({
                    "time": ts_str,
                    "reason": item.get("reason", ""),
                    "kind": item.get(
                        "involvedObject", {}
                    ).get("kind", ""),
                    "name": item.get(
                        "involvedObject", {}
                    ).get("name", ""),
                    "message": item.get("message", ""),
                    "type": item.get("type", "Normal"),
                })
        except (ValueError, TypeError):
            continue

    return events


def _categorize_changes(events):
    """Group events into change categories."""
    categories = {
        "image_changes": [],
        "scaling": [],
        "restarts": [],
        "new_deployments": [],
        "deletions": [],
        "config_changes": [],
        "other": [],
    }

    seen = set()

    for ev in events:
        key = f"{ev['reason']}:{ev['name']}"
        if key in seen:
            continue
        seen.add(key)

        reason = ev["reason"]
        msg = ev["message"].lower()

        if reason == "ScalingReplicaSet":
            categories["scaling"].append(ev)
        elif reason in ("Pulled", "Pulling"):
            if "new" in msg or "updated" in msg:
                categories["image_changes"].append(ev)
        elif reason == "BackOff" or reason == "Killing":
            categories["restarts"].append(ev)
        elif reason == "SuccessfulCreate":
            categories["new_deployments"].append(ev)
        elif reason == "SuccessfulDelete":
            categories["deletions"].append(ev)
        elif "configmap" in msg or "secret" in msg:
            categories["config_changes"].append(ev)
        else:
            categories["other"].append(ev)

    # Remove empty categories
    return {
        k: v for k, v in categories.items() if v
    }
