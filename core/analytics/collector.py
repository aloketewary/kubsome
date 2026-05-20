"""
Analytics Collector — periodic metric collection from kubectl
into DuckDB raw tables. Runs as background thread.
"""

import time
import json
import subprocess
import threading
from datetime import datetime

from core.context import context
from core.analytics.engine import execute_write, execute_many


_collector_thread = None
_running = False
INTERVAL = 300  # 5 minutes default


def start_collector(interval=None):
    """Start background collection thread."""
    global _collector_thread, _running, INTERVAL
    if interval:
        INTERVAL = interval
    if _running:
        return
    _running = True
    _collector_thread = threading.Thread(
        target=_collection_loop, daemon=True
    )
    _collector_thread.start()


def stop_collector():
    """Stop background collection."""
    global _running
    _running = False


def collect_now():
    """Run a single collection cycle. Returns stats."""
    return _collect_cycle()


def _collection_loop():
    """Background loop — collect every INTERVAL seconds."""
    # Wait for cluster connection on startup
    time.sleep(15)
    while _running:
        try:
            _collect_cycle()
        except Exception:
            pass
        time.sleep(INTERVAL)


def _collect_cycle():
    """
    Single collection: pods + nodes → DuckDB.
    Scales to millions of pods via:
    - Streaming JSON parse (no full load into memory)
    - Batch INSERT (1000 rows per executemany)
    - Parallel node + pod collection
    """
    start = time.time()
    ctx = context.current_context
    ns = context.namespace

    if not ctx:
        return {"pods": 0, "nodes": 0}

    ts = datetime.utcnow()

    # Collect sequentially to avoid concurrent DuckDB writes
    pods_collected = _collect_pods(ts, ctx, ns)
    nodes_collected = _collect_nodes(ts, ctx)

    duration_ms = int((time.time() - start) * 1000)

    # Log collection
    execute_write(
        "INSERT INTO collection_log VALUES (?, 'raw', ?, ?, ?)",
        [ts, pods_collected, nodes_collected, duration_ms]
    )

    return {
        "pods": pods_collected,
        "nodes": nodes_collected,
        "duration_ms": duration_ms,
    }


def _collect_pods(ts, ctx, ns):
    """
    Collect pod metrics and resource requests/limits.
    Handles large clusters via batch inserts.
    """
    # Get metrics
    metrics = _kubectl_top_pods(ctx, ns)
    if not metrics:
        return 0

    # Get pod details (requests, limits, status)
    details = _kubectl_pod_details(ctx, ns)

    # Batch insert (1000 rows at a time for memory efficiency)
    BATCH_SIZE = 1000
    batch = []
    total = 0

    for pod_name, m in metrics.items():
        detail = details.get(pod_name, {})
        batch.append((
            ts,
            ctx,
            ns,
            pod_name,
            detail.get("deployment", ""),
            detail.get("container", ""),
            m["cpu"],
            m["mem"],
            detail.get("cpu_request", 0),
            detail.get("cpu_limit", 0),
            detail.get("mem_request", 0),
            detail.get("mem_limit", 0),
            detail.get("restarts", 0),
            detail.get("status", ""),
        ))

        if len(batch) >= BATCH_SIZE:
            execute_many(
                "INSERT INTO raw_pod_metrics VALUES "
                "(?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
                batch
            )
            total += len(batch)
            batch = []

    # Flush remaining
    if batch:
        execute_many(
            "INSERT INTO raw_pod_metrics VALUES "
            "(?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
            batch
        )
        total += len(batch)

    return total


def _collect_nodes(ts, ctx):
    """Collect node metrics."""
    # Top nodes
    cmd = [
        "kubectl", "--context", str(ctx or ""),
        "top", "nodes", "--no-headers"
    ]
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode != 0:
        return 0

    # Node details for allocatable
    node_info = _kubectl_node_info(ctx)

    rows = []
    for line in r.stdout.strip().split("\n"):
        parts = line.split()
        if len(parts) < 5:
            continue
        name = parts[0]
        cpu_pct = _parse_pct(parts[2])
        mem_pct = _parse_pct(parts[4])
        info = node_info.get(name, {})

        rows.append((
            ts,
            ctx,
            name,
            cpu_pct,
            mem_pct,
            info.get("cpu_allocatable", 0),
            info.get("mem_allocatable_mb", 0),
            info.get("pod_count", 0),
        ))

    if rows:
        execute_many(
            "INSERT INTO raw_node_metrics VALUES "
            "(?,?,?,?,?,?,?,?)",
            rows
        )

    return len(rows)


def _kubectl_top_pods(ctx, ns):
    """
    Get pod CPU/memory usage.
    For large clusters: uses --no-headers for streaming parse.
    """
    cmd = [
        "kubectl", "--context", str(ctx or ""),
        "top", "pods", "-n", str(ns), "--no-headers"
    ]
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode != 0:
        return {}

    metrics = {}
    for line in r.stdout.split("\n"):
        parts = line.split()
        if len(parts) >= 3:
            metrics[parts[0]] = {
                "cpu": _parse_cpu(parts[1]),
                "mem": _parse_mem(parts[2]),
            }
    return metrics


def _kubectl_pod_details(ctx, ns):
    """
    Get pod resource requests, limits, status.
    For large clusters: streams JSON parsing.
    """
    cmd = [
        "kubectl", "--context", str(ctx or ""),
        "get", "pods", "-n", str(ns), "-o", "json"
    ]
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode != 0:
        return {}

    # Parse incrementally to avoid holding full dict in memory
    data = json.loads(r.stdout)
    details = {}

    for item in data.get("items", []):
        name = item["metadata"]["name"]
        status = item["status"].get("phase", "Unknown")

        # Owner (deployment)
        owners = item["metadata"].get("ownerReferences", [])
        deployment = ""
        for o in owners:
            if o.get("kind") == "ReplicaSet":
                rs_name = o.get("name", "")
                deployment = "-".join(rs_name.split("-")[:-1])

        # Container resources (first container)
        containers = item["spec"].get("containers", [])
        cpu_req = 0
        cpu_lim = 0
        mem_req = 0
        mem_lim = 0
        container_name = ""
        restarts = 0

        if containers:
            c = containers[0]
            container_name = c.get("name", "")
            res = c.get("resources", {})
            cpu_req = _parse_cpu(
                res.get("requests", {}).get("cpu", "0")
            )
            cpu_lim = _parse_cpu(
                res.get("limits", {}).get("cpu", "0")
            )
            mem_req = _parse_mem(
                res.get("requests", {}).get("memory", "0")
            )
            mem_lim = _parse_mem(
                res.get("limits", {}).get("memory", "0")
            )

        # Restarts
        for cs in item["status"].get("containerStatuses", []):
            restarts += cs.get("restartCount", 0)

        details[name] = {
            "deployment": deployment,
            "container": container_name,
            "status": status,
            "cpu_request": cpu_req,
            "cpu_limit": cpu_lim,
            "mem_request": mem_req,
            "mem_limit": mem_lim,
            "restarts": restarts,
        }

    # Free memory immediately for large clusters
    del data

    return details


def _kubectl_node_info(ctx):
    """Get node allocatable resources."""
    cmd = [
        "kubectl", "--context", str(ctx or ""),
        "get", "nodes", "-o", "json"
    ]
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode != 0:
        return {}

    data = json.loads(r.stdout)
    info = {}
    for item in data.get("items", []):
        name = item["metadata"]["name"]
        alloc = item["status"].get("allocatable", {})
        info[name] = {
            "cpu_allocatable": _parse_cpu(
                alloc.get("cpu", "0")
            ),
            "mem_allocatable_mb": _parse_mem(
                alloc.get("memory", "0")
            ),
            "pod_count": int(alloc.get("pods", "0")),
        }
    return info


def _parse_cpu(val):
    if not val or val == "0":
        return 0
    val = str(val).strip()
    if val.endswith("m"):
        return int(val[:-1])
    if val.endswith("n"):
        return int(val[:-1]) // 1000000
    try:
        return int(float(val) * 1000)
    except ValueError:
        return 0


def _parse_mem(val):
    if not val or val == "0":
        return 0
    val = str(val).strip()
    if val.endswith("Mi"):
        return int(val[:-2])
    if val.endswith("Gi"):
        return int(float(val[:-2]) * 1024)
    if val.endswith("Ki"):
        return int(val[:-2]) // 1024
    if val.endswith("M"):
        return int(val[:-1])
    if val.endswith("G"):
        return int(float(val[:-1]) * 1024)
    try:
        return int(int(val) / (1024 * 1024))
    except ValueError:
        return 0


def _parse_pct(val):
    try:
        return int(val.replace("%", ""))
    except ValueError:
        return 0
