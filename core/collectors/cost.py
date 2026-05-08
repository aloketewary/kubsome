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
    Returns optimization suggestions.
    """
    ns = context.namespace
    ctx = context.current_context

    # Get pod specs (requests/limits)
    specs = _get_pod_specs(ns, ctx)

    # Get actual usage
    usage = top_pods()

    if not specs or not usage:
        return []

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
        cpu_actual = actual["cpu_millicores"]
        mem_actual = actual["memory_mb"]

        # Over-provisioned CPU (using < 20% of request)
        if cpu_req > 0 and cpu_actual < cpu_req * 0.2:
            savings_pct = int(
                (1 - cpu_actual / cpu_req) * 100
            )
            recommendations.append({
                "pod": pod_name,
                "type": "cpu_over",
                "severity": "info",
                "title": "CPU over-provisioned",
                "detail": (
                    f"Requested: {cpu_req}m, "
                    f"Using: {cpu_actual}m "
                    f"({savings_pct}% waste)"
                ),
                "suggestion": (
                    f"Reduce CPU request to "
                    f"{max(cpu_actual * 2, 50)}m"
                ),
            })

        # Over-provisioned Memory
        if mem_req > 0 and mem_actual < mem_req * 0.3:
            savings_pct = int(
                (1 - mem_actual / mem_req) * 100
            )
            recommendations.append({
                "pod": pod_name,
                "type": "mem_over",
                "severity": "info",
                "title": "Memory over-provisioned",
                "detail": (
                    f"Requested: {mem_req}Mi, "
                    f"Using: {mem_actual}Mi "
                    f"({savings_pct}% waste)"
                ),
                "suggestion": (
                    f"Reduce memory request to "
                    f"{max(mem_actual * 2, 64)}Mi"
                ),
            })

        # Under-provisioned (using > 90% of limit)
        cpu_lim = spec.get("cpu_limit_m", 0)
        mem_lim = spec.get("mem_limit_mb", 0)

        if cpu_lim > 0 and cpu_actual > cpu_lim * 0.9:
            recommendations.append({
                "pod": pod_name,
                "type": "cpu_under",
                "severity": "warning",
                "title": "CPU near limit",
                "detail": (
                    f"Limit: {cpu_lim}m, "
                    f"Using: {cpu_actual}m (throttling likely)"
                ),
                "suggestion": (
                    f"Increase CPU limit to "
                    f"{int(cpu_actual * 1.5)}m"
                ),
            })

        if mem_lim > 0 and mem_actual > mem_lim * 0.85:
            recommendations.append({
                "pod": pod_name,
                "type": "mem_under",
                "severity": "warning",
                "title": "Memory near limit",
                "detail": (
                    f"Limit: {mem_lim}Mi, "
                    f"Using: {mem_actual}Mi (OOM risk)"
                ),
                "suggestion": (
                    f"Increase memory limit to "
                    f"{int(mem_actual * 1.5)}Mi"
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
                    f"Set requests: cpu={cpu_actual * 2}m "
                    f"mem={mem_actual * 2}Mi"
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
    cmd = (
        f"kubectl --context {ctx} "
        f"get pods -n {ns} -o json"
    )
    r = subprocess.run(
        cmd, shell=True,
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
    cmd = (
        f"kubectl --context {ctx} "
        f"get configmaps -n {ns} "
        f"-o jsonpath='{{.items[*].metadata.name}}'"
    )
    r = subprocess.run(
        cmd, shell=True,
        capture_output=True, text=True
    )
    return r.stdout.strip("'").split()


def _get_mounted_configmaps(ns, ctx):
    cmd = (
        f"kubectl --context {ctx} "
        f"get pods -n {ns} -o json"
    )
    r = subprocess.run(
        cmd, shell=True,
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
    cmd = (
        f"kubectl --context {ctx} "
        f"get pvc -n {ns} -o json"
    )
    r = subprocess.run(
        cmd, shell=True,
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
