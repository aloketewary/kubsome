"""
Cost Chargeback — label-based cost attribution for shared clusters.

Maps resource usage to teams/apps/environments via Kubernetes labels,
blends with cloud billing data (OpenCost or cloud export), and generates
showback/chargeback reports.

Label strategy (configurable):
  team:     app.kubernetes.io/team, team, owner
  app:      app.kubernetes.io/name, app, application
  env:      app.kubernetes.io/env, environment, env

Data flow:
  1. Collector stores labels per pod (state_cache)
  2. This module joins labels with hourly metrics
  3. Aggregates cost by team/app/env
  4. Optionally blends with OpenCost or cloud billing CSV
  5. Generates chargeback reports (JSON, CSV, Markdown)
"""

import json
import subprocess
import csv
from pathlib import Path
from datetime import datetime

from core.analytics.engine import get_conn, execute, execute_one
from core.context import context as k8s_context
from core.config import load_config

EXPORT_DIR = Path.home() / ".kubsome" / "chargeback"
_tables_created = False


# --- Configuration ---

def _get_chargeback_config():
    """Load chargeback label mapping from config."""
    cfg = load_config().get("chargeback", {})
    return {
        "team_labels": cfg.get("team_labels", [
            "app.kubernetes.io/team", "team", "owner",
        ]),
        "app_labels": cfg.get("app_labels", [
            "app.kubernetes.io/name", "app", "application",
        ]),
        "env_labels": cfg.get("env_labels", [
            "app.kubernetes.io/env", "environment", "env",
        ]),
        "billing_labels": cfg.get("billing_labels", [
            "billingTag", "billing-tag", "cost-center",
            "costCenter", "billing",
        ]),
        "cost_model": cfg.get("cost_model", "default"),
        "opencost_url": cfg.get("opencost_url", ""),
    }


# --- Core Attribution ---

def cost_by_team(days=7):
    """
    Cost attribution grouped by team label.
    Joins pod labels with hourly metrics.
    """
    conn = get_conn()
    _ensure_tables(conn)
    _refresh_label_mapping(conn)

    ctx = k8s_context.current_context
    cfg = _get_chargeback_config()

    rows = execute(f"""
        SELECT
            COALESCE(lm.team, 'unattributed') AS team,
            COUNT(DISTINCT h.deployment) AS deployments,
            SUM(h.pod_count) AS total_pod_hours,
            AVG(h.cpu_avg)::INTEGER AS cpu_avg_m,
            AVG(h.mem_avg)::INTEGER AS mem_avg_mb,
            ROUND(
                (SUM(h.cpu_avg) / 1000.0 * c.cpu_per_core_hour
                + SUM(h.mem_avg) / 1024.0 * c.mem_per_gb_hour)
                , 2
            ) AS cost_usd
        FROM hourly_pod_metrics h
        LEFT JOIN label_mapping lm
            ON h.deployment = lm.deployment
            AND h.namespace = lm.namespace
            AND h.context = lm.context
        CROSS JOIN cost_model c
        WHERE c.name = '{cfg["cost_model"]}'
          AND h.context = '{ctx}'
          AND h.hour >= NOW() - INTERVAL '{days} days'
          AND h.deployment != ''
        GROUP BY team, c.cpu_per_core_hour, c.mem_per_gb_hour
        ORDER BY cost_usd DESC
    """)

    return [
        {
            "team": r[0], "deployments": r[1],
            "pod_hours": r[2], "cpu_avg_m": r[3],
            "mem_avg_mb": r[4], "cost_usd": r[5],
        }
        for r in rows
    ]


def cost_by_app(days=7):
    """Cost attribution grouped by app label."""
    conn = get_conn()
    _ensure_tables(conn)
    _refresh_label_mapping(conn)

    ctx = k8s_context.current_context
    cfg = _get_chargeback_config()

    rows = execute(f"""
        SELECT
            COALESCE(lm.app, h.deployment) AS app,
            lm.team,
            h.namespace,
            AVG(h.cpu_avg)::INTEGER AS cpu_avg_m,
            AVG(h.mem_avg)::INTEGER AS mem_avg_mb,
            AVG(h.pod_count)::INTEGER AS avg_pods,
            ROUND(
                (AVG(h.cpu_avg) / 1000.0 * c.cpu_per_core_hour
                + AVG(h.mem_avg) / 1024.0 * c.mem_per_gb_hour)
                * 24 * {days}, 2
            ) AS cost_usd
        FROM hourly_pod_metrics h
        LEFT JOIN label_mapping lm
            ON h.deployment = lm.deployment
            AND h.namespace = lm.namespace
            AND h.context = lm.context
        CROSS JOIN cost_model c
        WHERE c.name = '{cfg["cost_model"]}'
          AND h.context = '{ctx}'
          AND h.hour >= NOW() - INTERVAL '{days} days'
          AND h.deployment != ''
        GROUP BY app, lm.team, h.namespace,
                 c.cpu_per_core_hour, c.mem_per_gb_hour
        ORDER BY cost_usd DESC
    """)

    return [
        {
            "app": r[0], "team": r[1] or "unattributed",
            "namespace": r[2], "cpu_avg_m": r[3],
            "mem_avg_mb": r[4], "avg_pods": r[5],
            "cost_usd": r[6],
        }
        for r in rows
    ]


def cost_by_namespace(days=7):
    """Cost attribution grouped by namespace."""
    ctx = k8s_context.current_context
    cfg = _get_chargeback_config()

    rows = execute(f"""
        SELECT
            h.namespace,
            COUNT(DISTINCT h.deployment) AS deployments,
            AVG(h.pod_count)::INTEGER AS avg_pods,
            AVG(h.cpu_avg)::INTEGER AS cpu_avg_m,
            AVG(h.mem_avg)::INTEGER AS mem_avg_mb,
            ROUND(
                (AVG(h.cpu_avg) / 1000.0 * c.cpu_per_core_hour
                + AVG(h.mem_avg) / 1024.0 * c.mem_per_gb_hour)
                * 24 * {days}, 2
            ) AS cost_usd
        FROM hourly_pod_metrics h
        CROSS JOIN cost_model c
        WHERE c.name = '{cfg["cost_model"]}'
          AND h.context = '{ctx}'
          AND h.hour >= NOW() - INTERVAL '{days} days'
          AND h.deployment != ''
        GROUP BY h.namespace,
                 c.cpu_per_core_hour, c.mem_per_gb_hour
        ORDER BY cost_usd DESC
    """)

    return [
        {
            "namespace": r[0], "deployments": r[1],
            "avg_pods": r[2], "cpu_avg_m": r[3],
            "mem_avg_mb": r[4], "cost_usd": r[5],
        }
        for r in rows
    ]


def cost_by_environment(days=7):
    """Cost attribution grouped by environment label."""
    conn = get_conn()
    _ensure_tables(conn)
    _refresh_label_mapping(conn)

    ctx = k8s_context.current_context
    cfg = _get_chargeback_config()

    rows = execute(f"""
        SELECT
            COALESCE(lm.env, 'unknown') AS env,
            COUNT(DISTINCT h.deployment) AS deployments,
            AVG(h.cpu_avg)::INTEGER AS cpu_avg_m,
            AVG(h.mem_avg)::INTEGER AS mem_avg_mb,
            ROUND(
                (AVG(h.cpu_avg) / 1000.0 * c.cpu_per_core_hour
                + AVG(h.mem_avg) / 1024.0 * c.mem_per_gb_hour)
                * 24 * {days}, 2
            ) AS cost_usd
        FROM hourly_pod_metrics h
        LEFT JOIN label_mapping lm
            ON h.deployment = lm.deployment
            AND h.namespace = lm.namespace
            AND h.context = lm.context
        CROSS JOIN cost_model c
        WHERE c.name = '{cfg["cost_model"]}'
          AND h.context = '{ctx}'
          AND h.hour >= NOW() - INTERVAL '{days} days'
          AND h.deployment != ''
        GROUP BY env, c.cpu_per_core_hour, c.mem_per_gb_hour
        ORDER BY cost_usd DESC
    """)

    return [
        {
            "env": r[0], "deployments": r[1],
            "cpu_avg_m": r[2], "mem_avg_mb": r[3],
            "cost_usd": r[4],
        }
        for r in rows
    ]


def cost_by_billing_tag(days=7):
    """Cost attribution grouped by billing tag label (e.g. billingTag, cost-center)."""
    conn = get_conn()
    _ensure_tables(conn)
    _refresh_label_mapping(conn)

    ctx = k8s_context.current_context
    cfg = _get_chargeback_config()

    rows = execute(f"""
        SELECT
            COALESCE(lm.billing_tag, 'untagged') AS billing_tag,
            COUNT(DISTINCT h.deployment) AS deployments,
            AVG(h.pod_count)::INTEGER AS avg_pods,
            AVG(h.cpu_avg)::INTEGER AS cpu_avg_m,
            AVG(h.mem_avg)::INTEGER AS mem_avg_mb,
            ROUND(
                (AVG(h.cpu_avg) / 1000.0 * c.cpu_per_core_hour
                + AVG(h.mem_avg) / 1024.0 * c.mem_per_gb_hour)
                * 24 * {days}, 2
            ) AS cost_usd
        FROM hourly_pod_metrics h
        LEFT JOIN label_mapping lm
            ON h.deployment = lm.deployment
            AND h.namespace = lm.namespace
            AND h.context = lm.context
        CROSS JOIN cost_model c
        WHERE c.name = '{cfg["cost_model"]}'
          AND h.context = '{ctx}'
          AND h.hour >= NOW() - INTERVAL '{days} days'
          AND h.deployment != ''
        GROUP BY billing_tag, c.cpu_per_core_hour, c.mem_per_gb_hour
        ORDER BY cost_usd DESC
    """)

    return [
        {
            "billing_tag": r[0], "deployments": r[1],
            "avg_pods": r[2], "cpu_avg_m": r[3],
            "mem_avg_mb": r[4], "cost_usd": r[5],
        }
        for r in rows
    ]


# --- OpenCost Integration ---

def import_opencost(url=None):
    """
    Pull allocation data from OpenCost API and store in DuckDB.
    OpenCost endpoint: /allocation/compute?window=7d&aggregate=namespace
    """
    from core.safety import is_safe_url
    cfg = _get_chargeback_config()
    endpoint = url or cfg["opencost_url"]
    if not endpoint:
        return {"error": "opencost_url not configured"}

    if not is_safe_url(endpoint):
        return {"error": f"Blocked unsafe OpenCost URL: {endpoint}"}

    try:
        import urllib.request
        api_url = (
            f"{endpoint.rstrip('/')}/allocation/compute"
            f"?window=7d&aggregate=namespace,label:team"
        )
        with urllib.request.urlopen(api_url, timeout=10) as resp:
            data = json.loads(resp.read())
    except Exception as e:
        return {"error": f"Failed to reach OpenCost: {e}"}

    conn = get_conn()
    _ensure_tables(conn)
    ctx = k8s_context.current_context
    ts = datetime.utcnow()

    rows = []
    for window in data.get("data", []):
        for key, alloc in window.items():
            parts = key.split("/")
            namespace = parts[0] if parts else ""
            team = parts[1] if len(parts) > 1 else ""

            rows.append((
                ts, ctx, namespace, team,
                round(alloc.get("cpuCost", 0), 4),
                round(alloc.get("ramCost", 0), 4),
                round(alloc.get("pvCost", 0), 4),
                round(alloc.get("networkCost", 0), 4),
                round(alloc.get("totalCost", 0), 4),
            ))

    if rows:
        conn.executemany(
            "INSERT INTO cloud_billing VALUES (?,?,?,?,?,?,?,?,?)",
            rows
        )

    return {"imported": len(rows)}


def import_billing_csv(path):
    """
    Import cloud billing CSV (AWS CUR, GCP export, or custom).
    Expected columns: date, namespace, team, cpu_cost, mem_cost, total_cost
    """
    conn = get_conn()
    _ensure_tables(conn)
    ctx = k8s_context.current_context

    rows = []
    with open(path, "r") as f:
        reader = csv.DictReader(f)
        for row in reader:
            rows.append((
                row.get("date", datetime.utcnow().isoformat()),
                ctx,
                row.get("namespace", ""),
                row.get("team", ""),
                float(row.get("cpu_cost", 0)),
                float(row.get("mem_cost", 0)),
                float(row.get("pv_cost", 0)),
                float(row.get("network_cost", 0)),
                float(row.get("total_cost", 0)),
            ))

    if rows:
        conn.executemany(
            "INSERT INTO cloud_billing VALUES (?,?,?,?,?,?,?,?,?)",
            rows
        )

    return {"imported": len(rows)}


# --- Chargeback Reports ---

def chargeback_report(days=30, group_by="team", format="json"):
    """
    Generate chargeback report.
    group_by: team, app, namespace, environment
    format: json, csv, markdown
    """
    if group_by == "team":
        data = cost_by_team(days)
    elif group_by == "app":
        data = cost_by_app(days)
    elif group_by == "namespace":
        data = cost_by_namespace(days)
    elif group_by == "environment":
        data = cost_by_environment(days)
    elif group_by == "billing_tag":
        data = cost_by_billing_tag(days)
    else:
        data = cost_by_team(days)

    # Blend with cloud billing if available
    cloud = _get_cloud_totals(days)

    total_kubsome = sum(r.get("cost_usd", 0) for r in data)
    total_cloud = cloud.get("total", 0)

    # If cloud data exists, scale kubsome estimates to match
    scale_factor = (
        total_cloud / total_kubsome
        if total_kubsome > 0 and total_cloud > 0
        else 1.0
    )

    report = {
        "period_days": days,
        "group_by": group_by,
        "generated_at": datetime.utcnow().isoformat(),
        "total_estimated_usd": round(total_kubsome * scale_factor, 2),
        "cloud_actual_usd": total_cloud if total_cloud > 0 else None,
        "scale_factor": round(scale_factor, 3),
        "items": [],
    }

    for r in data:
        item = dict(r)
        item["adjusted_cost_usd"] = round(
            r.get("cost_usd", 0) * scale_factor, 2
        )
        item["pct_of_total"] = round(
            r.get("cost_usd", 0) * 100 / total_kubsome, 1
        ) if total_kubsome > 0 else 0
        report["items"].append(item)

    if format == "csv":
        return _export_csv(report)
    elif format == "markdown":
        return _export_markdown(report)
    return report


def _get_cloud_totals(days):
    """Get cloud billing totals if available."""
    ctx = k8s_context.current_context
    try:
        row = execute_one(f"""
            SELECT SUM(total_cost) FROM cloud_billing
            WHERE context = '{ctx}'
              AND ts >= NOW() - INTERVAL '{days} days'
        """)
        return {"total": row[0] if row and row[0] else 0}
    except Exception:
        return {"total": 0}


def _export_csv(report):
    """Export report as CSV file."""
    EXPORT_DIR.mkdir(parents=True, exist_ok=True)
    path = EXPORT_DIR / f"chargeback_{report['group_by']}_{report['period_days']}d.csv"

    items = report["items"]
    if not items:
        return str(path)

    with open(path, "w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=items[0].keys())
        writer.writeheader()
        writer.writerows(items)

    return str(path)


def _export_markdown(report):
    """Export report as Markdown."""
    EXPORT_DIR.mkdir(parents=True, exist_ok=True)
    path = EXPORT_DIR / f"chargeback_{report['group_by']}_{report['period_days']}d.md"

    lines = [
        f"# Chargeback Report — by {report['group_by']}",
        "",
        f"Period: {report['period_days']} days | "
        f"Generated: {report['generated_at'][:10]}",
        f"Total: ${report['total_estimated_usd']:.2f}",
    ]

    if report["cloud_actual_usd"]:
        lines.append(
            f"Cloud actual: ${report['cloud_actual_usd']:.2f} "
            f"(scale factor: {report['scale_factor']}x)"
        )

    lines.extend(["", "| Group | Cost | % | Deployments |", "|---|---|---|---|"])

    for item in report["items"]:
        group = item.get(
            report["group_by"],
            item.get("team", item.get("app", "?"))
        )
        lines.append(
            f"| {group} "
            f"| ${item['adjusted_cost_usd']:.2f} "
            f"| {item['pct_of_total']}% "
            f"| {item.get('deployments', '—')} |"
        )

    path.write_text("\n".join(lines))
    return str(path)


# --- Label Mapping ---

def _refresh_label_mapping(conn):
    """
    Refresh label_mapping table from current pod_state labels.
    Extracts team/app/env from label strings.
    """
    ctx = k8s_context.current_context
    if not ctx:
        return

    cfg = _get_chargeback_config()

    # Get deployments with labels from state cache
    try:
        rows = conn.execute(f"""
            SELECT DISTINCT deployment, namespace, context, labels
            FROM pod_state
            WHERE context = '{ctx}' AND deployment != ''
        """).fetchall()
    except Exception:
        return

    if not rows:
        return

    # Clear and rebuild for this context
    conn.execute(
        "DELETE FROM label_mapping WHERE context = ?", [ctx]
    )

    mappings = []
    for deployment, namespace, context_val, labels_str in rows:
        labels = _parse_labels(labels_str)
        team = _extract_label(labels, cfg["team_labels"])
        app = _extract_label(labels, cfg["app_labels"])
        env = _extract_label(labels, cfg["env_labels"])
        billing_tag = _extract_label(labels, cfg["billing_labels"])

        mappings.append((
            context_val, namespace, deployment, team, app, env,
            billing_tag
        ))

    if mappings:
        conn.executemany(
            "INSERT INTO label_mapping VALUES (?,?,?,?,?,?,?)",
            mappings
        )


def _parse_labels(labels_str):
    """Parse 'key=val,key2=val2' into dict."""
    if not labels_str:
        return {}
    result = {}
    for pair in labels_str.split(","):
        if "=" in pair:
            k, v = pair.split("=", 1)
            result[k.strip()] = v.strip()
    return result


def _extract_label(labels, candidates):
    """Extract first matching label from candidates list."""
    for key in candidates:
        if key in labels:
            return labels[key]
    return None


# --- Schema ---

def _ensure_tables(conn):
    """Create chargeback tables."""
    global _tables_created
    if _tables_created:
        return

    conn.execute("""
        CREATE TABLE IF NOT EXISTS label_mapping (
            context VARCHAR,
            namespace VARCHAR,
            deployment VARCHAR,
            team VARCHAR,
            app VARCHAR,
            env VARCHAR,
            billing_tag VARCHAR
        )
    """)

    conn.execute("""
        CREATE TABLE IF NOT EXISTS cloud_billing (
            ts TIMESTAMP,
            context VARCHAR,
            namespace VARCHAR,
            team VARCHAR,
            cpu_cost DOUBLE,
            mem_cost DOUBLE,
            pv_cost DOUBLE,
            network_cost DOUBLE,
            total_cost DOUBLE
        )
    """)

    conn.execute("""
        CREATE INDEX IF NOT EXISTS idx_label_map
        ON label_mapping (context, namespace, deployment)
    """)
    conn.execute("""
        CREATE INDEX IF NOT EXISTS idx_billing_ctx
        ON cloud_billing (context, ts)
    """)

    _tables_created = True
