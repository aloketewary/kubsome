"""
Uptime collector — checks cluster availability,
node uptime, and detects scheduled downtime.
"""

import subprocess
import json
from datetime import datetime, timezone

from core.context import context


def collect_uptime():
    """Get cluster and node uptime info."""
    ctx = context.current_context
    ns = context.namespace

    # Check API server reachability
    api_ok = _check_api(ctx)

    # Get nodes with creation time
    nodes = _get_nodes(ctx)

    # Get pod summary
    pods = _get_pod_summary(ctx, ns)

    # Detect if cluster is down (all nodes NotReady or no response)
    cluster_down = not api_ok or (
        nodes and all(not n["ready"] for n in nodes)
    )

    # Detect weekend/scheduled downtime pattern
    now = datetime.now(timezone.utc)
    is_weekend = now.weekday() in (5, 6)
    downtime_hint = ""
    if cluster_down and is_weekend:
        downtime_hint = (
            "Cluster appears to be in scheduled "
            "weekend downtime"
        )
    elif cluster_down:
        downtime_hint = "Cluster is unreachable"

    return {
        "context": ctx,
        "namespace": ns,
        "api_reachable": api_ok,
        "cluster_down": cluster_down,
        "downtime_hint": downtime_hint,
        "is_weekend": is_weekend,
        "current_time": now.isoformat(),
        "day": now.strftime("%A"),
        "nodes": nodes,
        "pods": pods,
    }


def _check_api(ctx):
    """Check if API server responds."""
    cmd = (
        f"kubectl --context {ctx} "
        f"cluster-info --request-timeout=5s"
    )
    result = subprocess.run(
        cmd, shell=True,
        capture_output=True, text=True,
        timeout=10,
    )
    return result.returncode == 0


def _get_nodes(ctx):
    """Get node status and uptime."""
    cmd = (
        f"kubectl --context {ctx} "
        f"get nodes -o json"
    )
    result = subprocess.run(
        cmd, shell=True,
        capture_output=True, text=True,
        timeout=10,
    )
    if result.returncode != 0:
        return []

    data = json.loads(result.stdout)
    nodes = []
    now = datetime.now(timezone.utc)

    for item in data.get("items", []):
        created = item["metadata"]["creationTimestamp"]
        created_dt = datetime.fromisoformat(
            created.replace("Z", "+00:00")
        )
        uptime_seconds = (now - created_dt).total_seconds()

        conditions = item.get("status", {}).get(
            "conditions", []
        )
        ready = any(
            c["type"] == "Ready" and c["status"] == "True"
            for c in conditions
        )

        nodes.append({
            "name": item["metadata"]["name"],
            "ready": ready,
            "created": created,
            "uptime_seconds": int(uptime_seconds),
            "uptime_human": _human_duration(
                uptime_seconds
            ),
        })

    return nodes


def _get_pod_summary(ctx, ns):
    """Quick pod count summary."""
    cmd = (
        f"kubectl --context {ctx} "
        f"get pods -n {ns} -o json"
    )
    result = subprocess.run(
        cmd, shell=True,
        capture_output=True, text=True,
        timeout=10,
    )
    if result.returncode != 0:
        return {"total": 0, "running": 0, "down": 0}

    data = json.loads(result.stdout)
    items = data.get("items", [])
    running = sum(
        1 for p in items
        if p.get("status", {}).get("phase") == "Running"
    )
    return {
        "total": len(items),
        "running": running,
        "down": len(items) - running,
    }


def _human_duration(seconds):
    """Convert seconds to human-readable duration."""
    if seconds < 60:
        return f"{int(seconds)}s"
    if seconds < 3600:
        return f"{int(seconds // 60)}m"
    if seconds < 86400:
        h = int(seconds // 3600)
        m = int((seconds % 3600) // 60)
        return f"{h}h {m}m"
    d = int(seconds // 86400)
    h = int((seconds % 86400) // 3600)
    return f"{d}d {h}h"
