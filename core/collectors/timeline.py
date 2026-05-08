"""
Timeline — build a chronological view of cluster events.
"""

import subprocess
import json
from datetime import datetime, timezone

from core.context import context


def build_timeline(minutes=60):
    """Build event timeline for the last N minutes."""
    ns = context.namespace
    ctx = context.current_context

    cmd = (
        f"kubectl --context {ctx} "
        f"get events -n {ns} "
        f"--sort-by=.lastTimestamp -o json"
    )

    r = subprocess.run(
        cmd, shell=True,
        capture_output=True, text=True
    )

    if r.returncode != 0:
        return []

    data = json.loads(r.stdout)
    now = datetime.now(timezone.utc)

    timeline = []
    for item in data.get("items", []):
        ts = item.get("lastTimestamp")
        if not ts:
            continue

        try:
            event_time = datetime.fromisoformat(
                ts.replace("Z", "+00:00")
            )
        except (ValueError, TypeError):
            continue

        age_mins = (now - event_time).total_seconds() / 60
        if age_mins > minutes:
            continue

        timeline.append({
            "time": ts[:19],
            "age_mins": int(age_mins),
            "type": item.get("type", "Normal"),
            "reason": item.get("reason", ""),
            "object": item.get(
                "involvedObject", {}
            ).get("name", ""),
            "kind": item.get(
                "involvedObject", {}
            ).get("kind", ""),
            "message": item.get("message", ""),
            "count": item.get("count", 1),
        })

    return sorted(
        timeline, key=lambda x: x["time"]
    )
