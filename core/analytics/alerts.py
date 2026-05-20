"""
Analytics Alerts — threshold-based alerts derived from
DuckDB time-series data. Detects trends and anomalies.
"""

from core.analytics.engine import execute, execute_one


def check_alerts():
    """
    Run all alert checks against analytics data.
    Returns list of triggered alerts.
    """
    alerts = []
    alerts.extend(_check_memory_trend())
    alerts.extend(_check_cpu_saturation())
    alerts.extend(_check_restart_spike())
    alerts.extend(_check_cost_spike())
    return alerts


def _check_memory_trend():
    """Alert if memory usage trending toward limit."""
    rows = execute("""
        SELECT
            deployment, namespace,
            MAX(mem_p95) AS mem_p95,
            MAX(mem_request) AS mem_req,
            ROUND(MAX(mem_p95) * 100.0 / NULLIF(MAX(mem_request), 0), 1)
                AS util_pct
        FROM hourly_pod_metrics
        WHERE hour >= NOW() - INTERVAL '6 hours'
          AND deployment != ''
          AND mem_request > 0
        GROUP BY deployment, namespace
        HAVING util_pct > 85
    """)

    alerts = []
    for row in rows:
        alerts.append({
            "type": "memory_pressure",
            "severity": "high" if row[4] > 95 else "medium",
            "deployment": row[0],
            "namespace": row[1],
            "message": (
                f"{row[0]}: memory at {row[4]}% of request "
                f"({row[2]}Mi / {row[3]}Mi) — OOM risk"
            ),
            "recommendation": (
                f"Increase memory request to {int(row[2] * 1.3)}Mi"
            ),
        })
    return alerts


def _check_cpu_saturation():
    """Alert if CPU consistently near limit."""
    rows = execute("""
        SELECT
            deployment, namespace,
            MAX(cpu_p95) AS cpu_p95,
            MAX(cpu_request) AS cpu_req,
            ROUND(MAX(cpu_p95) * 100.0 / NULLIF(MAX(cpu_request), 0), 1)
                AS util_pct
        FROM hourly_pod_metrics
        WHERE hour >= NOW() - INTERVAL '6 hours'
          AND deployment != ''
          AND cpu_request > 0
        GROUP BY deployment, namespace
        HAVING util_pct > 90
    """)

    alerts = []
    for row in rows:
        alerts.append({
            "type": "cpu_throttle",
            "severity": "medium",
            "deployment": row[0],
            "namespace": row[1],
            "message": (
                f"{row[0]}: CPU at {row[4]}% of request "
                f"({row[2]}m / {row[3]}m) — throttling likely"
            ),
            "recommendation": (
                f"Increase CPU request to {int(row[2] * 1.3)}m"
            ),
        })
    return alerts


def _check_restart_spike():
    """Alert if restart count spikes vs baseline."""
    rows = execute("""
        WITH recent AS (
            SELECT deployment, namespace,
                   SUM(restart_count) AS restarts
            FROM hourly_pod_metrics
            WHERE hour >= NOW() - INTERVAL '1 hour'
              AND deployment != ''
            GROUP BY deployment, namespace
        ),
        baseline AS (
            SELECT deployment, namespace,
                   AVG(restart_count)::INTEGER AS avg_restarts
            FROM hourly_pod_metrics
            WHERE hour >= NOW() - INTERVAL '24 hours'
              AND hour < NOW() - INTERVAL '1 hour'
              AND deployment != ''
            GROUP BY deployment, namespace
        )
        SELECT r.deployment, r.namespace,
               r.restarts, COALESCE(b.avg_restarts, 0) AS baseline
        FROM recent r
        LEFT JOIN baseline b
            ON r.deployment = b.deployment
            AND r.namespace = b.namespace
        WHERE r.restarts > GREATEST(b.avg_restarts * 3, 5)
    """)

    alerts = []
    for row in rows:
        alerts.append({
            "type": "restart_spike",
            "severity": "high",
            "deployment": row[0],
            "namespace": row[1],
            "message": (
                f"{row[0]}: {row[2]} restarts in last hour "
                f"(baseline: {row[3]})"
            ),
            "recommendation": "Run: diagnose " + row[0],
        })
    return alerts


def _check_cost_spike():
    """Alert if daily cost exceeds 7-day average by 50%."""
    row = execute_one("""
        WITH daily AS (
            SELECT day, SUM(cost_estimate_usd) AS cost
            FROM daily_summary
            WHERE day >= CURRENT_DATE - INTERVAL '8 days'
            GROUP BY day
        ),
        stats AS (
            SELECT
                AVG(cost) AS avg_cost,
                MAX(CASE WHEN day = CURRENT_DATE - 1
                    THEN cost END) AS yesterday
            FROM daily
        )
        SELECT avg_cost, yesterday
        FROM stats
        WHERE yesterday > avg_cost * 1.5
          AND avg_cost > 0
    """)

    if row:
        return [{
            "type": "cost_spike",
            "severity": "medium",
            "deployment": "*",
            "namespace": "*",
            "message": (
                f"Yesterday's cost ${row[1]:.2f} is "
                f"{int(row[1] / row[0] * 100)}% of "
                f"7-day average ${row[0]:.2f}"
            ),
            "recommendation": "Run: cost-query to investigate",
        }]
    return []
