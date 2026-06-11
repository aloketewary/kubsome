import subprocess
import json
import re

from core.context import context
from core.cache import cached


@cached(ttl=5)
def top_pods():
    command = [
        "kubectl",
        "--context", str(context.current_context or ""),
        "top", "pods",
        "-n", str(context.namespace),
        "--no-headers"
    ]

    result = subprocess.run(
        command,
        capture_output=True,
        text=True
    )

    if result.returncode != 0:
        return []

    pods = []
    for line in result.stdout.strip().split("\n"):
        if not line.strip():
            continue
        parts = line.split()
        if len(parts) >= 3:
            pods.append({
                "name": parts[0],
                "cpu": parts[1],
                "memory": parts[2],
                "cpu_millicores": _parse_cpu(parts[1]),
                "memory_mb": _parse_memory(parts[2]),
            })

    return sorted(
        pods, key=lambda x: x["cpu_millicores"],
        reverse=True
    )


@cached(ttl=10)
def node_workloads():
    """Return pods grouped by node for the current namespace."""
    command = [
        "kubectl",
        "--context", str(context.current_context or ""),
        "get", "pods",
        "-n", str(context.namespace),
        "-o", "json"
    ]
    result = subprocess.run(
        command, capture_output=True, text=True
    )
    if result.returncode != 0:
        return {}

    data = json.loads(result.stdout)
    nodes = {}
    # Pre-populate with all known nodes so empty ones still appear
    for item in data.get("items", []):
        node = item.get("spec", {}).get("nodeName", "unscheduled")
        if not node:
            continue
        name = item["metadata"]["name"]
        phase = item.get("status", {}).get("phase", "Unknown")
        labels = item.get("metadata", {}).get("labels", {})
        deploy = labels.get(
            "app",
            labels.get("app.kubernetes.io/name", "")
        )

        if node not in nodes:
            nodes[node] = []
        nodes[node].append({
            "name": name,
            "namespace": str(context.namespace),
            "status": phase,
            "deployment": deploy,
        })
    return nodes


@cached(ttl=5)
def top_nodes():
    command = [
        "kubectl",
        "--context", str(context.current_context or ""),
        "top", "nodes",
        "--no-headers"
    ]

    result = subprocess.run(
        command,
        capture_output=True,
        text=True
    )

    if result.returncode != 0:
        return []

    nodes = []
    for line in result.stdout.strip().split("\n"):
        if not line.strip():
            continue
        parts = line.split()
        if len(parts) >= 5:
            nodes.append({
                "name": parts[0],
                "cpu": parts[1],
                "cpu_percent": parts[2],
                "memory": parts[3],
                "memory_percent": parts[4],
                "cpu_pct_val": _parse_percent(parts[2]),
                "mem_pct_val": _parse_percent(parts[4]),
            })

    return sorted(
        nodes, key=lambda x: x["cpu_pct_val"],
        reverse=True
    )


def _parse_cpu(val):
    """Parse cpu string like '250m' or '1' to millicores."""
    if val.endswith("m"):
        return int(val[:-1])
    if val.endswith("n"):
        return int(val[:-1]) // 1000000
    try:
        return int(float(val) * 1000)
    except ValueError:
        return 0


def _parse_memory(val):
    """Parse memory string like '128Mi' or '1Gi' to MB."""
    val = val.strip()
    if val.endswith("Mi"):
        return int(val[:-2])
    if val.endswith("Gi"):
        return int(float(val[:-2]) * 1024)
    if val.endswith("Ki"):
        return int(val[:-2]) // 1024
    try:
        return int(val) // (1024 * 1024)
    except ValueError:
        return 0


def _parse_percent(val):
    """Parse '45%' to 45."""
    try:
        return int(val.replace("%", ""))
    except ValueError:
        return 0

@cached(ttl=10)
def pod_resource_specs():
    """Return resource requests/limits for each pod."""
    from core.k8s import get_raw_resources
    data = get_raw_resources(
        "pods", context.current_context, context.namespace
    )
    specs = {}
    for item in data.get("items", []):
        name = item["metadata"]["name"]
        containers = item.get("spec", {}).get("containers", [])
        total_req_cpu = 0
        total_req_mem = 0
        total_lim_cpu = 0
        total_lim_mem = 0
        for c in containers:
            res = c.get("resources", {})
            req = res.get("requests", {})
            lim = res.get("limits", {})
            total_req_cpu += _parse_cpu(req.get("cpu", "0"))
            total_req_mem += _parse_memory(req.get("memory", "0"))
            total_lim_cpu += _parse_cpu(lim.get("cpu", "0"))
            total_lim_mem += _parse_memory(lim.get("memory", "0"))
        specs[name] = {
            "cpu_request_m": total_req_cpu,
            "mem_request_mb": total_req_mem,
            "cpu_limit_m": total_lim_cpu,
            "mem_limit_mb": total_lim_mem,
        }
    return specs
