"""
Metrics History — stores periodic usage snapshots
for historical analysis and smarter right-sizing.

Snapshots stored in ~/.kubsome/metrics_history/
Retained for 24h by default.
"""

import json
import time
from pathlib import Path

from core.context import context
from core.collectors.metrics import top_pods


HISTORY_DIR = Path.home() / ".kubsome" / "metrics_history"
RETENTION_HOURS = 168  # 7 days
MAX_SNAPSHOTS = 2016   # 7 days at 5min intervals


def record_snapshot():
    """Record current pod metrics to history."""
    if not context.current_context:
        return

    HISTORY_DIR.mkdir(parents=True, exist_ok=True)

    usage = top_pods()
    if not usage:
        return

    snapshot = {
        "ts": time.time(),
        "context": context.current_context,
        "namespace": context.namespace,
        "pods": {
            p["name"]: {
                "cpu": p["cpu_millicores"],
                "mem": p["memory_mb"],
            }
            for p in usage
        },
    }

    ns = context.namespace or "default"
    path = HISTORY_DIR / f"{ns}_metrics.jsonl"

    with open(path, "a") as f:
        f.write(json.dumps(snapshot) + "\n")

    _prune(path)


def get_pod_history(pod_name):
    """
    Get historical usage for a pod.
    Returns {cpu_peak, cpu_avg, mem_peak, mem_avg, samples}
    """
    ns = context.namespace or "default"
    path = HISTORY_DIR / f"{ns}_metrics.jsonl"

    if not path.exists():
        return None

    cutoff = time.time() - (RETENTION_HOURS * 3600)
    cpu_values = []
    mem_values = []

    with open(path, "r") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                snap = json.loads(line)
            except json.JSONDecodeError:
                continue
            if snap["ts"] < cutoff:
                continue
            pod_data = snap.get("pods", {}).get(pod_name)
            if pod_data:
                cpu_values.append(pod_data["cpu"])
                mem_values.append(pod_data["mem"])

    if not cpu_values:
        return None

    return {
        "cpu_peak": max(cpu_values),
        "cpu_avg": int(sum(cpu_values) / len(cpu_values)),
        "cpu_p95": _percentile(cpu_values, 95),
        "mem_peak": max(mem_values),
        "mem_avg": int(sum(mem_values) / len(mem_values)),
        "mem_p95": _percentile(mem_values, 95),
        "samples": len(cpu_values),
        "hours": round(
            (time.time() - cutoff) / 3600, 1
        ),
    }


def get_all_pod_history():
    """Get history for all pods in namespace."""
    ns = context.namespace or "default"
    path = HISTORY_DIR / f"{ns}_metrics.jsonl"

    if not path.exists():
        return {}

    cutoff = time.time() - (RETENTION_HOURS * 3600)
    pod_data = {}

    with open(path, "r") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                snap = json.loads(line)
            except json.JSONDecodeError:
                continue
            if snap["ts"] < cutoff:
                continue
            for name, data in snap.get("pods", {}).items():
                if name not in pod_data:
                    pod_data[name] = {"cpu": [], "mem": []}
                pod_data[name]["cpu"].append(data["cpu"])
                pod_data[name]["mem"].append(data["mem"])

    result = {}
    for name, data in pod_data.items():
        if data["cpu"]:
            result[name] = {
                "cpu_peak": max(data["cpu"]),
                "cpu_avg": int(
                    sum(data["cpu"]) / len(data["cpu"])
                ),
                "cpu_p95": _percentile(data["cpu"], 95),
                "mem_peak": max(data["mem"]),
                "mem_avg": int(
                    sum(data["mem"]) / len(data["mem"])
                ),
                "mem_p95": _percentile(data["mem"], 95),
                "samples": len(data["cpu"]),
            }

    return result


def _percentile(values, pct):
    """Calculate percentile from a list of values."""
    if not values:
        return 0
    sorted_vals = sorted(values)
    idx = int(len(sorted_vals) * pct / 100)
    idx = min(idx, len(sorted_vals) - 1)
    return sorted_vals[idx]


def _prune(path):
    """Remove entries older than retention period."""
    if not path.exists():
        return

    cutoff = time.time() - (RETENTION_HOURS * 3600)
    lines = []

    with open(path, "r") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                snap = json.loads(line)
                if snap["ts"] >= cutoff:
                    lines.append(line)
            except json.JSONDecodeError:
                continue

    # Keep only last MAX_SNAPSHOTS
    lines = lines[-MAX_SNAPSHOTS:]

    with open(path, "w") as f:
        f.write("\n".join(lines) + "\n" if lines else "")


def get_time_series(pod_name=None, hours=24):
    """
    Get time-series data points for charting.
    Returns [{ts, cpu_total, mem_total}] or per-pod if specified.
    """
    ns = context.namespace or "default"
    path = HISTORY_DIR / f"{ns}_metrics.jsonl"

    if not path.exists():
        return []

    cutoff = time.time() - (hours * 3600)
    series = []

    with open(path, "r") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                snap = json.loads(line)
            except json.JSONDecodeError:
                continue
            if snap["ts"] < cutoff:
                continue

            if pod_name:
                pod_data = snap.get("pods", {}).get(pod_name)
                if pod_data:
                    series.append({
                        "ts": snap["ts"],
                        "cpu": pod_data["cpu"],
                        "mem": pod_data["mem"],
                    })
            else:
                # Aggregate all pods
                pods = snap.get("pods", {})
                total_cpu = sum(p["cpu"] for p in pods.values())
                total_mem = sum(p["mem"] for p in pods.values())
                series.append({
                    "ts": snap["ts"],
                    "cpu": total_cpu,
                    "mem": total_mem,
                    "pod_count": len(pods),
                })

    return series
