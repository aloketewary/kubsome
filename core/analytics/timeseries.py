"""
Analytics Time-Series — query functions that return chart-ready
data from DuckDB for the Web UI.
Filters by current context automatically.
"""

from core.analytics.engine import get_conn
from core.context import context as k8s_context


def _ctx_filter(alias=""):
    """Return SQL AND clause for current context."""
    ctx = k8s_context.current_context
    if not ctx:
        return ""
    col = f"{alias}.context" if alias else "context"
    return f"AND {col} = '{ctx}'"


def cpu_memory_series(deployment=None, hours=24, interval="1 hour"):
    """
    Time-series CPU/memory for charting.
    Returns [{ts, cpu, mem, pods}] at given interval.
    Combines aggregated hourly data with raw data for the
    current incomplete hour.
    """
    try:
        conn = get_conn()
    except (ImportError, Exception):
        return []

    deploy_filter = (
        f"AND deployment = '{deployment}'" if deployment else ""
    )

    # Aggregated completed hours
    rows = conn.execute(f"""
        SELECT
            DATE_TRUNC('{interval}', hour) AS bucket,
            SUM(cpu_avg)::INTEGER AS cpu,
            SUM(mem_avg)::INTEGER AS mem,
            SUM(pod_count)::INTEGER AS pods
        FROM hourly_pod_metrics
        WHERE hour >= NOW() - INTERVAL '{hours} hours'
          {deploy_filter}
          {_ctx_filter()}
        GROUP BY bucket
        ORDER BY bucket
    """).fetchall()

    result = [
        {"ts": str(r[0]), "cpu": r[1], "mem": r[2], "pods": r[3]}
        for r in rows
    ]

    # Include current incomplete hour from raw data
    raw_rows = conn.execute(f"""
        SELECT
            DATE_TRUNC('hour', ts) AS bucket,
            AVG(cpu_millicores)::INTEGER AS cpu,
            AVG(memory_mb)::INTEGER AS mem,
            COUNT(DISTINCT pod)::INTEGER AS pods
        FROM raw_pod_metrics
        WHERE ts >= DATE_TRUNC('hour', NOW())
          AND deployment != ''
          {deploy_filter}
          {_ctx_filter()}
        GROUP BY bucket
    """).fetchall()

    for r in raw_rows:
        result.append(
            {"ts": str(r[0]), "cpu": r[1], "mem": r[2], "pods": r[3]}
        )

    return result


def node_series(node=None, hours=24):
    """Node CPU/memory % over time."""
    try:
        conn = get_conn()
    except (ImportError, Exception):
        return []

    node_filter = f"AND node = '{node}'" if node else ""

    rows = conn.execute(f"""
        SELECT
            hour,
            node,
            cpu_avg,
            mem_avg
        FROM hourly_node_metrics
        WHERE hour >= NOW() - INTERVAL '{hours} hours'
          {node_filter}
          {_ctx_filter()}
        ORDER BY hour
    """).fetchall()

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

    deploy_filter = (
        f"AND deployment = '{deployment}'" if deployment else ""
    )

    rows = conn.execute(f"""
        SELECT
            hour,
            deployment,
            restart_count
        FROM hourly_pod_metrics
        WHERE hour >= NOW() - INTERVAL '{hours} hours'
          AND restart_count > 0
          {deploy_filter}
          {_ctx_filter()}
        ORDER BY hour
    """).fetchall()

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

    rows = conn.execute(f"""
        SELECT
            day,
            SUM(cost_estimate_usd) AS daily_cost,
            COUNT(DISTINCT deployment) AS deployments
        FROM daily_summary
        WHERE day >= CURRENT_DATE - INTERVAL '{days} days'
          {_ctx_filter()}
        GROUP BY day
        ORDER BY day
    """).fetchall()

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

    type_filter = f"AND type = '{event_type}'" if event_type else ""

    rows = conn.execute(f"""
        SELECT
            DATE_TRUNC('hour', ts) AS bucket,
            type,
            COUNT(*) AS count
        FROM event_log
        WHERE ts >= NOW() - INTERVAL '{hours} hours'
          {type_filter}
        GROUP BY bucket, type
        ORDER BY bucket
    """).fetchall()

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

    deploy_list = ", ".join(f"'{d}'" for d in deployments)

    rows = conn.execute(f"""
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
          AND deployment IN ({deploy_list})
          {_ctx_filter()}
        GROUP BY deployment
        ORDER BY cpu_avg DESC
    """).fetchall()

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

    rows = conn.execute(f"""
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
          {_ctx_filter()}
        GROUP BY deployment, namespace
        ORDER BY cpu_avg + mem_avg DESC
        LIMIT {limit}
    """).fetchall()

    # Fallback to raw data if no hourly rows yet
    if not rows:
        rows = conn.execute(f"""
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
              {_ctx_filter()}
            GROUP BY deployment, namespace
            ORDER BY cpu_avg + mem_avg DESC
            LIMIT {limit}
        """).fetchall()

    return [
        {
            "deployment": r[0], "namespace": r[1],
            "cpu_avg": r[2], "mem_avg": r[3],
            "pods": r[4], "restarts": r[5],
        }
        for r in rows
    ]
