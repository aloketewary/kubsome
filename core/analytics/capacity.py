"""
Analytics Capacity Planning — forecasts resource exhaustion
at the cluster and node level based on growth trends.

Answers:
  - "When will we need more nodes?"
  - "Which namespace is growing fastest?"
  - "At current rate, cluster full in X days"
"""

from core.analytics.engine import get_conn


def capacity_forecast(days_lookback=14):
    """
    Forecast when cluster resources will be exhausted.
    Uses linear regression on daily pod count and resource usage.
    """
    try:
        conn = get_conn()
    except (ImportError, Exception):
        return None

    # Current capacity from node_state
    capacity = conn.execute("""
        SELECT
            COUNT(*) AS nodes,
            SUM(cpu_allocatable) AS total_cpu_m,
            SUM(mem_allocatable_mb) AS total_mem_mb,
            SUM(pod_count) AS total_pod_slots
        FROM node_state
    """).fetchone()

    if not capacity or not capacity[1]:
        return {"error": "No node data. Run 'collect' first."}

    total_cpu = capacity[1]
    total_mem = capacity[2]
    total_pods = capacity[3]

    # Growth trend from hourly data
    growth = conn.execute(f"""
        WITH daily AS (
            SELECT
                DATE_TRUNC('day', hour)::DATE AS day,
                SUM(cpu_avg)::INTEGER AS cpu_used,
                SUM(mem_avg)::INTEGER AS mem_used,
                SUM(pod_count)::INTEGER AS pod_count
            FROM hourly_pod_metrics
            WHERE hour >= NOW() - INTERVAL '{days_lookback} days'
            GROUP BY day
            ORDER BY day
        ),
        regression AS (
            SELECT
                COUNT(*) AS n,
                -- CPU slope (millicores per day)
                CASE WHEN COUNT(*) > 2 AND
                    (COUNT(*) * SUM(EXTRACT(EPOCH FROM day) * EXTRACT(EPOCH FROM day))
                     - SUM(EXTRACT(EPOCH FROM day)) * SUM(EXTRACT(EPOCH FROM day))) != 0
                THEN
                    (COUNT(*) * SUM(EXTRACT(EPOCH FROM day) * cpu_used)
                     - SUM(EXTRACT(EPOCH FROM day)) * SUM(cpu_used))::DOUBLE
                    / (COUNT(*) * SUM(EXTRACT(EPOCH FROM day) * EXTRACT(EPOCH FROM day))
                     - SUM(EXTRACT(EPOCH FROM day)) * SUM(EXTRACT(EPOCH FROM day)))
                    * 86400  -- convert per-second to per-day
                ELSE 0 END AS cpu_slope_per_day,
                -- Memory slope (MB per day)
                CASE WHEN COUNT(*) > 2 AND
                    (COUNT(*) * SUM(EXTRACT(EPOCH FROM day) * EXTRACT(EPOCH FROM day))
                     - SUM(EXTRACT(EPOCH FROM day)) * SUM(EXTRACT(EPOCH FROM day))) != 0
                THEN
                    (COUNT(*) * SUM(EXTRACT(EPOCH FROM day) * mem_used)
                     - SUM(EXTRACT(EPOCH FROM day)) * SUM(mem_used))::DOUBLE
                    / (COUNT(*) * SUM(EXTRACT(EPOCH FROM day) * EXTRACT(EPOCH FROM day))
                     - SUM(EXTRACT(EPOCH FROM day)) * SUM(EXTRACT(EPOCH FROM day)))
                    * 86400
                ELSE 0 END AS mem_slope_per_day,
                MAX(cpu_used) AS latest_cpu,
                MAX(mem_used) AS latest_mem,
                MAX(pod_count) AS latest_pods
            FROM daily
        )
        SELECT n, cpu_slope_per_day, mem_slope_per_day,
               latest_cpu, latest_mem, latest_pods
        FROM regression
    """).fetchone()

    if not growth or not growth[0] or growth[0] < 3:
        return {
            "error": "Need 3+ days of data for forecast",
            "days_collected": growth[0] if growth else 0,
        }

    n, cpu_slope, mem_slope, latest_cpu, latest_mem, latest_pods = growth

    # Days until exhaustion (80% threshold)
    cpu_threshold = int(total_cpu * 0.80)
    mem_threshold = int(total_mem * 0.80)

    cpu_remaining = cpu_threshold - (latest_cpu or 0)
    mem_remaining = mem_threshold - (latest_mem or 0)

    cpu_days = (
        int(cpu_remaining / cpu_slope)
        if cpu_slope > 0 and cpu_remaining > 0
        else None
    )
    mem_days = (
        int(mem_remaining / mem_slope)
        if mem_slope > 0 and mem_remaining > 0
        else None
    )

    # Current utilization
    cpu_util = int((latest_cpu or 0) * 100 / max(total_cpu, 1))
    mem_util = int((latest_mem or 0) * 100 / max(total_mem, 1))

    return {
        "cluster": {
            "nodes": capacity[0],
            "total_cpu_m": total_cpu,
            "total_mem_mb": total_mem,
            "total_pod_slots": total_pods,
        },
        "current_usage": {
            "cpu_used_m": latest_cpu,
            "mem_used_mb": latest_mem,
            "pod_count": latest_pods,
            "cpu_util_pct": cpu_util,
            "mem_util_pct": mem_util,
        },
        "growth_rate": {
            "cpu_per_day_m": round(cpu_slope, 1),
            "mem_per_day_mb": round(mem_slope, 1),
            "cpu_direction": (
                "growing" if cpu_slope > 10
                else "shrinking" if cpu_slope < -10
                else "stable"
            ),
            "mem_direction": (
                "growing" if mem_slope > 10
                else "shrinking" if mem_slope < -10
                else "stable"
            ),
        },
        "forecast": {
            "cpu_days_to_80pct": cpu_days,
            "mem_days_to_80pct": mem_days,
            "bottleneck": (
                "cpu" if cpu_days and (not mem_days or cpu_days < mem_days)
                else "memory" if mem_days
                else "none"
            ),
            "action_needed": (
                cpu_days is not None and cpu_days < 14
            ) or (
                mem_days is not None and mem_days < 14
            ),
        },
        "data_points": n,
        "lookback_days": days_lookback,
    }


def namespace_growth(days=14):
    """Which namespaces are growing fastest."""
    try:
        conn = get_conn()
    except (ImportError, Exception):
        return []

    rows = conn.execute(f"""
        WITH first_half AS (
            SELECT namespace,
                AVG(cpu_avg)::INTEGER AS cpu,
                AVG(mem_avg)::INTEGER AS mem
            FROM hourly_pod_metrics
            WHERE hour >= NOW() - INTERVAL '{days} days'
              AND hour < NOW() - INTERVAL '{days // 2} days'
            GROUP BY namespace
        ),
        second_half AS (
            SELECT namespace,
                AVG(cpu_avg)::INTEGER AS cpu,
                AVG(mem_avg)::INTEGER AS mem
            FROM hourly_pod_metrics
            WHERE hour >= NOW() - INTERVAL '{days // 2} days'
            GROUP BY namespace
        )
        SELECT
            s.namespace,
            f.cpu AS cpu_before,
            s.cpu AS cpu_after,
            ROUND((s.cpu - f.cpu) * 100.0 / NULLIF(f.cpu, 0), 1) AS cpu_growth_pct,
            f.mem AS mem_before,
            s.mem AS mem_after,
            ROUND((s.mem - f.mem) * 100.0 / NULLIF(f.mem, 0), 1) AS mem_growth_pct
        FROM second_half s
        JOIN first_half f ON s.namespace = f.namespace
        WHERE f.cpu > 0
        ORDER BY cpu_growth_pct DESC
    """).fetchall()

    return [
        {
            "namespace": r[0],
            "cpu_before": r[1], "cpu_after": r[2],
            "cpu_growth_pct": r[3],
            "mem_before": r[4], "mem_after": r[5],
            "mem_growth_pct": r[6],
        }
        for r in rows
    ]
