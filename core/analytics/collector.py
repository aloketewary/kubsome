"""
Analytics Collector — periodic metric collection from kubectl
into DuckDB raw tables. Runs as background thread.

Config (~/.kubsome/config.yaml):
  analytics:
    scope: cluster        # cluster (all-ns) or namespace (active only)
    interval: 300         # seconds between collections
    max_pods: 5000        # skip full collection if cluster exceeds this
"""

import time
import json
import subprocess
import threading
from datetime import datetime

from core.context import context


_collector_thread = None
_running = False
INTERVAL = 300  # 5 minutes default


def _get_analytics_config():
    """Load analytics config with defaults."""
    from core.config import load_config
    cfg = load_config().get("analytics", {})
    return {
        "scope": cfg.get("scope", "cluster"),
        "interval": cfg.get("interval", 300),
        "max_pods": cfg.get("max_pods", 5000),
    }


def _get_pod_count(ctx):
    """Quick pod count check (lightweight, no JSON parse)."""
    cmd = [
        "kubectl", "--context", str(ctx or ""),
        "get", "pods", "--all-namespaces",
        "--no-headers", "--ignore-not-found"
    ]
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode != 0:
        return 0
    return len(r.stdout.strip().split("\n"))


def start_collector(interval=None):
    """Start background collection thread.
    Any process can collect — data goes to the queue.
    Only the DB-owning process drains the queue.
    """
    global _collector_thread, _running, INTERVAL
    cfg = _get_analytics_config()
    INTERVAL = interval or cfg["interval"]
    if _running:
        return

    _running = True
    _collector_thread = threading.Thread(
        target=_collection_loop, daemon=True
    )
    _collector_thread.start()

    # If we own the DB, also start the drain loop
    try:
        from core.analytics.engine import is_writable
        if is_writable():
            from core.analytics.queue import start_drain_loop
            start_drain_loop(interval=5)
    except Exception:
        pass


def stop_collector():
    """Stop background collection."""
    global _running
    _running = False


def collect_now():
    """Run a single collection cycle and drain queue. Returns stats."""
    result = _collect_cycle()
    # Drain immediately so data is visible right away
    try:
        from core.analytics.queue import drain
        from core.analytics.engine import is_writable
        if is_writable():
            drain()
            # Aggregate raw → hourly/daily after drain
            from core.analytics.aggregator import (
                aggregate_hourly, aggregate_daily,
            )
            aggregate_hourly()
            aggregate_daily()
    except Exception:
        pass
    return result


def _collection_loop():
    """Background loop — collect every INTERVAL seconds."""
    # Wait for cluster connection on startup
    time.sleep(15)
    while _running:
        try:
            _collect_cycle()
            # Aggregate after each cycle
            from core.analytics.aggregator import (
                aggregate_hourly, aggregate_daily,
            )
            aggregate_hourly()
            aggregate_daily()
        except ImportError:
            # DuckDB not installed — stop trying
            break
        except Exception:
            pass
        time.sleep(INTERVAL)


def _collect_cycle():
    """
    Single collection: pods + nodes → DuckDB.
    Respects config:
      scope: cluster|namespace
      max_pods: skip if cluster exceeds limit
    """
    start = time.time()
    ctx = context.current_context

    if not ctx:
        return {"pods": 0, "nodes": 0}

    cfg = _get_analytics_config()
    scope = cfg["scope"]
    max_pods = cfg["max_pods"]

    # Determine namespace scope
    ns = None  # all-namespaces
    if scope == "namespace":
        ns = context.namespace

    # Guard: check pod count before full collection
    # If cluster scope fails (RBAC), fall back to namespace
    if scope == "cluster" and ns is None:
        pod_count = _get_pod_count(ctx)
        if pod_count == 0 or pod_count > max_pods:
            ns = context.namespace

    ts = datetime.utcnow()

    pods_collected = _collect_pods(ts, ctx, ns)
    nodes_collected = _collect_nodes(ts, ctx)

    duration_ms = int((time.time() - start) * 1000)

    # Log collection via queue
    from core.analytics.queue import enqueue
    enqueue("collection_log", {
        "ts": str(ts), "level": "raw",
        "pods": pods_collected, "nodes": nodes_collected,
        "duration_ms": duration_ms,
    })

    # Enriched collection (HPA, OOMKills, quotas, rollouts)
    try:
        from core.analytics.enriched_collector import collect_enriched
        collect_enriched()
    except Exception:
        pass

    # Fetch shared data for state cache + health
    pods_raw = _kubectl_json(ctx, "pods", ns)
    events_raw = _kubectl_json(ctx, "events", ns)
    metrics_map = _kubectl_top_pods(ctx, ns)

    # Refresh state cache for instant reads
    try:
        from core.analytics.state_cache import refresh_state
        from core.analytics.engine import get_conn
        conn = get_conn()
        deps_raw = _kubectl_json(ctx, "deployments", ns)
        nodes_raw = _kubectl_json(ctx, "nodes", None)
        refresh_state(
            conn, ctx, ns, pods_raw, deps_raw,
            nodes_raw, events_raw
        )
    except Exception:
        pass

    # Compute and persist health scores
    try:
        from core.analytics.health import (
            compute_health, resolve_incidents,
        )
        compute_health(
            ts, ctx, ns or context.namespace,
            pods_raw, events_raw, metrics_map
        )
        resolve_incidents(ctx, ns or context.namespace)
    except Exception:
        pass


    return {
        "pods": pods_collected,
        "nodes": nodes_collected,
        "duration_ms": duration_ms,
    }


def _kubectl_json(ctx, resource, ns=None):
    """Fetch raw kubectl JSON. Uses --all-namespaces when ns is None."""
    cmd = [
        "kubectl", "--context", str(ctx or ""),
        "get", resource, "-o", "json"
    ]
    if ns:
        cmd.extend(["-n", str(ns)])
    elif resource != "nodes":
        cmd.append("--all-namespaces")
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode != 0:
        return {}
    return json.loads(r.stdout)


def _collect_pods(ts, ctx, ns=None):
    """
    Collect pod metrics and resource requests/limits.
    ns=None means all namespaces (cluster scope).
    """
    metrics = _kubectl_top_pods(ctx, ns)
    if not metrics:
        return 0

    details = _kubectl_pod_details(ctx, ns)

    # Batch into queue
    from core.analytics.queue import enqueue
    BATCH_SIZE = 1000
    batch = []
    total = 0

    for pod_key, m in metrics.items():
        detail = details.get(pod_key, {})
        pod_ns = detail.get("namespace", m.get("namespace", ""))
        pod_name = m.get("name", pod_key)
        batch.append([
            str(ts), ctx, pod_ns, pod_name,
            detail.get("deployment", ""),
            detail.get("container", ""),
            m["cpu"], m["mem"],
            detail.get("cpu_request", 0),
            detail.get("cpu_limit", 0),
            detail.get("mem_request", 0),
            detail.get("mem_limit", 0),
            detail.get("restarts", 0),
            detail.get("status", ""),
        ])

        if len(batch) >= BATCH_SIZE:
            enqueue("pod_metrics", {"rows": batch})
            total += len(batch)
            batch = []

    if batch:
        enqueue("pod_metrics", {"rows": batch})
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
        from core.analytics.queue import enqueue
        enqueue("node_metrics", {"rows": rows})

    return len(rows)


def _kubectl_top_pods(ctx, ns=None):
    """
    Get pod CPU/memory usage.
    ns=None uses --all-namespaces, otherwise -n <ns>.
    """
    cmd = [
        "kubectl", "--context", str(ctx or ""),
        "top", "pods", "--no-headers"
    ]
    if ns:
        cmd.extend(["-n", str(ns)])
    else:
        cmd.append("--all-namespaces")

    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode != 0:
        return {}

    metrics = {}
    for line in r.stdout.split("\n"):
        parts = line.split()
        if ns:
            # Format: NAME CPU MEM
            if len(parts) >= 3:
                key = f"{ns}/{parts[0]}"
                metrics[key] = {
                    "namespace": ns,
                    "name": parts[0],
                    "cpu": _parse_cpu(parts[1]),
                    "mem": _parse_mem(parts[2]),
                }
        else:
            # Format: NAMESPACE NAME CPU MEM
            if len(parts) >= 4:
                key = f"{parts[0]}/{parts[1]}"
                metrics[key] = {
                    "namespace": parts[0],
                    "name": parts[1],
                    "cpu": _parse_cpu(parts[2]),
                    "mem": _parse_mem(parts[3]),
                }
    return metrics


def _kubectl_pod_details(ctx, ns=None):
    """
    Get pod resource requests, limits, status.
    ns=None uses --all-namespaces.
    """
    cmd = [
        "kubectl", "--context", str(ctx or ""),
        "get", "pods", "-o", "json"
    ]
    if ns:
        cmd.extend(["-n", str(ns)])
    else:
        cmd.append("--all-namespaces")

    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode != 0:
        return {}

    data = json.loads(r.stdout)
    details = {}

    for item in data.get("items", []):
        name = item["metadata"]["name"]
        pod_ns = item["metadata"].get("namespace", "")
        key = f"{pod_ns}/{name}"
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

        details[key] = {
            "namespace": pod_ns,
            "deployment": deployment,
            "container": container_name,
            "status": status,
            "cpu_request": cpu_req,
            "cpu_limit": cpu_lim,
            "mem_request": mem_req,
            "mem_limit": mem_lim,
            "restarts": restarts,
        }

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
