"""
Gateway Monitor — collects deployment-level resource metrics,
HPA status, and pod readiness for operational overview.
"""

import json
import subprocess
from core.context import context


def collect_gateway_monitor():
    """
    Collect comprehensive deployment metrics including HPA,
    CPU/memory requests/usage, and pod readiness.
    """
    ctx = context.current_context
    ns = context.namespace

    deployments = _get_deployments(ctx, ns)
    hpas = _get_hpas(ctx, ns)
    pod_metrics = _get_pod_metrics(ctx, ns)

    results = []
    for dep in deployments:
        name = dep["metadata"]["name"]
        spec = dep["spec"]
        status = dep.get("status", {})
        containers = spec.get("template", {}).get("spec", {}).get("containers", [])

        desired = spec.get("replicas", 0)
        ready = status.get("readyReplicas", 0)
        not_ready = desired - ready

        # Extract version from image tag
        version = ""
        if containers:
            img = containers[0].get("image", "")
            version = img.split(":")[-1] if ":" in img else "latest"

        # CPU/MEM requests and limits per pod
        cpu_req_m = 0
        mem_req_mi = 0
        mem_limit_mi = 0
        for c in containers:
            res = c.get("resources", {})
            cpu_req_m += _parse_cpu(res.get("requests", {}).get("cpu", "0"))
            mem_req_mi += _parse_mem(res.get("requests", {}).get("memory", "0"))
            mem_limit_mi += _parse_mem(res.get("limits", {}).get("memory", "0"))

        # Actual usage from metrics
        cpu_usage_m, mem_usage_mi = _get_deployment_usage(
            name, pod_metrics
        )
        avg_cpu_usage = round(cpu_usage_m / ready, 2) if ready > 0 else 0
        avg_mem_usage = round(mem_usage_mi / ready, 2) if ready > 0 else 0

        # HPA
        hpa = hpas.get(name, {})
        hpa_cpu_target = hpa.get("cpu_target", None)
        hpa_cpu_current = hpa.get("cpu_current", None)
        hpa_mem_target = hpa.get("mem_target", None)
        hpa_mem_current = hpa.get("mem_current", None)

        # Ratios
        mem_req_limit_ratio = (
            round(mem_req_mi / mem_limit_mi, 2)
            if mem_limit_mi > 0 else 0
        )

        results.append({
            "deployment": name,
            "cluster": ctx,
            "version": version,
            "pods": desired,
            "pods_not_ready": not_ready,
            "cpu_req_per_pod": cpu_req_m,
            "cpu_usage_per_pod": avg_cpu_usage,
            "cpu_req_sum": round(cpu_req_m * desired / 1000, 2),
            "cpu_usage_sum": round(cpu_usage_m / 1000, 2),
            "hpa_cpu_target": hpa_cpu_target,
            "hpa_cpu_current": hpa_cpu_current,
            "hpa_mem_target": hpa_mem_target,
            "hpa_mem_current": hpa_mem_current,
            "mem_req_per_pod": mem_req_mi,
            "mem_usage_per_pod": avg_mem_usage,
            "mem_limit_per_pod": mem_limit_mi,
            "mem_req_limit_ratio": mem_req_limit_ratio,
            "workload": dep.get("metadata", {}).get("labels", {}).get("workload", ""),
            "lba": dep.get("metadata", {}).get("annotations", {}).get("service.beta.kubernetes.io/aws-load-balancer-type", ""),
            "note": "",
        })

    return results


def _get_deployments(ctx, ns):
    cmd = (
        f"kubectl --context {ctx} get deployments "
        f"-n {ns} -o json"
    )
    result = subprocess.run(cmd, shell=True, capture_output=True, text=True)
    if result.returncode != 0:
        return []
    data = json.loads(result.stdout)
    return data.get("items", [])


def _get_hpas(ctx, ns):
    cmd = (
        f"kubectl --context {ctx} get hpa "
        f"-n {ns} -o json"
    )
    result = subprocess.run(cmd, shell=True, capture_output=True, text=True)
    if result.returncode != 0:
        return {}
    data = json.loads(result.stdout)
    hpas = {}
    for item in data.get("items", []):
        target_name = (
            item.get("spec", {})
            .get("scaleTargetRef", {})
            .get("name", "")
        )
        metrics = item.get("spec", {}).get("metrics", [])
        status_metrics = item.get("status", {}).get("currentMetrics", [])

        cpu_target = None
        mem_target = None
        cpu_current = None
        mem_current = None

        for m in metrics:
            res = m.get("resource", {})
            if res.get("name") == "cpu":
                cpu_target = (
                    res.get("target", {})
                    .get("averageUtilization")
                )
            elif res.get("name") == "memory":
                mem_target = (
                    res.get("target", {})
                    .get("averageUtilization")
                )

        for m in (status_metrics or []):
            res = m.get("resource", {})
            if res.get("name") == "cpu":
                cpu_current = (
                    res.get("current", {})
                    .get("averageUtilization")
                )
            elif res.get("name") == "memory":
                mem_current = (
                    res.get("current", {})
                    .get("averageUtilization")
                )

        hpas[target_name] = {
            "cpu_target": cpu_target,
            "cpu_current": cpu_current,
            "mem_target": mem_target,
            "mem_current": mem_current,
        }
    return hpas


def _get_pod_metrics(ctx, ns):
    cmd = (
        f"kubectl --context {ctx} top pods "
        f"-n {ns} --no-headers"
    )
    result = subprocess.run(cmd, shell=True, capture_output=True, text=True)
    if result.returncode != 0:
        return {}
    metrics = {}
    for line in result.stdout.strip().split("\n"):
        parts = line.split()
        if len(parts) >= 3:
            name = parts[0]
            cpu = _parse_cpu(parts[1])
            mem = _parse_mem(parts[2])
            metrics[name] = {"cpu": cpu, "mem": mem}
    return metrics


def _get_deployment_usage(dep_name, pod_metrics):
    total_cpu = 0
    total_mem = 0
    for pod_name, m in pod_metrics.items():
        if pod_name.startswith(dep_name):
            total_cpu += m["cpu"]
            total_mem += m["mem"]
    return total_cpu, total_mem


def _parse_cpu(val):
    """Parse CPU value to millicores."""
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
    """Parse memory value to Mi."""
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
