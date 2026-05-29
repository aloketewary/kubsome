"""
Analytics Time-Series — query functions that return chart-ready
data from DuckDB for the Web UI.
Filters by current context automatically.
Uses parameterized queries to prevent SQL injection.
"""

from core.analytics.engine import get_conn
from core.context import context as k8s_context


def _ctx_clause(alias=""):
    """Return (sql_fragment, params) for current context filter."""
    ctx = k8s_context.current_context
    if not ctx:
        return "", []
    col = f"{alias}.context" if alias else "context"
    return f"AND {col} = ?", [ctx]


def _execute(conn, sql, params):
    """Execute parameterized query safely."""
    if params:
        return conn.execute(sql, params).fetchall()
    return conn.execute(sql).fetchall()


def cpu_memory_series(deployment=None, hours=24, interval="1 hour"):
    """
    Time-series CPU/memory for charting.
    Returns [{ts, cpu, mem, pods}] at given interval.
    """
    try:
        conn = get_conn()
    except (ImportError, Exception):
        return []

    ctx_sql, ctx_params = _ctx_clause()
    params = []

    deploy_sql = ""
    if deployment:
        deploy_sql = "AND deployment = ?"
        params.append(deployment)

    params.extend(ctx_params)

    rows = _execute(conn, f"""
        SELECT
            DATE_TRUNC('{interval}', hour) AS bucket,
            SUM(cpu_avg)::INTEGER AS cpu,
            SUM(mem_avg)::INTEGER AS mem,
            SUM(pod_count)::INTEGER AS pods
        FROM hourly_pod_metrics
        WHERE hour >= NOW() - INTERVAL '{hours} hours'
          {deploy_sql}
          {ctx_sql}
        GROUP BY bucket
        ORDER BY bucket
    """, params)

    result = [
        {"ts": str(r[0]), "cpu": r[1], "mem": r[2], "pods": r[3]}
        for r in rows
    ]

    # Include raw data for periods not yet aggregated
    raw_params = []
    if deployment:
        raw_params.append(deployment)
    raw_params.extend(ctx_params)

    raw_rows = _execute(conn, f"""
        SELECT
            DATE_TRUNC('{interval}', ts) AS bucket,
            AVG(cpu_millicores)::INTEGER AS cpu,
            AVG(memory_mb)::INTEGER AS mem,
            COUNT(DISTINCT pod)::INTEGER AS pods
        FROM raw_pod_metrics
        WHERE ts >= NOW() - INTERVAL '{hours} hours'
          AND deployment != ''
          {deploy_sql}
          {ctx_sql}
        GROUP BY bucket
        ORDER BY bucket
    """, raw_params)

    # Merge: raw fills gaps where hourly doesn't have data
    hourly_buckets = {r["ts"] for r in result}
    for r in raw_rows:
        if str(r[0]) not in hourly_buckets:
            result.append(
                {"ts": str(r[0]), "cpu": r[1], "mem": r[2], "pods": r[3]}
            )

    result.sort(key=lambda x: x["ts"])
    return result


def node_series(node=None, hours=24):
    """Node CPU/memory % over time."""
    try:
        conn = get_conn()
    except (ImportError, Exception):
        return []

    ctx_sql, ctx_params = _ctx_clause()
    params = []

    node_sql = ""
    if node:
        node_sql = "AND node = ?"
        params.append(node)

    params.extend(ctx_params)

    rows = _execute(conn, f"""
        SELECT
            hour,
            node,
            cpu_avg,
            mem_avg
        FROM hourly_node_metrics
        WHERE hour >= NOW() - INTERVAL '{hours} hours'
          {node_sql}
          {ctx_sql}
        ORDER BY hour
    """, params)

    return [
        {"ts": str(r[0]), "node": r[1], "cpu": r[2], "mem": r[3]}
        for r in rows
    ]


def restart_series(deployment=None, hours=48):
    """Restart count over time for anomaly visualization."""
    try:
        conn = get_conn()
    except (ImportError, Exception):
        return []

    ctx_sql, ctx_params = _ctx_clause()
    params = []

    deploy_sql = ""
    if deployment:
        deploy_sql = "AND deployment = ?"
        params.append(deployment)

    params.extend(ctx_params)

    rows = _execute(conn, f"""
        SELECT
            hour,
            deployment,
            restart_count
        FROM hourly_pod_metrics
        WHERE hour >= NOW() - INTERVAL '{hours} hours'
          AND restart_count > 0
          {deploy_sql}
          {ctx_sql}
        ORDER BY hour
    """, params)

    return [
        {"ts": str(r[0]), "deployment": r[1], "restarts": r[2]}
        for r in rows
    ]


def cost_series(days=30):
    """Daily cost over time for trend chart."""
    try:
        conn = get_conn()
    except (ImportError, Exception):
        return []

    ctx_sql, ctx_params = _ctx_clause()

    rows = _execute(conn, f"""
        SELECT
            day,
            SUM(cost_estimate_usd) AS daily_cost,
            COUNT(DISTINCT deployment) AS deployments
        FROM daily_summary
        WHERE day >= CURRENT_DATE - INTERVAL '{days} days'
          {ctx_sql}
        GROUP BY day
        ORDER BY day
    """, ctx_params)

    return [
        {"day": str(r[0]), "cost": round(r[1], 2), "deployments": r[2]}
        for r in rows
    ]


def event_timeline(hours=24, event_type=None):
    """Event count bucketed by hour for timeline chart."""
    try:
        conn = get_conn()
    except (ImportError, Exception):
        return []

    params = []
    type_sql = ""
    if event_type:
        type_sql = "AND type = ?"
        params.append(event_type)

    rows = _execute(conn, f"""
        SELECT
            DATE_TRUNC('hour', ts) AS bucket,
            type,
            COUNT(*) AS count
        FROM event_log
        WHERE ts >= NOW() - INTERVAL '{hours} hours'
          {type_sql}
        GROUP BY bucket, type
        ORDER BY bucket
    """, params)

    return [
        {"ts": str(r[0]), "type": r[1], "count": r[2]}
        for r in rows
    ]


def deployment_comparison(deployments, hours=24):
    """Compare CPU/memory across multiple deployments."""
    try:
        conn = get_conn()
    except (ImportError, Exception):
        return []

    if not deployments:
        return []

    ctx_sql, ctx_params = _ctx_clause()
    placeholders = ", ".join("?" for _ in deployments)
    params = list(deployments) + ctx_params

    rows = _execute(conn, f"""
        SELECT
            deployment,
            AVG(cpu_avg)::INTEGER AS cpu_avg,
            MAX(cpu_p95) AS cpu_p95,
            AVG(mem_avg)::INTEGER AS mem_avg,
            MAX(mem_p95) AS mem_p95,
            AVG(pod_count)::INTEGER AS pods,
            SUM(restart_count) AS restarts
        FROM hourly_pod_metrics
        WHERE hour >= NOW() - INTERVAL '{hours} hours'
          AND deployment IN ({placeholders})
          {ctx_sql}
        GROUP BY deployment
        ORDER BY cpu_avg DESC
    """, params)

    return [
        {
            "deployment": r[0], "cpu_avg": r[1], "cpu_p95": r[2],
            "mem_avg": r[3], "mem_p95": r[4], "pods": r[5],
            "restarts": r[6],
        }
        for r in rows
    ]


def top_consumers(hours=6, limit=10):
    """Top resource consumers in the last N hours."""
    try:
        conn = get_conn()
    except (ImportError, Exception):
        return []

    ctx_sql, ctx_params = _ctx_clause()

    rows = _execute(conn, f"""
        SELECT
            deployment,
            namespace,
            AVG(cpu_avg)::INTEGER AS cpu_avg,
            AVG(mem_avg)::INTEGER AS mem_avg,
            AVG(pod_count)::INTEGER AS pods,
            SUM(restart_count) AS restarts
        FROM hourly_pod_metrics
        WHERE hour >= NOW() - INTERVAL '{hours} hours'
          AND deployment != ''
          {ctx_sql}
        GROUP BY deployment, namespace
        ORDER BY cpu_avg + mem_avg DESC
        LIMIT {limit}
    """, ctx_params)

    # Fallback to raw data if no hourly rows yet
    if not rows:
        rows = _execute(conn, f"""
            SELECT
                deployment,
                namespace,
                AVG(cpu_millicores)::INTEGER AS cpu_avg,
                AVG(memory_mb)::INTEGER AS mem_avg,
                COUNT(DISTINCT pod)::INTEGER AS pods,
                SUM(restarts) AS restarts
            FROM raw_pod_metrics
            WHERE ts >= NOW() - INTERVAL '{hours} hours'
              AND deployment != ''
              {ctx_sql}
            GROUP BY deployment, namespace
            ORDER BY cpu_avg + mem_avg DESC
            LIMIT {limit}
        """, ctx_params)

    return [
        {
            "deployment": r[0], "namespace": r[1],
            "cpu_avg": r[2], "mem_avg": r[3],
            "pods": r[4], "restarts": r[5],
        }
        for r in rows
    ]
