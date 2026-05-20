"""
Analytics Enrichment — provides historical context from DuckDB
to existing features. Gracefully returns None if analytics
is unavailable or has insufficient data.
"""


def enrich_pod_metrics(pod_name):
    """
    Enrich live pod metrics with historical comparison.
    Returns {cpu_7d_avg, mem_7d_avg, cpu_trend, mem_trend} or None.
    """
    try:
        from core.analytics.engine import get_conn
        conn = get_conn()
    except (ImportError, Exception):
        return None

    row = conn.execute(f"""
        SELECT
            AVG(cpu_millicores)::INTEGER AS cpu_7d_avg,
            AVG(memory_mb)::INTEGER AS mem_7d_avg,
            MAX(cpu_millicores) AS cpu_7d_max,
            MAX(memory_mb) AS mem_7d_max
        FROM raw_pod_metrics
        WHERE pod = ?
          AND ts >= NOW() - INTERVAL '7 days'
    """, [pod_name]).fetchone()

    if not row or not row[0]:
        return None

    # Recent (last 1h) vs baseline (7d)
    recent = conn.execute(f"""
        SELECT
            AVG(cpu_millicores)::INTEGER AS cpu_1h,
            AVG(memory_mb)::INTEGER AS mem_1h
        FROM raw_pod_metrics
        WHERE pod = ?
          AND ts >= NOW() - INTERVAL '1 hour'
    """, [pod_name]).fetchone()

    cpu_trend = None
    mem_trend = None
    if recent and recent[0] and row[0]:
        cpu_pct = int((recent[0] - row[0]) * 100 / max(row[0], 1))
        mem_pct = int((recent[1] - row[1]) * 100 / max(row[1], 1))
        cpu_trend = "up" if cpu_pct > 15 else "down" if cpu_pct < -15 else "stable"
        mem_trend = "up" if mem_pct > 15 else "down" if mem_pct < -15 else "stable"

    return {
        "cpu_7d_avg": row[0],
        "mem_7d_avg": row[1],
        "cpu_7d_max": row[2],
        "mem_7d_max": row[3],
        "cpu_1h": recent[0] if recent else None,
        "mem_1h": recent[1] if recent else None,
        "cpu_trend": cpu_trend,
        "mem_trend": mem_trend,
    }


def enrich_deployment_metrics(deployment_name):
    """
    Enrich deployment with historical usage vs request.
    Returns {cpu_util_pct, mem_util_pct, trend, savings_hint} or None.
    """
    try:
        from core.analytics.engine import get_conn
        conn = get_conn()
    except (ImportError, Exception):
        return None

    row = conn.execute(f"""
        SELECT
            AVG(cpu_avg)::INTEGER AS cpu_avg,
            MAX(cpu_p95) AS cpu_p95,
            MAX(cpu_request) AS cpu_req,
            AVG(mem_avg)::INTEGER AS mem_avg,
            MAX(mem_p95) AS mem_p95,
            MAX(mem_request) AS mem_req,
            SUM(restart_count) AS restarts,
            COUNT(*) AS samples
        FROM hourly_pod_metrics
        WHERE deployment = ?
          AND hour >= NOW() - INTERVAL '7 days'
    """, [deployment_name]).fetchone()

    if not row or not row[7] or row[7] < 6:
        return None

    cpu_util = (
        int(row[0] * 100 / max(row[2], 1)) if row[2] else 0
    )
    mem_util = (
        int(row[3] * 100 / max(row[5], 1)) if row[5] else 0
    )

    # Trend: compare last 24h vs previous 6 days
    trend_row = conn.execute(f"""
        SELECT
            AVG(CASE WHEN hour >= NOW() - INTERVAL '24 hours'
                THEN cpu_avg END)::INTEGER AS cpu_recent,
            AVG(CASE WHEN hour < NOW() - INTERVAL '24 hours'
                THEN cpu_avg END)::INTEGER AS cpu_baseline
        FROM hourly_pod_metrics
        WHERE deployment = ?
          AND hour >= NOW() - INTERVAL '7 days'
    """, [deployment_name]).fetchone()

    trend = "stable"
    if trend_row and trend_row[0] and trend_row[1]:
        diff_pct = (trend_row[0] - trend_row[1]) * 100 / max(trend_row[1], 1)
        if diff_pct > 20:
            trend = "growing"
        elif diff_pct < -20:
            trend = "shrinking"

    savings_hint = None
    if cpu_util < 40 and row[2] > 100:
        savings_hint = (
            f"CPU {cpu_util}% utilized — "
            f"could reduce from {row[2]}m to ~{row[1]}m"
        )
    elif mem_util < 40 and row[5] > 128:
        savings_hint = (
            f"Memory {mem_util}% utilized — "
            f"could reduce from {row[5]}Mi to ~{row[4]}Mi"
        )

    return {
        "cpu_avg": row[0],
        "cpu_p95": row[1],
        "cpu_request": row[2],
        "cpu_util_pct": cpu_util,
        "mem_avg": row[3],
        "mem_p95": row[4],
        "mem_request": row[5],
        "mem_util_pct": mem_util,
        "restarts_7d": row[6],
        "samples": row[7],
        "trend": trend,
        "savings_hint": savings_hint,
    }


def enrich_diagnosis(pod_name):
    """
    Add historical context to pod diagnosis.
    Returns memory/CPU growth trends and anomaly detection.
    """
    try:
        from core.analytics.engine import get_conn
        conn = get_conn()
    except (ImportError, Exception):
        return None

    rows = conn.execute(f"""
        SELECT
            DATE_TRUNC('day', ts)::DATE AS day,
            AVG(cpu_millicores)::INTEGER AS cpu_avg,
            AVG(memory_mb)::INTEGER AS mem_avg,
            MAX(memory_mb) AS mem_max,
            SUM(restarts) AS restarts
        FROM raw_pod_metrics
        WHERE pod = ?
          AND ts >= NOW() - INTERVAL '7 days'
        GROUP BY day
        ORDER BY day
    """, [pod_name]).fetchall()

    if len(rows) < 2:
        return None

    # Detect memory growth
    mem_values = [r[2] for r in rows if r[2]]
    mem_growing = False
    if len(mem_values) >= 3:
        first_half = sum(mem_values[:len(mem_values)//2]) / max(len(mem_values)//2, 1)
        second_half = sum(mem_values[len(mem_values)//2:]) / max(len(mem_values) - len(mem_values)//2, 1)
        if second_half > first_half * 1.3:
            mem_growing = True

    # Restart acceleration
    restart_values = [r[4] for r in rows if r[4] is not None]
    restart_accelerating = False
    if len(restart_values) >= 3:
        recent = sum(restart_values[-2:])
        earlier = sum(restart_values[:-2])
        if recent > earlier * 2 and recent > 3:
            restart_accelerating = True

    findings = []
    if mem_growing:
        findings.append({
            "type": "memory_leak",
            "severity": "high",
            "message": (
                f"Memory growing: {mem_values[0]}Mi → "
                f"{mem_values[-1]}Mi over {len(rows)} days"
            ),
        })
    if restart_accelerating:
        findings.append({
            "type": "restart_acceleration",
            "severity": "high",
            "message": "Restarts accelerating — recent days have 2x+ more restarts",
        })

    return {
        "days_tracked": len(rows),
        "mem_growing": mem_growing,
        "restart_accelerating": restart_accelerating,
        "findings": findings,
        "daily_data": [
            {"day": str(r[0]), "cpu": r[1], "mem": r[2], "restarts": r[4]}
            for r in rows
        ],
    }


def enrich_scorecard():
    """
    Add availability and trend data to cluster scorecard.
    Returns {availability_pct, cost_trend, degrading_deployments}.
    """
    try:
        from core.analytics.engine import get_conn
        conn = get_conn()
    except (ImportError, Exception):
        return None

    # Availability from daily_summary
    avail = conn.execute("""
        SELECT AVG(availability_pct) AS avg_avail
        FROM daily_summary
        WHERE day >= CURRENT_DATE - INTERVAL '7 days'
    """).fetchone()

    # Cost trend
    cost = conn.execute("""
        SELECT
            SUM(CASE WHEN day >= CURRENT_DATE - 7
                THEN cost_estimate_usd END) AS recent,
            SUM(CASE WHEN day < CURRENT_DATE - 7
                AND day >= CURRENT_DATE - 14
                THEN cost_estimate_usd END) AS previous
        FROM daily_summary
    """).fetchone()

    cost_trend = "stable"
    if cost and cost[0] and cost[1]:
        diff = (cost[0] - cost[1]) * 100 / max(cost[1], 1)
        if diff > 15:
            cost_trend = "growing"
        elif diff < -15:
            cost_trend = "shrinking"

    # Degrading deployments (restarts increasing)
    degrading = conn.execute("""
        SELECT deployment, namespace
        FROM (
            SELECT
                deployment, namespace,
                SUM(CASE WHEN hour >= NOW() - INTERVAL '24 hours'
                    THEN restart_count END) AS recent_restarts,
                SUM(CASE WHEN hour < NOW() - INTERVAL '24 hours'
                    THEN restart_count END) AS older_restarts
            FROM hourly_pod_metrics
            WHERE hour >= NOW() - INTERVAL '7 days'
              AND deployment != ''
            GROUP BY deployment, namespace
        )
        WHERE recent_restarts > older_restarts * 2
          AND recent_restarts > 5
    """).fetchall()

    return {
        "availability_pct": round(avail[0], 2) if avail and avail[0] else None,
        "cost_trend": cost_trend,
        "degrading_count": len(degrading),
        "degrading": [
            {"deployment": r[0], "namespace": r[1]}
            for r in degrading[:5]
        ],
    }


def enrich_overview():
    """
    Add trend badges to cluster overview.
    Returns {pod_trend, cost_trend, restart_trend}.
    """
    try:
        from core.analytics.engine import get_conn
        conn = get_conn()
    except (ImportError, Exception):
        return None

    row = conn.execute("""
        SELECT
            SUM(CASE WHEN hour >= NOW() - INTERVAL '6 hours'
                THEN restart_count END) AS restarts_6h,
            SUM(CASE WHEN hour >= NOW() - INTERVAL '24 hours'
                AND hour < NOW() - INTERVAL '6 hours'
                THEN restart_count END) AS restarts_baseline,
            AVG(CASE WHEN hour >= NOW() - INTERVAL '6 hours'
                THEN cpu_avg END)::INTEGER AS cpu_recent,
            AVG(CASE WHEN hour >= NOW() - INTERVAL '24 hours'
                AND hour < NOW() - INTERVAL '6 hours'
                THEN cpu_avg END)::INTEGER AS cpu_baseline
        FROM hourly_pod_metrics
        WHERE hour >= NOW() - INTERVAL '24 hours'
    """).fetchone()

    if not row or not row[0]:
        return None

    restart_trend = "stable"
    if row[1] and row[0] > row[1] * 2:
        restart_trend = "worsening"
    elif row[1] and row[0] < row[1] * 0.5:
        restart_trend = "improving"

    cpu_trend = "stable"
    if row[3] and row[2]:
        diff = (row[2] - row[3]) * 100 / max(row[3], 1)
        if diff > 20:
            cpu_trend = "growing"
        elif diff < -20:
            cpu_trend = "shrinking"

    return {
        "restart_trend": restart_trend,
        "cpu_trend": cpu_trend,
        "restarts_6h": row[0],
        "cpu_recent": row[2],
    }
