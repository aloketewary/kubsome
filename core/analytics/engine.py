"""
Analytics Engine — DuckDB connection manager, schema init,
multi-level storage, caching, materialized views, and
Parquet partitioning strategy.

Caching layers:
  1. DuckDB internal: buffer pool, column compression, predicate pushdown
  2. App-level: TTL cache for frequent queries (rightsizing, cost)
  3. Materialized views: pre-computed aggregates refreshed on schedule
  4. Parquet + partitioning: cold data in partitioned Parquet files

Storage levels:
  - Raw: DuckDB table, 7-day retention
  - Aggregated: Materialized views + DuckDB table, 90-day
  - Archive: Partitioned Parquet files, forever
"""

try:
    import duckdb
except ImportError:
    duckdb = None
from pathlib import Path
from datetime import datetime, timedelta
import time
import threading

ANALYTICS_DIR = Path.home() / ".kubsome" / "analytics"
RAW_DIR = ANALYTICS_DIR / "raw"
AGG_DIR = ANALYTICS_DIR / "aggregated"
ARCHIVE_DIR = ANALYTICS_DIR / "archive"
PARQUET_DIR = ANALYTICS_DIR / "parquet"
MAIN_DB = ANALYTICS_DIR / "kubsome.duckdb"

_conn = None
_conn_lock = threading.Lock()
_last_recovery = 0
_RECOVERY_COOLDOWN = 5  # seconds between recovery attempts
# --- App-level query cache ---
_query_cache = {}
_cache_lock = threading.Lock()
DEFAULT_CACHE_TTL = 60  # seconds


def cached_query(key, sql, params=None, ttl=DEFAULT_CACHE_TTL):
    """
    App-level cache for expensive queries.
    Returns cached result if within TTL, else re-executes.
    """
    with _cache_lock:
        if key in _query_cache:
            entry = _query_cache[key]
            if time.time() - entry["ts"] < ttl:
                return entry["result"]

    conn = get_conn()
    if params:
        result = conn.execute(sql, params).fetchall()
    else:
        result = conn.execute(sql).fetchall()

    with _cache_lock:
        _query_cache[key] = {"ts": time.time(), "result": result}

    return result


def invalidate_cache(key=None):
    """Invalidate app-level cache (all or specific key)."""
    with _cache_lock:
        if key:
            _query_cache.pop(key, None)
        else:
            _query_cache.clear()


# --- Connection management ---

def get_conn():
    """
    Get or create the main DuckDB connection.
    Returns a ThreadSafeConnection wrapper.

    Strategy:
      - Try read-write on main DB (first process wins)
      - If locked, open read-only (CLI reads serve's data)
      - If read-only fails, use in-memory (graceful degradation)
    """
    global _conn
    if duckdb is None:
        raise ImportError(
            "duckdb not installed. Run: pip install duckdb"
        )
    with _conn_lock:
        if _conn is None:
            _ensure_dirs()
            _cleanup_stale_dbs()
            try:
                raw = duckdb.connect(
                    str(MAIN_DB),
                    config={"access_mode": "READ_WRITE"}
                )
                _configure_conn(raw)
                _init_schema(raw)
                _conn = _ThreadSafeConn(raw, writable=True)
            except duckdb.IOException:
                # Locked by another process — open read-only
                try:
                    raw = duckdb.connect(
                        str(MAIN_DB),
                        config={"access_mode": "READ_ONLY"}
                    )
                    _conn = _ThreadSafeConn(raw, writable=False)
                except Exception:
                    # Can't even read — in-memory fallback
                    raw = duckdb.connect(":memory:")
                    _configure_conn(raw)
                    _init_schema(raw)
                    _conn = _ThreadSafeConn(raw, writable=True)
            except duckdb.FatalException:
                raw = _recover_db()
                _conn = _ThreadSafeConn(raw, writable=True)
            except duckdb.InvalidInputException:
                raw = _recover_db()
                _conn = _ThreadSafeConn(raw, writable=True)
    return _conn


def is_writable():
    """Check if current connection has write access."""
    conn = get_conn()
    return conn._writable


def _cleanup_stale_dbs():
    """Remove leftover PID-based DB files from old approach."""
    for f in ANALYTICS_DIR.glob("kubsome_*.duckdb*"):
        f.unlink(missing_ok=True)


def _recover_db():
    """Delete corrupted DB and create fresh. Returns new raw connection."""
    global _conn, _last_recovery
    import logging

    now = time.time()
    if now - _last_recovery < _RECOVERY_COOLDOWN:
        # Avoid repeated recovery within cooldown
        raw = duckdb.connect(":memory:")
        _configure_conn(raw)
        _init_schema(raw)
        return raw

    _last_recovery = now
    logging.warning(
        "DuckDB corrupted — recreating: %s", MAIN_DB
    )
    # Reset global connection
    _conn = None
    for f in MAIN_DB.parent.glob("kubsome.duckdb*"):
        try:
            f.unlink(missing_ok=True)
        except OSError:
            pass
    raw = duckdb.connect(
        str(MAIN_DB), config={"access_mode": "READ_WRITE"}
    )
    _configure_conn(raw)
    _init_schema(raw)
    # Reset any module-level table-created flags
    try:
        import core.telemetry
        core.telemetry._table_created = False
    except Exception:
        pass
    return raw


class _ThreadSafeConn:
    """
    Wraps DuckDB connection with a lock for thread safety.
    Results are eagerly materialized inside the lock.
    Auto-recovers from fatal database errors.
    """

    def __init__(self, conn, writable=True):
        self._conn = conn
        self._writable = writable

    def execute(self, sql, params=None):
        with _conn_lock:
            try:
                if params:
                    result = self._conn.execute(sql, params)
                else:
                    result = self._conn.execute(sql)
                desc = result.description
                rows = result.fetchall()
            except (duckdb.FatalException,
                    duckdb.InvalidInputException) as e:
                if "invalidated" in str(e) or "Fatal" in str(e):
                    self._conn = _recover_db()
                    try:
                        if params:
                            result = self._conn.execute(sql, params)
                        else:
                            result = self._conn.execute(sql)
                        desc = result.description
                        rows = result.fetchall()
                    except Exception:
                        # Recovery failed — return empty
                        return _MaterializedResult([], None)
                else:
                    raise
        return _MaterializedResult(rows, desc)

    def executemany(self, sql, params_list):
        with _conn_lock:
            try:
                return self._conn.executemany(sql, params_list)
            except (duckdb.FatalException,
                    duckdb.InvalidInputException) as e:
                if "invalidated" in str(e) or "Fatal" in str(e):
                    self._conn = _recover_db()
                    return self._conn.executemany(
                        sql, params_list
                    )
                raise

    def close(self):
        with _conn_lock:
            self._conn.close()


class _MaterializedResult:
    """Pre-fetched result set safe for cross-thread access."""

    def __init__(self, rows, description):
        self._rows = rows
        self._description = description
        self._idx = 0

    def fetchall(self):
        return self._rows

    def fetchone(self):
        if self._idx < len(self._rows):
            row = self._rows[self._idx]
            self._idx += 1
            return row
        return None

    @property
    def description(self):
        return self._description


def close():
    """Close the connection."""
    global _conn
    with _conn_lock:
        if _conn:
            _conn._conn.close()
            _conn = None


def execute(sql, params=None):
    """Thread-safe query execution. Returns fetchall result."""
    conn = get_conn()
    return conn.execute(sql, params).fetchall()


def execute_one(sql, params=None):
    """Thread-safe single-row query. Returns fetchone result."""
    conn = get_conn()
    return conn.execute(sql, params).fetchone()


def execute_write(sql, params=None):
    """Thread-safe write (INSERT/UPDATE/DELETE)."""
    conn = get_conn()
    conn.execute(sql, params)


def execute_many(sql, params_list):
    """Thread-safe batch write."""
    conn = get_conn()
    conn.executemany(sql, params_list)


def _ensure_dirs():
    for d in (ANALYTICS_DIR, RAW_DIR, AGG_DIR, ARCHIVE_DIR, PARQUET_DIR):
        d.mkdir(parents=True, exist_ok=True)


def _configure_conn(conn):
    """
    Configure DuckDB internal caching and performance.
    - memory_limit: cap RAM usage
    - threads: parallel query execution
    - temp_directory: spill to disk for large queries
    """
    conn.execute("SET memory_limit='256MB'")
    conn.execute("SET threads=2")
    conn.execute(f"SET temp_directory='{ANALYTICS_DIR}/tmp'")
    # Enable progress bar for long queries
    conn.execute("SET enable_progress_bar=false")


def _init_schema(conn):
    """Create tables, indexes, and materialized views."""
    # --- Raw tables ---
    conn.execute("""
        CREATE TABLE IF NOT EXISTS raw_pod_metrics (
            ts TIMESTAMP,
            context VARCHAR,
            namespace VARCHAR,
            pod VARCHAR,
            deployment VARCHAR,
            container VARCHAR,
            cpu_millicores INTEGER,
            memory_mb INTEGER,
            cpu_request INTEGER,
            cpu_limit INTEGER,
            mem_request INTEGER,
            mem_limit INTEGER,
            restarts INTEGER,
            status VARCHAR
        )
    """)

    conn.execute("""
        CREATE TABLE IF NOT EXISTS raw_node_metrics (
            ts TIMESTAMP,
            context VARCHAR,
            node VARCHAR,
            cpu_pct INTEGER,
            mem_pct INTEGER,
            cpu_allocatable INTEGER,
            mem_allocatable_mb INTEGER,
            pod_count INTEGER
        )
    """)

    # --- Aggregated tables ---
    conn.execute("""
        CREATE TABLE IF NOT EXISTS hourly_pod_metrics (
            hour TIMESTAMP,
            context VARCHAR,
            namespace VARCHAR,
            deployment VARCHAR,
            pod_count INTEGER,
            cpu_avg INTEGER,
            cpu_p95 INTEGER,
            cpu_max INTEGER,
            mem_avg INTEGER,
            mem_p95 INTEGER,
            mem_max INTEGER,
            cpu_request INTEGER,
            mem_request INTEGER,
            restart_count INTEGER
        )
    """)

    conn.execute("""
        CREATE TABLE IF NOT EXISTS hourly_node_metrics (
            hour TIMESTAMP,
            context VARCHAR,
            node VARCHAR,
            cpu_avg INTEGER,
            cpu_max INTEGER,
            mem_avg INTEGER,
            mem_max INTEGER
        )
    """)

    conn.execute("""
        CREATE TABLE IF NOT EXISTS daily_summary (
            day DATE,
            context VARCHAR,
            namespace VARCHAR,
            deployment VARCHAR,
            cpu_avg INTEGER,
            cpu_p95 INTEGER,
            mem_avg INTEGER,
            mem_p95 INTEGER,
            cost_estimate_usd DOUBLE,
            pod_count_avg INTEGER,
            availability_pct DOUBLE
        )
    """)

    # --- Cost model ---
    conn.execute("""
        CREATE TABLE IF NOT EXISTS cost_model (
            name VARCHAR PRIMARY KEY,
            cpu_per_core_hour DOUBLE,
            mem_per_gb_hour DOUBLE,
            storage_per_gb_month DOUBLE,
            network_per_gb DOUBLE,
            provider VARCHAR,
            instance_type VARCHAR,
            region VARCHAR
        )
    """)

    count = conn.execute(
        "SELECT COUNT(*) FROM cost_model WHERE name='default'"
    ).fetchone()[0]
    if count == 0:
        conn.execute("""
            INSERT INTO cost_model VALUES (
                'default', 0.0425, 0.0053, 0.10, 0.09,
                'aws', 'm5.xlarge', 'us-east-1'
            )
        """)

    # --- Collection log ---
    conn.execute("""
        CREATE TABLE IF NOT EXISTS collection_log (
            ts TIMESTAMP,
            level VARCHAR,
            pods_collected INTEGER,
            nodes_collected INTEGER,
            duration_ms INTEGER
        )
    """)

    # --- Incidents ---
    conn.execute("""
        CREATE TABLE IF NOT EXISTS incidents (
            id VARCHAR PRIMARY KEY,
            title VARCHAR,
            started VARCHAR,
            ended VARCHAR,
            duration_min INTEGER,
            context VARCHAR,
            namespace VARCHAR,
            root_cause VARCHAR,
            resolution VARCHAR,
            note_count INTEGER,
            snapshot_count INTEGER
        )
    """)

    conn.execute("""
        CREATE TABLE IF NOT EXISTS incident_events (
            incident_id VARCHAR,
            ts VARCHAR,
            event VARCHAR,
            detail VARCHAR
        )
    """)

    # --- Shared tables (also created by their own modules) ---
    conn.execute("""
        CREATE TABLE IF NOT EXISTS event_log (
            ts TIMESTAMP,
            context VARCHAR,
            namespace VARCHAR,
            type VARCHAR,
            reason VARCHAR,
            object VARCHAR,
            kind VARCHAR,
            message VARCHAR,
            count INTEGER
        )
    """)

    conn.execute("""
        CREATE TABLE IF NOT EXISTS command_usage (
            ts TIMESTAMP,
            cmd VARCHAR,
            target VARCHAR
        )
    """)

    conn.execute("""
        CREATE TABLE IF NOT EXISTS audit_log (
            ts TIMESTAMP,
            context VARCHAR,
            namespace VARCHAR,
            action VARCHAR,
            target VARCHAR,
            details VARCHAR
        )
    """)

    # --- Telemetry ---
    conn.execute("""
        CREATE TABLE IF NOT EXISTS unresolved_queries (
            ts TIMESTAMP,
            query VARCHAR,
            nlp_score DOUBLE
        )
    """)

    # --- State cache tables ---
    conn.execute("""
        CREATE TABLE IF NOT EXISTS pod_state (
            context VARCHAR,
            namespace VARCHAR,
            name VARCHAR,
            status VARCHAR,
            restarts INTEGER,
            deployment VARCHAR,
            cpu_request INTEGER,
            mem_request INTEGER,
            age_seconds INTEGER,
            labels VARCHAR
        )
    """)

    conn.execute("""
        CREATE TABLE IF NOT EXISTS deployment_state (
            context VARCHAR,
            namespace VARCHAR,
            name VARCHAR,
            desired INTEGER,
            available INTEGER,
            ready INTEGER,
            image VARCHAR,
            labels VARCHAR
        )
    """)

    conn.execute("""
        CREATE TABLE IF NOT EXISTS node_state (
            context VARCHAR,
            name VARCHAR,
            ready BOOLEAN,
            cpu_allocatable INTEGER,
            mem_allocatable_mb INTEGER,
            pod_count INTEGER,
            labels VARCHAR
        )
    """)

    # --- Enriched collector tables ---
    conn.execute("""
        CREATE TABLE IF NOT EXISTS hpa_metrics (
            ts TIMESTAMP,
            context VARCHAR,
            namespace VARCHAR,
            hpa_name VARCHAR,
            target_deployment VARCHAR,
            min_replicas INTEGER,
            max_replicas INTEGER,
            current_replicas INTEGER,
            desired_replicas INTEGER,
            cpu_target_pct INTEGER,
            cpu_current_pct INTEGER,
            at_max BOOLEAN,
            scaling_up BOOLEAN
        )
    """)

    conn.execute("""
        CREATE TABLE IF NOT EXISTS oomkill_events (
            ts TIMESTAMP,
            context VARCHAR,
            namespace VARCHAR,
            pod VARCHAR,
            container VARCHAR,
            mem_limit_mb INTEGER,
            killed_at VARCHAR
        )
    """)

    conn.execute("""
        CREATE TABLE IF NOT EXISTS quota_metrics (
            ts TIMESTAMP,
            context VARCHAR,
            namespace VARCHAR,
            quota_name VARCHAR,
            resource VARCHAR,
            hard_value DOUBLE,
            used_value DOUBLE,
            used_pct DOUBLE
        )
    """)

    conn.execute("""
        CREATE TABLE IF NOT EXISTS rollout_metrics (
            ts TIMESTAMP,
            context VARCHAR,
            namespace VARCHAR,
            deployment VARCHAR,
            desired INTEGER,
            updated INTEGER,
            available INTEGER,
            unavailable INTEGER,
            state VARCHAR
        )
    """)

    # --- Chargeback tables ---
    conn.execute("""
        CREATE TABLE IF NOT EXISTS label_mapping (
            context VARCHAR,
            namespace VARCHAR,
            deployment VARCHAR,
            team VARCHAR,
            app VARCHAR,
            env VARCHAR
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

    # --- Indexes for common query patterns ---
    conn.execute("""
        CREATE INDEX IF NOT EXISTS idx_raw_pods_ts
        ON raw_pod_metrics (ts)
    """)
    conn.execute("""
        CREATE INDEX IF NOT EXISTS idx_raw_pods_deploy
        ON raw_pod_metrics (deployment, ts)
    """)
    conn.execute("""
        CREATE INDEX IF NOT EXISTS idx_hourly_pods_hour
        ON hourly_pod_metrics (hour)
    """)
    conn.execute("""
        CREATE INDEX IF NOT EXISTS idx_hourly_pods_deploy
        ON hourly_pod_metrics (deployment, hour)
    """)
    conn.execute("""
        CREATE INDEX IF NOT EXISTS idx_daily_day
        ON daily_summary (day)
    """)
    conn.execute("""
        CREATE INDEX IF NOT EXISTS idx_cmd_ts
        ON command_usage (ts)
    """)
    conn.execute("""
        CREATE INDEX IF NOT EXISTS idx_hpa_ts
        ON hpa_metrics (context, ts)
    """)
    conn.execute("""
        CREATE INDEX IF NOT EXISTS idx_event_log_ts
        ON event_log (ts)
    """)

    # --- Materialized views (pre-computed aggregates) ---
    _create_materialized_views(conn)


def _create_materialized_views(conn):
    """Create materialized views for frequently accessed aggregates."""
    # Deployment summary (last 7 days) — used by rightsizing + cost
    conn.execute("DROP VIEW IF EXISTS mv_deployment_7d")
    conn.execute("""
        CREATE VIEW mv_deployment_7d AS
        SELECT
            deployment,
            namespace,
            AVG(pod_count)::INTEGER AS avg_pods,
            AVG(cpu_avg)::INTEGER AS cpu_avg,
            MAX(cpu_p95) AS cpu_p95,
            MAX(cpu_max) AS cpu_max,
            MAX(cpu_request) AS cpu_request,
            AVG(mem_avg)::INTEGER AS mem_avg,
            MAX(mem_p95) AS mem_p95,
            MAX(mem_max) AS mem_max,
            MAX(mem_request) AS mem_request,
            SUM(restart_count) AS total_restarts,
            COUNT(*) AS sample_count
        FROM hourly_pod_metrics
        WHERE hour >= NOW() - INTERVAL '7 days'
          AND deployment != ''
        GROUP BY deployment, namespace
    """)

    # Node summary (last 24h)
    conn.execute("DROP VIEW IF EXISTS mv_nodes_24h")
    conn.execute("""
        CREATE VIEW mv_nodes_24h AS
        SELECT
            node,
            AVG(cpu_avg)::INTEGER AS cpu_avg,
            MAX(cpu_max) AS cpu_max,
            AVG(mem_avg)::INTEGER AS mem_avg,
            MAX(mem_max) AS mem_max,
            COUNT(*) AS samples
        FROM hourly_node_metrics
        WHERE hour >= NOW() - INTERVAL '24 hours'
        GROUP BY node
    """)

    # Cost summary (last 30 days)
    conn.execute("DROP VIEW IF EXISTS mv_cost_30d")
    conn.execute("""
        CREATE VIEW mv_cost_30d AS
        SELECT
            deployment,
            namespace,
            AVG(cost_estimate_usd) AS daily_cost_avg,
            SUM(cost_estimate_usd) AS total_cost,
            AVG(cpu_avg)::INTEGER AS cpu_avg,
            AVG(mem_avg)::INTEGER AS mem_avg,
            AVG(pod_count_avg)::INTEGER AS avg_pods,
            AVG(availability_pct) AS availability
        FROM daily_summary
        WHERE day >= CURRENT_DATE - INTERVAL '30 days'
        GROUP BY deployment, namespace
    """)


def refresh_materialized_views():
    """Refresh materialized views (call after aggregation)."""
    conn = get_conn()
    _create_materialized_views(conn)
    invalidate_cache()  # Clear app cache since data changed


# --- Parquet partitioning ---

def archive_to_parquet(older_than_days=90):
    """
    Export old aggregated data to partitioned Parquet files.
    Partition by: namespace/year/month
    """
    conn = get_conn()
    cutoff = datetime.utcnow() - timedelta(days=older_than_days)

    # Get distinct namespace/year/month combos to archive
    partitions = conn.execute("""
        SELECT DISTINCT
            namespace,
            EXTRACT(YEAR FROM hour)::INTEGER AS yr,
            EXTRACT(MONTH FROM hour)::INTEGER AS mo
        FROM hourly_pod_metrics
        WHERE hour < ?
    """, [cutoff]).fetchall()

    archived = 0
    for ns, yr, mo in partitions:
        partition_dir = PARQUET_DIR / f"ns={ns}" / f"year={yr}"
        partition_dir.mkdir(parents=True, exist_ok=True)
        path = partition_dir / f"month_{mo:02d}.parquet"

        conn.execute(f"""
            COPY (
                SELECT * FROM hourly_pod_metrics
                WHERE namespace = ?
                  AND EXTRACT(YEAR FROM hour) = ?
                  AND EXTRACT(MONTH FROM hour) = ?
                  AND hour < ?
            ) TO '{path}' (FORMAT PARQUET, COMPRESSION ZSTD)
        """, [ns, yr, mo, cutoff])
        archived += 1

    # Remove archived rows from DuckDB
    if archived > 0:
        conn.execute(
            "DELETE FROM hourly_pod_metrics WHERE hour < ?",
            [cutoff]
        )
        conn.execute("CHECKPOINT")

    return {"partitions_archived": archived, "cutoff": str(cutoff)}


def query_parquet(namespace=None, year=None):
    """
    Query archived Parquet files directly.
    DuckDB can read Parquet with predicate pushdown.
    """
    conn = get_conn()

    glob_pattern = str(PARQUET_DIR / "**" / "*.parquet")
    if not list(PARQUET_DIR.rglob("*.parquet")):
        return {"rows": [], "message": "No archived data"}

    filters = []
    params = []
    if namespace:
        filters.append("namespace = ?")
        params.append(namespace)
    if year:
        filters.append("EXTRACT(YEAR FROM hour) = ?")
        params.append(year)

    where = f"WHERE {' AND '.join(filters)}" if filters else ""

    sql = f"""
        SELECT
            deployment,
            namespace,
            AVG(cpu_avg)::INTEGER AS cpu_avg,
            MAX(cpu_p95) AS cpu_p95,
            AVG(mem_avg)::INTEGER AS mem_avg,
            MAX(mem_p95) AS mem_p95,
            COUNT(*) AS hours
        FROM read_parquet('{glob_pattern}', hive_partitioning=true)
        {where}
        GROUP BY deployment, namespace
        ORDER BY cpu_avg DESC
    """

    rows = conn.execute(sql, params).fetchall()
    cols = [
        "deployment", "namespace", "cpu_avg",
        "cpu_p95", "mem_avg", "mem_p95", "hours"
    ]
    return {
        "rows": [dict(zip(cols, r)) for r in rows],
        "source": "parquet_archive",
    }


def get_stats():
    """Get analytics storage stats."""
    conn = get_conn()
    raw_count = conn.execute(
        "SELECT COUNT(*) FROM raw_pod_metrics"
    ).fetchone()[0]
    hourly_count = conn.execute(
        "SELECT COUNT(*) FROM hourly_pod_metrics"
    ).fetchone()[0]
    daily_count = conn.execute(
        "SELECT COUNT(*) FROM daily_summary"
    ).fetchone()[0]

    raw_range = conn.execute(
        "SELECT MIN(ts), MAX(ts) FROM raw_pod_metrics"
    ).fetchone()
    hourly_range = conn.execute(
        "SELECT MIN(hour), MAX(hour) FROM hourly_pod_metrics"
    ).fetchone()

    # Collections today
    collections_today = conn.execute(
        "SELECT COUNT(*) FROM collection_log "
        "WHERE ts >= CURRENT_DATE"
    ).fetchone()[0]

    last_collection_row = conn.execute(
        "SELECT MAX(ts) FROM collection_log"
    ).fetchone()

    # DB file size
    db_size = MAIN_DB.stat().st_size if MAIN_DB.exists() else 0

    # Parquet archive size
    parquet_size = sum(
        f.stat().st_size for f in PARQUET_DIR.rglob("*.parquet")
    ) if PARQUET_DIR.exists() else 0

    # Cache stats
    with _cache_lock:
        cache_entries = len(_query_cache)

    total_rows = raw_count + hourly_count + daily_count
    last_collection = (
        str(last_collection_row[0])[:19]
        if last_collection_row and last_collection_row[0]
        else None
    )

    return {
        "total_rows": total_rows,
        "raw_rows": raw_count,
        "hourly_rows": hourly_count,
        "daily_rows": daily_count,
        "raw_from": str(raw_range[0]) if raw_range[0] else None,
        "raw_to": str(raw_range[1]) if raw_range[1] else None,
        "hourly_from": str(hourly_range[0]) if hourly_range[0] else None,
        "hourly_to": str(hourly_range[1]) if hourly_range[1] else None,
        "db_size_mb": round(db_size / (1024 * 1024), 2),
        "parquet_size_mb": round(parquet_size / (1024 * 1024), 2),
        "cache_entries": cache_entries,
        "collections_today": collections_today,
        "last_collection": last_collection,
        "db_path": str(MAIN_DB),
        "parquet_path": str(PARQUET_DIR),
    }
