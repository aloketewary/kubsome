"""
Cost Trend — analyze resource usage over time
and forecast future monthly cost.

Uses metrics_history data to calculate:
- Current vs peak usage ratio
- Growth trend (linear regression)
- Projected cost at current growth rate
"""

import time
from pathlib import Path

from core.collectors.cost_estimate import (
    estimate_costs, CPU_COST_PER_CORE, MEM_COST_PER_GB
)
from core.collectors.metrics_history import get_all_pod_history


def cost_trend():
    """
    Analyze cost trend using historical metrics.
    Returns current cost, projected cost, and savings opportunity.
    """
    current = estimate_costs()
    history = get_all_pod_history()

    if not current["deployments"]:
        return {
            "current_monthly": 0,
            "projected_monthly": 0,
            "trend": "stable",
            "savings_opportunity": 0,
            "deployments": [],
            "has_history": False,
        }

    has_history = bool(history)
    deployments = []
    total_savings = 0.0

    for dep in current["deployments"]:
        name = dep["name"]
        entry = {
            "name": name,
            "current_cost": dep["cost_total"],
            "replicas": dep["replicas"],
        }

        # Find matching pod history
        matching_history = [
            (pod, data) for pod, data in history.items()
            if name in pod
        ]

        if matching_history:
            # Aggregate across pods of this deployment
            total_cpu_avg = sum(
                d["cpu_avg"] for _, d in matching_history
            )
            total_cpu_peak = max(
                d["cpu_peak"] for _, d in matching_history
            )
            total_mem_avg = sum(
                d["mem_avg"] for _, d in matching_history
            )
            total_mem_peak = max(
                d["mem_peak"] for _, d in matching_history
            )
            samples = max(
                d["samples"] for _, d in matching_history
            )

            # Right-size cost (based on p95 usage)
            total_cpu_p95 = sum(
                d["cpu_p95"] for _, d in matching_history
            )
            total_mem_p95 = sum(
                d["mem_p95"] for _, d in matching_history
            )

            rightsize_cost = (
                (total_cpu_p95 / 1000.0) * CPU_COST_PER_CORE
                + (total_mem_p95 / 1024.0) * MEM_COST_PER_GB
            )

            savings = max(
                0, dep["cost_total"] - rightsize_cost
            )
            total_savings += savings

            entry.update({
                "cpu_avg_m": total_cpu_avg,
                "cpu_peak_m": total_cpu_peak,
                "mem_avg_mb": total_mem_avg,
                "mem_peak_mb": total_mem_peak,
                "rightsize_cost": round(rightsize_cost, 2),
                "savings": round(savings, 2),
                "samples": samples,
                "utilization_pct": _utilization(
                    dep, total_cpu_avg, total_mem_avg
                ),
            })
        else:
            entry.update({
                "savings": 0,
                "utilization_pct": None,
            })

        deployments.append(entry)

    # Sort by savings opportunity
    deployments.sort(key=lambda x: -x["savings"])

    # Trend detection (simple: compare first half vs second half of history)
    trend = _detect_trend(history)

    # Project cost at current growth
    growth_factor = {
        "growing": 1.15,
        "stable": 1.0,
        "shrinking": 0.90,
    }.get(trend, 1.0)

    projected = current["total"] * growth_factor

    return {
        "current_monthly": current["total"],
        "projected_monthly": round(projected, 2),
        "trend": trend,
        "growth_factor": growth_factor,
        "savings_opportunity": round(total_savings, 2),
        "deployments": deployments[:15],
        "has_history": has_history,
        "note": (
            "Projection based on resource usage trend. "
            "Run for 24h+ for accurate forecasts."
            if has_history else
            "No historical data yet. Metrics record every 5min."
        ),
    }


def _utilization(dep, cpu_avg_m, mem_avg_mb):
    """Calculate utilization % vs requested resources."""
    # Parse requested from dep
    cpu_req_str = dep.get("cpu_request", "0m")
    mem_req_str = dep.get("memory_request", "0Mi")

    cpu_req = int(cpu_req_str.rstrip("m")) if cpu_req_str.endswith("m") else 0
    mem_req = int(mem_req_str.rstrip("Mi")) if mem_req_str.endswith("Mi") else 0

    if cpu_req == 0 and mem_req == 0:
        return None

    # Average of CPU and memory utilization
    cpu_util = (cpu_avg_m / cpu_req * 100) if cpu_req else 0
    mem_util = (mem_avg_mb / mem_req * 100) if mem_req else 0

    return round((cpu_util + mem_util) / 2)


def _detect_trend(history):
    """Detect growth trend from historical data."""
    if not history:
        return "stable"

    # Sum total CPU across all pods
    total_samples = []
    for pod, data in history.items():
        if data.get("samples", 0) > 5:
            total_samples.append(data["cpu_avg"])

    if len(total_samples) < 3:
        return "stable"

    # Simple: compare average of first half vs second half
    mid = len(total_samples) // 2
    first_half = sum(total_samples[:mid]) / max(mid, 1)
    second_half = sum(total_samples[mid:]) / max(
        len(total_samples) - mid, 1
    )

    if second_half > first_half * 1.1:
        return "growing"
    elif second_half < first_half * 0.9:
        return "shrinking"
    return "stable"
