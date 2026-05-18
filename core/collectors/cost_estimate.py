"""
Cost Estimation — estimate monthly cost per
deployment based on resource requests.

Uses AWS on-demand pricing as baseline:
- 1 vCPU = ~$30/month
- 1 GB RAM = ~$4/month
"""

from core.context import context
from core.k8s import get_raw_resources

# Approximate monthly cost (AWS on-demand, us-east-1)
CPU_COST_PER_CORE = 30.0  # $/month per vCPU
MEM_COST_PER_GB = 4.0     # $/month per GB


def estimate_costs():
    """
    Estimate monthly cost for each deployment
    based on resource requests × replica count.
    """
    ctx = context.current_context
    ns = context.namespace

    data = get_raw_resources("deployments", ctx, ns)
    estimates = []
    total = 0.0

    for item in data.get("items", []):
        name = item["metadata"]["name"]
        replicas = item["spec"].get("replicas", 1)
        containers = (
            item["spec"]
            .get("template", {})
            .get("spec", {})
            .get("containers", [])
        )

        dep_cpu_m = 0
        dep_mem_mb = 0

        for c in containers:
            requests = (
                c.get("resources", {})
                .get("requests", {})
            )
            dep_cpu_m += _parse_cpu(
                requests.get("cpu", "0")
            )
            dep_mem_mb += _parse_memory(
                requests.get("memory", "0")
            )

        # Calculate cost
        cpu_cores = dep_cpu_m / 1000.0
        mem_gb = dep_mem_mb / 1024.0

        monthly_per_pod = (
            cpu_cores * CPU_COST_PER_CORE
            + mem_gb * MEM_COST_PER_GB
        )
        monthly_total = monthly_per_pod * replicas

        total += monthly_total

        estimates.append({
            "name": name,
            "replicas": replicas,
            "cpu_request": f"{dep_cpu_m}m",
            "memory_request": f"{dep_mem_mb}Mi",
            "cost_per_pod": round(monthly_per_pod, 2),
            "cost_total": round(monthly_total, 2),
        })

    # Sort by cost descending
    estimates.sort(
        key=lambda x: x["cost_total"], reverse=True
    )

    return {
        "deployments": estimates,
        "total": round(total, 2),
        "namespace": ns,
        "pricing": {
            "cpu_per_core": CPU_COST_PER_CORE,
            "mem_per_gb": MEM_COST_PER_GB,
            "note": "Estimated (AWS on-demand baseline)",
        },
    }


def _parse_cpu(val):
    """Parse CPU to millicores."""
    val = str(val).strip()
    if val.endswith("m"):
        return int(val[:-1])
    try:
        return int(float(val) * 1000)
    except (ValueError, TypeError):
        return 0


def _parse_memory(val):
    """Parse memory to MB."""
    val = str(val).strip()
    if val.endswith("Gi"):
        return int(float(val[:-2]) * 1024)
    if val.endswith("Mi"):
        return int(val[:-2])
    if val.endswith("Ki"):
        return int(val[:-2]) // 1024
    try:
        return int(val) // (1024 * 1024)
    except (ValueError, TypeError):
        return 0
