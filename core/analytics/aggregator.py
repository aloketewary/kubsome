"""
Analytics Aggregator — roll up raw metrics to hourly and daily,
enforce retention policies per storage level.
"""

from datetime import datetime, timedelta
from core.analytics.engine import get_conn

RAW_RETENTION_DAYS = 7
AGG_RETENTION_DAYS = 90


def aggregate_hourly():
    """
    Roll up raw_pod_metrics into hourly_pod_metrics.
    Only processes hours not yet aggregated.
    """
    conn = get_conn()

    conn.execute("""
        INSERT INTO hourly_pod_metrics
        SELECT
            DATE_TRUNC('hour', ts) AS hour,
            context,
            namespace,
            deployment,
            COUNT(DISTINCT pod) AS pod_count,
            AVG(cpu_millicores)::INTEGER AS cpu_avg,
            PERCENTILE_CONT(0.95) WITHIN GROUP
                (ORDER BY cpu_millicores)::INTEGER AS cpu_p95,
            MAX(cpu_millicores) AS cpu_max,
            AVG(memory_mb)::INTEGER AS mem_avg,
            PERCENTILE_CONT(0.95) WITHIN GROUP
                (ORDER BY memory_mb)::INTEGER AS mem_p95,
            MAX(memory_mb) AS mem_max,
            MAX(cpu_request) AS cpu_request,
            MAX(mem_request) AS mem_request,
            SUM(restarts) AS restart_count
        FROM raw_pod_metrics
        WHERE ts > (
            SELECT COALESCE(MAX(hour), '1970-01-01')
            FROM hourly_pod_metrics
        )
        AND deployment != ''
        GROUP BY hour, context, namespace, deployment
        HAVING hour < DATE_TRUNC('hour', NOW())
    """)

    # Node hourly
    conn.execute("""
        INSERT INTO hourly_node_metrics
        SELECT
            DATE_TRUNC('hour', ts) AS hour,
            context,
            node,
            AVG(cpu_pct)::INTEGER AS cpu_avg,
            MAX(cpu_pct) AS cpu_max,
            AVG(mem_pct)::INTEGER AS mem_avg,
            MAX(mem_pct) AS mem_max
        FROM raw_node_metrics
        WHERE ts > (
            SELECT COALESCE(MAX(hour), '1970-01-01')
            FROM hourly_node_metrics
        )
        GROUP BY hour, context, node
        HAVING hour < DATE_TRUNC('hour', NOW())
    """)


def aggregate_daily():
    """
    Roll up hourly_pod_metrics into daily_summary.
    Includes cost estimation.
    """
    conn = get_conn()

    conn.execute("""
        INSERT INTO daily_summary
        SELECT
            DATE_TRUNC('day', hour)::DATE AS day,
            h.context,
            h.namespace,
            h.deployment,
            AVG(h.cpu_avg)::INTEGER AS cpu_avg,
            MAX(h.cpu_p95) AS cpu_p95,
            AVG(h.mem_avg)::INTEGER AS mem_avg,
            MAX(h.mem_p95) AS mem_p95,
            -- Cost: (cpu_cores * $/core/hr + mem_gb * $/gb/hr) * 24h
            ROUND(
                (AVG(h.cpu_avg) / 1000.0 * c.cpu_per_core_hour
                + AVG(h.mem_avg) / 1024.0 * c.mem_per_gb_hour)
                * 24, 4
            ) AS cost_estimate_usd,
            AVG(h.pod_count)::INTEGER AS pod_count_avg,
            -- Availability: % of hours with pods running
            ROUND(
                COUNT(CASE WHEN h.pod_count > 0 THEN 1 END)
                * 100.0 / COUNT(*), 2
            ) AS availability_pct
        FROM hourly_pod_metrics h
        CROSS JOIN cost_model c
        WHERE c.name = 'default'
        AND hour > (
            SELECT COALESCE(
                MAX(day) + INTERVAL '1 day', '1970-01-01'
            ) FROM daily_summary
        )
        AND DATE_TRUNC('day', hour) < CURRENT_DATE
        GROUP BY day, h.context, h.namespace, h.deployment,
                 c.cpu_per_core_hour, c.mem_per_gb_hour
    """)


def prune_raw():
    """Delete raw data older than retention period."""
    conn = get_conn()
    cutoff = datetime.utcnow() - timedelta(days=RAW_RETENTION_DAYS)
    conn.execute(
        "DELETE FROM raw_pod_metrics WHERE ts < ?", [cutoff]
    )
    conn.execute(
        "DELETE FROM raw_node_metrics WHERE ts < ?", [cutoff]
    )
    # Prune enriched tables
    try:
        conn.execute(
            "DELETE FROM hpa_metrics WHERE ts < ?", [cutoff]
        )
        conn.execute(
            "DELETE FROM oomkill_events WHERE ts < ?", [cutoff]
        )
        conn.execute(
            "DELETE FROM quota_metrics WHERE ts < ?", [cutoff]
        )
        conn.execute(
            "DELETE FROM rollout_metrics WHERE ts < ?", [cutoff]
        )
    except Exception:
        pass  # Tables may not exist yet


def prune_aggregated():
    """Delete aggregated data older than retention period."""
    conn = get_conn()
    cutoff = datetime.utcnow() - timedelta(days=AGG_RETENTION_DAYS)
    conn.execute(
        "DELETE FROM hourly_pod_metrics WHERE hour < ?", [cutoff]
    )
    conn.execute(
        "DELETE FROM hourly_node_metrics WHERE hour < ?", [cutoff]
    )


def run_maintenance():
    """
    Run full maintenance cycle: aggregate + prune + archive + refresh.
    Safe to call frequently — idempotent operations.
    """
    aggregate_hourly()
    aggregate_daily()
    prune_raw()
    prune_aggregated()
    # Prune telemetry
    try:
        conn = get_conn()
        cutoff = datetime.utcnow() - timedelta(days=AGG_RETENTION_DAYS)
        conn.execute(
            "DELETE FROM command_usage WHERE ts < ?", [cutoff]
        )
        conn.execute(
            "DELETE FROM event_log WHERE ts < ?", [cutoff]
        )
    except Exception:
        pass
    # Refresh materialized views
    from core.analytics.engine import (
        refresh_materialized_views, archive_to_parquet
    )
    refresh_materialized_views()
    # Archive old data to Parquet (>90 days)
    archive_to_parquet(older_than_days=90)
    # Compact
    conn = get_conn()
    conn.execute("CHECKPOINT")
    return {"status": "ok"}
