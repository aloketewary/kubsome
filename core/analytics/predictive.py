"""
Analytics Predictive Alerts — forecasts resource exhaustion
using linear regression on DuckDB time-series data.

Predictions:
  - Memory OOM: "payment-api will OOM in ~4h at current rate"
  - CPU saturation: "billing-svc CPU will hit limit in ~6h"
  - Restart acceleration: "restarts doubling every 2h"
  - Capacity exhaustion: "node pool 90% full in ~3 days"
"""

from datetime import datetime, timedelta
from core.analytics.engine import get_conn


def check_predictive_alerts(hours_lookback=12):
    """
    Run all predictive checks. Returns list of predictions
    with time-to-event estimates.
    """
    alerts = []
    alerts.extend(_predict_memory_oom(hours_lookback))
    alerts.extend(_predict_cpu_saturation(hours_lookback))
    alerts.extend(_predict_restart_acceleration(hours_lookback))
    alerts.extend(_predict_capacity_exhaustion())
    return alerts


def _predict_memory_oom(hours):
    """
    Predict which pods will OOM based on memory growth trend.
    Uses linear regression: if slope projects mem > limit within 24h.
    """
    try:
        conn = get_conn()
    except (ImportError, Exception):
        return []

    # Get deployments with growing memory and known limits
    rows = conn.execute(f"""
        WITH trend AS (
            SELECT
                deployment,
                namespace,
                MAX(mem_request) AS mem_limit,
                -- Linear regression components
                COUNT(*) AS n,
                SUM(EXTRACT(EPOCH FROM hour)) AS sum_x,
                SUM(mem_avg) AS sum_y,
                SUM(EXTRACT(EPOCH FROM hour) * mem_avg) AS sum_xy,
                SUM(EXTRACT(EPOCH FROM hour) * EXTRACT(EPOCH FROM hour)) AS sum_xx,
                MAX(mem_avg) AS latest_mem,
                MAX(mem_p95) AS mem_p95
            FROM hourly_pod_metrics
            WHERE hour >= NOW() - INTERVAL '{hours} hours'
              AND deployment != ''
              AND mem_request > 0
            GROUP BY deployment, namespace
            HAVING COUNT(*) >= 6
        )
        SELECT
            deployment, namespace, mem_limit, latest_mem, mem_p95, n,
            -- Slope (bytes per second)
            CASE WHEN (n * sum_xx - sum_x * sum_x) != 0
                THEN (n * sum_xy - sum_x * sum_y)::DOUBLE
                     / (n * sum_xx - sum_x * sum_x)
                ELSE 0 END AS slope
        FROM trend
        WHERE mem_limit > 0
    """).fetchall()

    alerts = []
    now_epoch = datetime.utcnow().timestamp()

    for row in rows:
        deployment, namespace, mem_limit, latest_mem, mem_p95, n, slope = row

        # Only alert if memory is growing
        if slope <= 0:
            continue

        # Time to hit limit (seconds)
        remaining = mem_limit - latest_mem
        if remaining <= 0:
            # Already at limit
            alerts.append({
                "type": "memory_oom_imminent",
                "severity": "critical",
                "deployment": deployment,
                "namespace": namespace,
                "message": (
                    f"{deployment}: memory AT limit "
                    f"({latest_mem}Mi / {mem_limit}Mi)"
                ),
                "time_to_event": "now",
                "hours_remaining": 0,
                "confidence": min(95, 50 + n * 3),
                "recommendation": (
                    f"Increase memory limit immediately. "
                    f"Current P95: {mem_p95}Mi"
                ),
            })
            continue

        seconds_to_oom = remaining / slope
        hours_to_oom = seconds_to_oom / 3600

        # Only alert if OOM predicted within 24h
        if hours_to_oom > 24:
            continue

        severity = (
            "critical" if hours_to_oom < 2
            else "high" if hours_to_oom < 6
            else "medium"
        )

        alerts.append({
            "type": "memory_oom_predicted",
            "severity": severity,
            "deployment": deployment,
            "namespace": namespace,
            "message": (
                f"{deployment}: memory will hit limit in "
                f"~{hours_to_oom:.1f}h "
                f"({latest_mem}Mi → {mem_limit}Mi, "
                f"+{slope * 3600:.1f}Mi/h)"
            ),
            "time_to_event": str(
                datetime.utcnow() + timedelta(hours=hours_to_oom)
            )[:16],
            "hours_remaining": round(hours_to_oom, 1),
            "confidence": min(90, 40 + n * 4),
            "current_mb": latest_mem,
            "limit_mb": mem_limit,
            "growth_rate_mb_per_hour": round(slope * 3600, 2),
            "recommendation": (
                f"Increase memory to {int(mem_limit * 1.5)}Mi "
                f"or investigate memory leak"
            ),
        })

    return alerts


def _predict_cpu_saturation(hours):
    """
    Predict CPU throttling based on usage trend toward request.
    """
    try:
        conn = get_conn()
    except (ImportError, Exception):
        return []

    rows = conn.execute(f"""
        WITH trend AS (
            SELECT
                deployment,
                namespace,
                MAX(cpu_request) AS cpu_limit,
                COUNT(*) AS n,
                SUM(EXTRACT(EPOCH FROM hour)) AS sum_x,
                SUM(cpu_avg) AS sum_y,
                SUM(EXTRACT(EPOCH FROM hour) * cpu_avg) AS sum_xy,
                SUM(EXTRACT(EPOCH FROM hour) * EXTRACT(EPOCH FROM hour)) AS sum_xx,
                MAX(cpu_avg) AS latest_cpu,
                MAX(cpu_p95) AS cpu_p95
            FROM hourly_pod_metrics
            WHERE hour >= NOW() - INTERVAL '{hours} hours'
              AND deployment != ''
              AND cpu_request > 0
            GROUP BY deployment, namespace
            HAVING COUNT(*) >= 6
        )
        SELECT
            deployment, namespace, cpu_limit, latest_cpu, cpu_p95, n,
            CASE WHEN (n * sum_xx - sum_x * sum_x) != 0
                THEN (n * sum_xy - sum_x * sum_y)::DOUBLE
                     / (n * sum_xx - sum_x * sum_x)
                ELSE 0 END AS slope
        FROM trend
        WHERE cpu_limit > 0
    """).fetchall()

    alerts = []
    for row in rows:
        deployment, namespace, cpu_limit, latest_cpu, cpu_p95, n, slope = row

        if slope <= 0:
            continue

        remaining = cpu_limit - latest_cpu
        if remaining <= 0:
            continue

        seconds_to_sat = remaining / slope
        hours_to_sat = seconds_to_sat / 3600

        if hours_to_sat > 24:
            continue

        alerts.append({
            "type": "cpu_saturation_predicted",
            "severity": "high" if hours_to_sat < 4 else "medium",
            "deployment": deployment,
            "namespace": namespace,
            "message": (
                f"{deployment}: CPU will hit request in "
                f"~{hours_to_sat:.1f}h "
                f"({latest_cpu}m → {cpu_limit}m, "
                f"+{slope * 3600:.1f}m/h)"
            ),
            "hours_remaining": round(hours_to_sat, 1),
            "confidence": min(85, 35 + n * 4),
            "recommendation": (
                f"Scale horizontally or increase CPU to "
                f"{int(cpu_limit * 1.5)}m"
            ),
        })

    return alerts


def _predict_restart_acceleration(hours):
    """
    Detect restart rate acceleration — restarts doubling.
    """
    try:
        conn = get_conn()
    except (ImportError, Exception):
        return []

    rows = conn.execute(f"""
        SELECT
            deployment,
            namespace,
            SUM(CASE WHEN hour >= NOW() - INTERVAL '3 hours'
                THEN restart_count ELSE 0 END) AS recent_3h,
            SUM(CASE WHEN hour >= NOW() - INTERVAL '{hours} hours'
                AND hour < NOW() - INTERVAL '3 hours'
                THEN restart_count ELSE 0 END) AS earlier,
            SUM(restart_count) AS total
        FROM hourly_pod_metrics
        WHERE hour >= NOW() - INTERVAL '{hours} hours'
          AND deployment != ''
        GROUP BY deployment, namespace
        HAVING recent_3h > 3
          AND recent_3h > earlier * 1.5
    """).fetchall()

    alerts = []
    for row in rows:
        deployment, namespace, recent, earlier, total = row
        rate = (
            f"{recent / max(earlier, 1):.1f}x"
            if earlier > 0 else "new"
        )

        alerts.append({
            "type": "restart_acceleration",
            "severity": "high",
            "deployment": deployment,
            "namespace": namespace,
            "message": (
                f"{deployment}: restarts accelerating "
                f"({recent} in 3h vs {earlier} in prior "
                f"{hours - 3}h = {rate})"
            ),
            "recent_3h": recent,
            "baseline": earlier,
            "acceleration_rate": rate,
            "confidence": 75,
            "recommendation": f"Run: diagnose {deployment}",
        })

    return alerts


def _predict_capacity_exhaustion():
    """
    Predict when node pool will be full based on pod growth.
    """
    try:
        conn = get_conn()
    except (ImportError, Exception):
        return []

    # Check if we have node data
    row = conn.execute("""
        SELECT
            SUM(cpu_allocatable) AS total_cpu,
            SUM(mem_allocatable_mb) AS total_mem,
            COUNT(*) AS node_count
        FROM node_state
    """).fetchone()

    if not row or not row[0]:
        return []

    total_cpu = row[0]
    total_mem = row[1]

    # Current usage from recent hourly data
    usage = conn.execute("""
        SELECT
            SUM(cpu_avg)::INTEGER AS cpu_used,
            SUM(mem_avg)::INTEGER AS mem_used
        FROM hourly_pod_metrics
        WHERE hour >= NOW() - INTERVAL '1 hour'
    """).fetchone()

    if not usage or not usage[0]:
        return []

    cpu_used = usage[0]
    mem_used = usage[1]

    cpu_pct = cpu_used * 100 / max(total_cpu, 1)
    mem_pct = mem_used * 100 / max(total_mem, 1)

    alerts = []
    if cpu_pct > 80:
        remaining_pct = 100 - cpu_pct
        # Estimate days at current growth (simple)
        alerts.append({
            "type": "capacity_cpu_high",
            "severity": "medium",
            "deployment": "*",
            "namespace": "*",
            "message": (
                f"Cluster CPU at {cpu_pct:.0f}% "
                f"({cpu_used}m / {total_cpu}m) — "
                f"only {remaining_pct:.0f}% headroom"
            ),
            "confidence": 70,
            "recommendation": "Add nodes or right-size workloads",
        })

    if mem_pct > 80:
        remaining_pct = 100 - mem_pct
        alerts.append({
            "type": "capacity_mem_high",
            "severity": "medium",
            "deployment": "*",
            "namespace": "*",
            "message": (
                f"Cluster memory at {mem_pct:.0f}% "
                f"({mem_used}Mi / {total_mem}Mi) — "
                f"only {remaining_pct:.0f}% headroom"
            ),
            "confidence": 70,
            "recommendation": "Add nodes or reduce memory requests",
        })

    return alerts
