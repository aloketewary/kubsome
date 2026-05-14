"""
Scaling Intelligence — HPA, PDB, capacity planning,
resource quotas, and drain safety checks.
"""

import subprocess
import json

from core.context import context
from core.cache import cached


@cached(ttl=10)
def list_hpa():
    """List HorizontalPodAutoscalers with current state."""
    ns = context.namespace
    ctx = context.current_context

    if not ctx:
        return []

    cmd = (
        f"kubectl --context {ctx} "
        f"get hpa -n {ns} -o json"
    )

    r = subprocess.run(
        cmd, shell=True,
        capture_output=True, text=True
    )

    if r.returncode != 0 or not r.stdout.strip():
        return []

    try:
        data = json.loads(r.stdout)
    except (json.JSONDecodeError, ValueError):
        return []
    hpas = []

    for item in data.get("items", []):
        spec = item["spec"]
        status = item.get("status", {})

        hpas.append({
            "name": item["metadata"]["name"],
            "target": spec.get(
                "scaleTargetRef", {}
            ).get("name", ""),
            "min": spec.get("minReplicas", 1),
            "max": spec.get("maxReplicas", 1),
            "current": status.get(
                "currentReplicas", 0
            ),
            "desired": status.get(
                "desiredReplicas", 0
            ),
            "metrics": _parse_hpa_metrics(status),
        })

    return hpas


@cached(ttl=10)
def list_pdb():
    """List PodDisruptionBudgets."""
    ns = context.namespace
    ctx = context.current_context

    cmd = (
        f"kubectl --context {ctx} "
        f"get pdb -n {ns} -o json"
    )

    r = subprocess.run(
        cmd, shell=True,
        capture_output=True, text=True
    )

    if r.returncode != 0:
        return []

    data = json.loads(r.stdout)
    pdbs = []

    for item in data.get("items", []):
        spec = item["spec"]
        status = item.get("status", {})

        pdbs.append({
            "name": item["metadata"]["name"],
            "min_available": spec.get(
                "minAvailable", "N/A"
            ),
            "max_unavailable": spec.get(
                "maxUnavailable", "N/A"
            ),
            "current_healthy": status.get(
                "currentHealthy", 0
            ),
            "desired_healthy": status.get(
                "desiredHealthy", 0
            ),
            "disruptions_allowed": status.get(
                "disruptionsAllowed", 0
            ),
            "expected_pods": status.get(
                "expectedPods", 0
            ),
        })

    return pdbs


def cluster_capacity():
    """Calculate cluster headroom — how much capacity remains."""
    ctx = context.current_context

    # Get node allocatable resources
    cmd = (
        f"kubectl --context {ctx} "
        f"get nodes -o json"
    )

    r = subprocess.run(
        cmd, shell=True,
        capture_output=True, text=True
    )

    if r.returncode != 0:
        return None

    data = json.loads(r.stdout)

    total_cpu_m = 0
    total_mem_mb = 0
    allocatable_cpu_m = 0
    allocatable_mem_mb = 0

    for node in data.get("items", []):
        alloc = node["status"].get("allocatable", {})
        allocatable_cpu_m += _parse_cpu(
            alloc.get("cpu", "0")
        )
        allocatable_mem_mb += _parse_mem(
            alloc.get("memory", "0")
        )

    # Get total requested across all pods
    cmd2 = (
        f"kubectl --context {ctx} "
        f"get pods --all-namespaces -o json"
    )

    r2 = subprocess.run(
        cmd2, shell=True,
        capture_output=True, text=True
    )

    requested_cpu_m = 0
    requested_mem_mb = 0

    if r2.returncode == 0:
        pods_data = json.loads(r2.stdout)
        for pod in pods_data.get("items", []):
            if pod["status"].get("phase") != "Running":
                continue
            for c in pod["spec"].get("containers", []):
                req = c.get("resources", {}).get(
                    "requests", {}
                )
                requested_cpu_m += _parse_cpu(
                    req.get("cpu", "0")
                )
                requested_mem_mb += _parse_mem(
                    req.get("memory", "0")
                )

    free_cpu = allocatable_cpu_m - requested_cpu_m
    free_mem = allocatable_mem_mb - requested_mem_mb

    cpu_pct = (
        int((requested_cpu_m / allocatable_cpu_m) * 100)
        if allocatable_cpu_m > 0 else 0
    )
    mem_pct = (
        int((requested_mem_mb / allocatable_mem_mb) * 100)
        if allocatable_mem_mb > 0 else 0
    )

    return {
        "nodes": len(data.get("items", [])),
        "allocatable_cpu_m": allocatable_cpu_m,
        "allocatable_mem_mb": allocatable_mem_mb,
        "requested_cpu_m": requested_cpu_m,
        "requested_mem_mb": requested_mem_mb,
        "free_cpu_m": max(0, free_cpu),
        "free_mem_mb": max(0, free_mem),
        "cpu_used_pct": cpu_pct,
        "mem_used_pct": mem_pct,
    }


def namespace_quota():
    """Get resource quota usage for current namespace."""
    ns = context.namespace
    ctx = context.current_context

    cmd = (
        f"kubectl --context {ctx} "
        f"get resourcequota -n {ns} -o json"
    )

    r = subprocess.run(
        cmd, shell=True,
        capture_output=True, text=True
    )

    if r.returncode != 0:
        return []

    data = json.loads(r.stdout)
    quotas = []

    for item in data.get("items", []):
        status = item.get("status", {})
        hard = status.get("hard", {})
        used = status.get("used", {})

        resources = []
        for key in hard:
            resources.append({
                "resource": key,
                "used": used.get(key, "0"),
                "limit": hard[key],
            })

        quotas.append({
            "name": item["metadata"]["name"],
            "resources": resources,
        })

    return quotas


def drain_check(node_name):
    """Preview impact of draining a node."""
    ctx = context.current_context

    cmd = (
        f"kubectl --context {ctx} "
        f"get pods --all-namespaces "
        f"--field-selector spec.nodeName={node_name} "
        f"-o json"
    )

    r = subprocess.run(
        cmd, shell=True,
        capture_output=True, text=True
    )

    if r.returncode != 0:
        return None

    data = json.loads(r.stdout)

    pods_on_node = []
    for pod in data.get("items", []):
        ns = pod["metadata"]["namespace"]
        name = pod["metadata"]["name"]
        owners = pod["metadata"].get(
            "ownerReferences", []
        )

        kind = "standalone"
        if owners:
            kind = owners[0].get("kind", "unknown")

        pods_on_node.append({
            "name": name,
            "namespace": ns,
            "owner_kind": kind,
            "safe": kind in (
                "ReplicaSet", "DaemonSet",
                "StatefulSet", "Job"
            ),
        })

    safe = sum(1 for p in pods_on_node if p["safe"])
    unsafe = sum(1 for p in pods_on_node if not p["safe"])

    return {
        "node": node_name,
        "total_pods": len(pods_on_node),
        "safe_to_evict": safe,
        "unsafe": unsafe,
        "pods": pods_on_node,
    }


def _parse_hpa_metrics(status):
    metrics = []
    for m in status.get("currentMetrics", []):
        if "resource" in m:
            res = m["resource"]
            metrics.append({
                "name": res.get("name", ""),
                "current": res.get(
                    "current", {}
                ).get("averageUtilization", 0),
            })
    return metrics


def _parse_cpu(val):
    if not val or val == "0":
        return 0
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
    if val.endswith("Ki"):
        return int(val[:-2]) // 1024
    if val.endswith("Mi"):
        return int(val[:-2])
    if val.endswith("Gi"):
        return int(float(val[:-2]) * 1024)
    try:
        return int(val) // (1024 * 1024)
    except ValueError:
        return 0
