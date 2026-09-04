"""
Analytics Aggregator — roll up raw metrics to hourly and daily,
enforce retention policies per storage level.
"""

from datetime import datetime, timedelta
from core.analytics.engine import get_conn

RAW_RETENTION_DAYS = 7
AGG_RETENTION_DAYS = 90


def aggregate_hourly():
    """Roll completed raw samples into hourly tables atomically.

    Raw rows remain untouched if aggregation fails. Existing hourly groups are
    replaced before insert, making retries idempotent when a previous run was
    interrupted after writing aggregates but before cleanup.
    """
    conn = get_conn()
    cutoff = "DATE_TRUNC('hour', NOW())"

    conn.execute("DROP TABLE IF EXISTS _hourly_pod_rollup")
    conn.execute("DROP TABLE IF EXISTS _hourly_node_rollup")
    conn.execute("BEGIN TRANSACTION")
    try:
        conn.execute(f"""
            CREATE TEMP TABLE _hourly_pod_rollup AS
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
            WHERE ts < {cutoff}
            GROUP BY hour, context, namespace, deployment
        """)
        conn.execute(f"""
            CREATE TEMP TABLE _hourly_node_rollup AS
            SELECT
                DATE_TRUNC('hour', ts) AS hour,
                context,
                node,
                AVG(cpu_pct)::INTEGER AS cpu_avg,
                MAX(cpu_pct) AS cpu_max,
                AVG(mem_pct)::INTEGER AS mem_avg,
                MAX(mem_pct) AS mem_max
            FROM raw_node_metrics
            WHERE ts < {cutoff}
            GROUP BY hour, context, node
        """)

        pod_count = conn.execute(
            "SELECT COUNT(*) FROM _hourly_pod_rollup"
        ).fetchone()[0]
        node_count = conn.execute(
            "SELECT COUNT(*) FROM _hourly_node_rollup"
        ).fetchone()[0]

        # Replace only groups represented by this batch. This handles retries
        # without deleting unrelated contexts or already-complete hours.
        conn.execute("""
            DELETE FROM hourly_pod_metrics
            WHERE EXISTS (
                SELECT 1
                FROM _hourly_pod_rollup AS batch
                WHERE hourly_pod_metrics.hour = batch.hour
                  AND hourly_pod_metrics.context = batch.context
                  AND hourly_pod_metrics.namespace = batch.namespace
                  AND hourly_pod_metrics.deployment = batch.deployment
            )
        """)
        conn.execute("""
            INSERT INTO hourly_pod_metrics
            SELECT * FROM _hourly_pod_rollup
        """)

        conn.execute("""
            DELETE FROM hourly_node_metrics
            WHERE EXISTS (
                SELECT 1
                FROM _hourly_node_rollup AS batch
                WHERE hourly_node_metrics.hour = batch.hour
                  AND hourly_node_metrics.context = batch.context
                  AND hourly_node_metrics.node = batch.node
            )
        """)
        conn.execute("""
            INSERT INTO hourly_node_metrics
            SELECT * FROM _hourly_node_rollup
        """)

        # Cleanup happens in the same transaction, after both inserts succeed.
        conn.execute(f"DELETE FROM raw_pod_metrics WHERE ts < {cutoff}")
        conn.execute(f"DELETE FROM raw_node_metrics WHERE ts < {cutoff}")
        conn.execute("COMMIT")
    except Exception:
        conn.execute("ROLLBACK")
        raise
    finally:
        conn.execute("DROP TABLE IF EXISTS _hourly_pod_rollup")
        conn.execute("DROP TABLE IF EXISTS _hourly_node_rollup")

    return {"pods": pod_count, "nodes": node_count}


def aggregate_daily():
    """Roll completed hourly pod groups into daily summaries atomically.

    Completed hourly pod rows are deleted only after their daily summary rows
    have been written. Existing daily groups are replaced, so retries cannot
    double-count data.
    """
    conn = get_conn()

    cost_model = conn.execute(
        "SELECT 1 FROM cost_model WHERE name = 'default' LIMIT 1"
    ).fetchone()
    if not cost_model:
        raise RuntimeError("default cost model is required for daily aggregation")

    conn.execute("DROP TABLE IF EXISTS _daily_rollup")
    conn.execute("BEGIN TRANSACTION")
    try:
        conn.execute("""
            CREATE TEMP TABLE _daily_rollup AS
            SELECT
                DATE_TRUNC('day', h.hour)::DATE AS day,
                h.context,
                h.namespace,
                h.deployment,
                AVG(h.cpu_avg)::INTEGER AS cpu_avg,
                MAX(h.cpu_p95) AS cpu_p95,
                AVG(h.mem_avg)::INTEGER AS mem_avg,
                MAX(h.mem_p95) AS mem_p95,
                ROUND(
                    (AVG(h.cpu_avg) / 1000.0 * c.cpu_per_core_hour
                    + AVG(h.mem_avg) / 1024.0 * c.mem_per_gb_hour)
                    * 24, 4
                ) AS cost_estimate_usd,
                AVG(h.pod_count)::INTEGER AS pod_count_avg,
                ROUND(
                    COUNT(CASE WHEN h.pod_count > 0 THEN 1 END)
                    * 100.0 / COUNT(*), 2
                ) AS availability_pct
            FROM hourly_pod_metrics h
            CROSS JOIN cost_model c
            WHERE c.name = 'default'
              AND DATE_TRUNC('day', h.hour) < CURRENT_DATE
            GROUP BY DATE_TRUNC('day', h.hour)::DATE,
                     h.context, h.namespace, h.deployment,
                     c.cpu_per_core_hour, c.mem_per_gb_hour
        """)

        daily_count = conn.execute(
            "SELECT COUNT(*) FROM _daily_rollup"
        ).fetchone()[0]

        if daily_count:
            conn.execute("""
                DELETE FROM daily_summary
                WHERE EXISTS (
                    SELECT 1
                    FROM _daily_rollup AS batch
                    WHERE daily_summary.day = batch.day
                      AND daily_summary.context = batch.context
                      AND daily_summary.namespace = batch.namespace
                      AND daily_summary.deployment = batch.deployment
                )
            """)
            conn.execute("""
                INSERT INTO daily_summary
                SELECT * FROM _daily_rollup
            """)

            # Pod hourly rows are now represented by daily_summary. Keep node
            # hourly history separately because no daily node table exists.
            conn.execute("""
                DELETE FROM hourly_pod_metrics
                WHERE hour < CURRENT_DATE
            """)

        conn.execute("COMMIT")
    except Exception:
        conn.execute("ROLLBACK")
        raise
    finally:
        conn.execute("DROP TABLE IF EXISTS _daily_rollup")

    return {"days": daily_count}


def prune_raw():
    """Delete raw and enriched data that survived a completed rollup.

    Normal completed pod/node samples are removed transactionally by
    aggregate_hourly(); this catches stale rows after outages or failed
    collections without deleting current-hour samples.
    """
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
    """Delete daily_summary older than retention period."""
    conn = get_conn()
    cutoff = datetime.utcnow() - timedelta(days=AGG_RETENTION_DAYS)
    conn.execute(
        "DELETE FROM daily_summary WHERE day < ?", [cutoff]
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

    conn = get_conn()
    cutoff = datetime.utcnow() - timedelta(days=AGG_RETENTION_DAYS)
    cutoff_7d = datetime.utcnow() - timedelta(days=RAW_RETENTION_DAYS)

    # Prune collection_log (keep 7 days)
    try:
        conn.execute(
            "DELETE FROM collection_log WHERE ts < ?", [cutoff_7d]
        )
    except Exception:
        pass

    # Prune enriched snapshot tables (keep 7 days)
    try:
        conn.execute(
            "DELETE FROM hpa_metrics WHERE ts < ?", [cutoff_7d]
        )
        conn.execute(
            "DELETE FROM quota_metrics WHERE ts < ?", [cutoff_7d]
        )
        conn.execute(
            "DELETE FROM rollout_metrics WHERE ts < ?", [cutoff_7d]
        )
        conn.execute(
            "DELETE FROM oomkill_events WHERE ts < ?", [cutoff_7d]
        )
    except Exception:
        pass

    # Prune telemetry, audit, and incident history (keep 90 days).
    # pod_state is current-state data and cost_model is configuration, so
    # neither table is retention-pruned.
    try:
        conn.execute(
            "DELETE FROM command_usage WHERE ts < ?", [cutoff]
        )
        conn.execute(
            "DELETE FROM event_log WHERE ts < ?", [cutoff]
        )
        conn.execute(
            "DELETE FROM audit_log WHERE ts < ?", [cutoff]
        )
        conn.execute(
            "DELETE FROM unresolved_queries WHERE ts < ?", [cutoff]
        )
        conn.execute(
            "DELETE FROM incidents WHERE TRY_CAST(started AS TIMESTAMP) < ?",
            [cutoff],
        )
        conn.execute(
            "DELETE FROM incident_events WHERE TRY_CAST(ts AS TIMESTAMP) < ?",
            [cutoff],
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
    conn.execute("CHECKPOINT")
    return {"status": "ok"}
