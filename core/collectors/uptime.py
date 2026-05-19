"""
Uptime collector — checks cluster availability,
node uptime, and detects scheduled downtime.
"""

import subprocess
import json
from datetime import datetime, timezone
from concurrent.futures import ThreadPoolExecutor

from core.context import context
from core.k8s import get_raw_resources
from core.cache import cached


@cached(ttl=5)
def collect_uptime():
    """Get cluster and node uptime info."""
    ctx = context.current_context
    ns = context.namespace

    # Bolt: Parallelize all initial checks/fetches to minimize O(N) sequential latency
    with ThreadPoolExecutor(max_workers=3) as executor:
        f_api = executor.submit(_check_api, ctx)
        f_nodes = executor.submit(get_raw_resources, "nodes", ctx)
        f_pods = executor.submit(get_raw_resources, "pods", ctx, ns)

        api_ok = f_api.result()
        node_data = f_nodes.result()
        pod_data = f_pods.result()

    if not api_ok:
        now = datetime.now(timezone.utc)
        return {
            "context": ctx,
            "namespace": ns,
            "api_reachable": False,
            "cluster_down": True,
            "downtime_hint": "Cluster is unreachable",
            "is_weekend": now.weekday() in (5, 6),
            "current_time": now.isoformat(),
            "day": now.strftime("%A"),
            "nodes": [],
            "pods": {"total": 0, "running": 0, "down": 0},
        }

    # Get nodes with creation time
    nodes = _get_nodes(node_data)

    # Get pod summary
    pods = _get_pod_summary(pod_data)

    # Cluster is only down if ALL nodes are NotReady
    cluster_down = (
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
    cmd = [
        "kubectl", "--context", str(ctx or ""),
        "api-versions", "--request-timeout=5s"
    ]
    try:
        result = subprocess.run(
            cmd,
            capture_output=True, text=True,
            timeout=8,
        )
        return result.returncode == 0
    except subprocess.TimeoutExpired:
        return False


def _get_nodes(data):
    """Get node status and uptime."""
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


def _get_pod_summary(data):
    """Quick pod count summary."""
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
