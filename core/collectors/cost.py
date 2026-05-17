"""
Resource Optimization — identifies over/under-provisioned
workloads by comparing requests/limits vs actual usage.
"""

import subprocess
import json

from core.context import context
from core.collectors.metrics import top_pods


def resource_recommendations():
    """
    Compare pod resource requests vs actual usage.
    Uses historical metrics when available (peak/p95),
    falls back to current snapshot.
    """
    ns = context.namespace
    ctx = context.current_context

    # Get pod specs (requests/limits)
    specs = _get_pod_specs(ns, ctx)

    # Get actual usage
    usage = top_pods()

    if not specs or not usage:
        return []

    # Try to get historical data
    from core.collectors.metrics_history import (
        get_all_pod_history, record_snapshot
    )
    try:
        record_snapshot()
        history = get_all_pod_history()
    except Exception:
        history = {}

    # Build usage map
    usage_map = {
        p["name"]: p for p in usage
    }

    recommendations = []

    for pod_name, spec in specs.items():
        actual = usage_map.get(pod_name)
        if not actual:
            continue

        cpu_req = spec.get("cpu_request_m", 0)
        mem_req = spec.get("mem_request_mb", 0)

        # Use historical peak/p95 if available, else current
        hist = history.get(pod_name)
        if hist and hist["samples"] >= 6:
            cpu_peak = hist["cpu_p95"]
            mem_peak = hist["mem_p95"]
            data_source = f"{hist['samples']} samples"
        else:
            cpu_peak = actual["cpu_millicores"]
            mem_peak = actual["memory_mb"]
            data_source = "point-in-time"

        # Over-provisioned CPU (p95 usage < 20% of request)
        if cpu_req > 0 and cpu_peak < cpu_req * 0.2:
            savings_pct = int(
                (1 - cpu_peak / cpu_req) * 100
            )
            # Suggest 1.5x p95 as safe headroom
            suggested = max(int(cpu_peak * 1.5), 50)
            recommendations.append({
                "pod": pod_name,
                "type": "cpu_over",
                "severity": "info",
                "title": "CPU over-provisioned",
                "detail": (
                    f"Requested: {cpu_req}m, "
                    f"Peak(p95): {cpu_peak}m "
                    f"({savings_pct}% idle)"
                ),
                "suggestion": (
                    f"Consider reducing CPU request to "
                    f"{suggested}m (1.5x p95)"
                ),
                "current": f"{cpu_req}m",
                "suggested": f"{suggested}m",
                "data_source": data_source,
            })

        # Over-provisioned Memory
        if mem_req > 0 and mem_peak < mem_req * 0.3:
            savings_pct = int(
                (1 - mem_peak / mem_req) * 100
            )
            suggested = max(int(mem_peak * 1.3), 64)
            recommendations.append({
                "pod": pod_name,
                "type": "mem_over",
                "severity": "info",
                "title": "Memory over-provisioned",
                "detail": (
                    f"Requested: {mem_req}Mi, "
                    f"Peak(p95): {mem_peak}Mi "
                    f"({savings_pct}% idle)"
                ),
                "suggestion": (
                    f"Consider reducing memory request to "
                    f"{suggested}Mi (1.3x p95)"
                ),
                "current": f"{mem_req}Mi",
                "suggested": f"{suggested}Mi",
                "data_source": data_source,
            })

        # Under-provisioned (using > 90% of limit)
        cpu_lim = spec.get("cpu_limit_m", 0)
        mem_lim = spec.get("mem_limit_mb", 0)
        cpu_now = actual["cpu_millicores"]
        mem_now = actual["memory_mb"]

        if cpu_lim > 0 and cpu_now > cpu_lim * 0.9:
            recommendations.append({
                "pod": pod_name,
                "type": "cpu_under",
                "severity": "warning",
                "title": "CPU near limit",
                "detail": (
                    f"Limit: {cpu_lim}m, "
                    f"Using: {cpu_now}m (throttling likely)"
                ),
                "suggestion": (
                    f"Increase CPU limit to "
                    f"{int(cpu_now * 1.5)}m"
                ),
            })

        if mem_lim > 0 and mem_now > mem_lim * 0.85:
            recommendations.append({
                "pod": pod_name,
                "type": "mem_under",
                "severity": "warning",
                "title": "Memory near limit",
                "detail": (
                    f"Limit: {mem_lim}Mi, "
                    f"Using: {mem_now}Mi (OOM risk)"
                ),
                "suggestion": (
                    f"Increase memory limit to "
                    f"{int(mem_now * 1.5)}Mi"
                ),
            })

        # No requests set
        if cpu_req == 0 and mem_req == 0:
            recommendations.append({
                "pod": pod_name,
                "type": "no_requests",
                "severity": "warning",
                "title": "No resource requests",
                "detail": "Pod has no CPU/memory requests set",
                "suggestion": (
                    f"Set requests: cpu={cpu_now * 2}m "
                    f"mem={mem_now * 2}Mi"
                ),
            })

    return sorted(
        recommendations,
        key=lambda r: (
            {"warning": 0, "info": 1}.get(
                r["severity"], 2
            )
        )
    )


def find_unused_resources():
    """Find orphaned configmaps, secrets, PVCs."""
    ns = context.namespace
    ctx = context.current_context

    unused = []

    # Find configmaps not mounted by any pod
    cms = _get_configmaps(ns, ctx)
    mounted_cms = _get_mounted_configmaps(ns, ctx)

    system_prefixes = ("kube-", "istio", "default-token")
    for cm in cms:
        if cm.startswith(system_prefixes):
            continue
        if cm not in mounted_cms:
            unused.append({
                "kind": "ConfigMap",
                "name": cm,
            })

    # Find unbound PVCs
    pvcs = _get_unbound_pvcs(ns, ctx)
    for pvc in pvcs:
        unused.append({
            "kind": "PVC",
            "name": pvc,
        })

    return unused


def _get_pod_specs(ns, ctx):
    cmd = [
        "kubectl", "--context", str(ctx or ""),
        "get", "pods", "-n", str(ns), "-o", "json"
    ]
    r = subprocess.run(
        cmd,
        capture_output=True, text=True
    )
    if r.returncode != 0:
        return {}

    data = json.loads(r.stdout)
    specs = {}

    for item in data.get("items", []):
        name = item["metadata"]["name"]
        containers = item["spec"].get("containers", [])
        if not containers:
            continue

        c = containers[0]
        resources = c.get("resources", {})
        requests = resources.get("requests", {})
        limits = resources.get("limits", {})

        specs[name] = {
            "cpu_request_m": _parse_cpu(
                requests.get("cpu", "0")
            ),
            "mem_request_mb": _parse_mem(
                requests.get("memory", "0")
            ),
            "cpu_limit_m": _parse_cpu(
                limits.get("cpu", "0")
            ),
            "mem_limit_mb": _parse_mem(
                limits.get("memory", "0")
            ),
        }

    return specs


def _get_configmaps(ns, ctx):
    cmd = [
        "kubectl", "--context", str(ctx or ""),
        "get", "configmaps", "-n", str(ns),
        "-o", "jsonpath={.items[*].metadata.name}"
    ]
    r = subprocess.run(
        cmd,
        capture_output=True, text=True
    )
    return r.stdout.strip().split()


def _get_mounted_configmaps(ns, ctx):
    cmd = [
        "kubectl", "--context", str(ctx or ""),
        "get", "pods", "-n", str(ns), "-o", "json"
    ]
    r = subprocess.run(
        cmd,
        capture_output=True, text=True
    )
    if r.returncode != 0:
        return set()

    data = json.loads(r.stdout)
    mounted = set()

    for item in data.get("items", []):
        volumes = item["spec"].get("volumes", [])
        for v in volumes:
            if "configMap" in v:
                mounted.add(v["configMap"]["name"])

        # Also check envFrom
        for c in item["spec"].get("containers", []):
            for ef in c.get("envFrom", []):
                if "configMapRef" in ef:
                    mounted.add(
                        ef["configMapRef"]["name"]
                    )

    return mounted


def _get_unbound_pvcs(ns, ctx):
    cmd = [
        "kubectl", "--context", str(ctx or ""),
        "get", "pvc", "-n", str(ns), "-o", "json"
    ]
    r = subprocess.run(
        cmd,
        capture_output=True, text=True
    )
    if r.returncode != 0:
        return []

    data = json.loads(r.stdout)
    unbound = []

    for item in data.get("items", []):
        phase = item["status"].get("phase", "")
        if phase != "Bound":
            unbound.append(
                item["metadata"]["name"]
            )

    return unbound


def _parse_cpu(val):
    if not val or val == "0":
        return 0
    if val.endswith("m"):
        return int(val[:-1])
    try:
        return int(float(val) * 1000)
    except ValueError:
        return 0


def _parse_mem(val):
    if not val or val == "0":
        return 0
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
