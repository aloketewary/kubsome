"""
Analytics Cost Model — configurable pricing per provider,
cost attribution per deployment, and savings calculations.
"""

from core.analytics.engine import execute, execute_one, execute_write


PROVIDERS = {
    "aws": {
        "m5.xlarge": {"cpu": 0.0425, "mem": 0.0053},
        "m5.2xlarge": {"cpu": 0.0400, "mem": 0.0050},
        "t3.medium": {"cpu": 0.0520, "mem": 0.0065},
        "spot_discount": 0.70,
    },
    "gcp": {
        "e2-standard-4": {"cpu": 0.0380, "mem": 0.0051},
        "n2-standard-4": {"cpu": 0.0420, "mem": 0.0056},
        "spot_discount": 0.60,
    },
    "azure": {
        "Standard_D4s_v3": {"cpu": 0.0440, "mem": 0.0055},
        "spot_discount": 0.65,
    },
}


def set_cost_model(name, cpu_per_core_hour, mem_per_gb_hour,
                   provider="custom", instance_type="",
                   region="", storage=0.10, network=0.09):
    """Insert or update a cost model."""
    execute_write("""
        INSERT OR REPLACE INTO cost_model
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    """, [
        name, cpu_per_core_hour, mem_per_gb_hour,
        storage, network, provider, instance_type, region
    ])
    return {"success": True, "name": name}


def get_cost_models():
    """List all cost models."""
    rows = execute("SELECT * FROM cost_model")
    cols = [
        "name", "cpu_per_core_hour", "mem_per_gb_hour",
        "storage_per_gb_month", "network_per_gb",
        "provider", "instance_type", "region"
    ]
    return [dict(zip(cols, row)) for row in rows]


def cost_by_deployment(days=7, model="default"):
    """
    Cost attribution per deployment over N days.
    Returns sorted list by cost descending.
    """
    rows = execute(f"""
        SELECT
            h.deployment,
            h.namespace,
            AVG(h.pod_count)::INTEGER AS avg_pods,
            AVG(h.cpu_avg)::INTEGER AS cpu_avg_m,
            AVG(h.mem_avg)::INTEGER AS mem_avg_mb,
            MAX(h.cpu_p95) AS cpu_p95_m,
            MAX(h.mem_p95) AS mem_p95_mb,
            MAX(h.cpu_request) AS cpu_request_m,
            MAX(h.mem_request) AS mem_request_mb,
            ROUND(
                (AVG(h.cpu_avg) / 1000.0 * c.cpu_per_core_hour
                + AVG(h.mem_avg) / 1024.0 * c.mem_per_gb_hour)
                * 24 * ?, 2
            ) AS cost_actual_usd,
            ROUND(
                (MAX(h.cpu_request) / 1000.0 * c.cpu_per_core_hour
                + MAX(h.mem_request) / 1024.0 * c.mem_per_gb_hour)
                * 24 * ? * AVG(h.pod_count), 2
            ) AS cost_requested_usd
        FROM hourly_pod_metrics h
        CROSS JOIN cost_model c
        WHERE c.name = ?
          AND h.hour >= NOW() - INTERVAL '{days} days'
          AND h.deployment != ''
        GROUP BY h.deployment, h.namespace,
                 c.cpu_per_core_hour, c.mem_per_gb_hour
        ORDER BY cost_requested_usd DESC
    """, [days, days, model])

    cols = [
        "deployment", "namespace", "avg_pods",
        "cpu_avg_m", "mem_avg_mb", "cpu_p95_m", "mem_p95_mb",
        "cpu_request_m", "mem_request_mb",
        "cost_actual_usd", "cost_requested_usd"
    ]
    results = [dict(zip(cols, row)) for row in rows]

    # Add savings potential
    for r in results:
        r["savings_usd"] = round(
            r["cost_requested_usd"] - r["cost_actual_usd"], 2
        )
        r["waste_pct"] = (
            round(
                r["savings_usd"] * 100 / r["cost_requested_usd"], 1
            ) if r["cost_requested_usd"] > 0 else 0
        )

    return results


def monthly_cost_summary(model="default"):
    """Total monthly cost estimate from daily summaries."""
    row = execute_one("""
        SELECT
            SUM(cost_estimate_usd) AS total_daily,
            COUNT(DISTINCT day) AS days_tracked,
            COUNT(DISTINCT deployment) AS deployments
        FROM daily_summary
        WHERE day >= CURRENT_DATE - INTERVAL '30 days'
    """)

    if not row or not row[0]:
        return {
            "monthly_usd": 0,
            "daily_avg_usd": 0,
            "deployments": 0,
            "days_tracked": 0,
        }

    total = row[0]
    days = row[1] or 1

    return {
        "monthly_usd": round(total / days * 30, 2),
        "daily_avg_usd": round(total / days, 2),
        "deployments": row[2],
        "days_tracked": days,
    }
