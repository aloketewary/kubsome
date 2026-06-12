"""
Analytics Export — CSV and Parquet export from DuckDB
for integration with external tools.
"""

from pathlib import Path
from datetime import datetime

from core.analytics.engine import get_conn, ANALYTICS_DIR


EXPORT_DIR = ANALYTICS_DIR / "exports"


def export_csv(query_name="raw_pods", days=7, output=None):
    """
    Export analytics data to CSV.
    Returns the file path.
    """
    EXPORT_DIR.mkdir(parents=True, exist_ok=True)
    conn = get_conn()

    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = output or f"{query_name}_{ts}.csv"
    path = EXPORT_DIR / filename

    queries = {
        "raw_pods": """
            SELECT * FROM raw_pod_metrics
            WHERE ts >= NOW() - INTERVAL (?) DAYS
            ORDER BY ts DESC
        """,
        "raw_nodes": """
            SELECT * FROM raw_node_metrics
            WHERE ts >= NOW() - INTERVAL (?) DAYS
            ORDER BY ts DESC
        """,
        "hourly": """
            SELECT * FROM hourly_pod_metrics
            WHERE hour >= NOW() - INTERVAL (?) DAYS
            ORDER BY hour DESC
        """,
        "daily": """
            SELECT * FROM daily_summary
            ORDER BY day DESC
        """,
        "rightsizing": """
            SELECT
                deployment, namespace,
                AVG(pod_count)::INTEGER AS pods,
                MAX(cpu_request) AS cpu_req_m,
                MAX(cpu_p95) AS cpu_p95_m,
                MAX(mem_request) AS mem_req_mb,
                MAX(mem_p95) AS mem_p95_mb
            FROM hourly_pod_metrics
            WHERE hour >= NOW() - INTERVAL (?) DAYS
              AND deployment != ''
            GROUP BY deployment, namespace
            ORDER BY deployment
        """,
        "cost": """
            SELECT
                d.deployment, d.namespace,
                d.cpu_avg, d.mem_avg,
                d.cost_estimate_usd, d.day
            FROM daily_summary d
            ORDER BY d.day DESC, d.cost_estimate_usd DESC
        """,
    }

    sql = queries.get(query_name)
    if not sql:
        return None

    # 🛡️ Sentinel: Use parameterized queries to prevent SQLi
    conn.execute(
        f"COPY ({sql}) TO '{path}' (HEADER, DELIMITER ',')",
        [days] if "(?)" in sql else None
    )

    return str(path)


def export_parquet(query_name="hourly", days=30, output=None):
    """Export to Parquet format for BI tools."""
    EXPORT_DIR.mkdir(parents=True, exist_ok=True)
    conn = get_conn()

    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = output or f"{query_name}_{ts}.parquet"
    path = EXPORT_DIR / filename

    queries = {
        "hourly": """
            SELECT * FROM hourly_pod_metrics
            WHERE hour >= NOW() - INTERVAL (?) DAYS
        """,
        "daily": "SELECT * FROM daily_summary",
        "nodes": """
            SELECT * FROM hourly_node_metrics
            WHERE hour >= NOW() - INTERVAL (?) DAYS
        """,
    }

    sql = queries.get(query_name)
    if not sql:
        return None

    # 🛡️ Sentinel: Use parameterized queries to prevent SQLi
    conn.execute(
        f"COPY ({sql}) TO '{path}' (FORMAT PARQUET)",
        [days] if "(?)" in sql else None
    )

    return str(path)


def list_exports():
    """List existing export files."""
    if not EXPORT_DIR.exists():
        return []

    exports = []
    for f in sorted(EXPORT_DIR.iterdir(), reverse=True):
        if f.suffix in (".csv", ".parquet"):
            exports.append({
                "name": f.name,
                "size_kb": round(f.stat().st_size / 1024, 1),
                "format": f.suffix[1:],
                "path": str(f),
            })

    return exports[:20]


def run_custom_query(sql):
    """
    Run a custom SQL query against the analytics DB.
    Returns list of dicts.
    """
    conn = get_conn()
    try:
        result = conn.execute(sql)
        cols = [desc[0] for desc in result.description]
        rows = result.fetchall()
        return {
            "columns": cols,
            "rows": [dict(zip(cols, row)) for row in rows],
            "count": len(rows),
        }
    except Exception as e:
        return {"error": str(e)}
