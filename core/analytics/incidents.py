"""
Incident DB — persistent incident storage in DuckDB.
Enables cross-incident search, MTTR metrics, and pattern detection.
Supplements the file-based manager (doesn't replace it).
"""

from datetime import datetime

_table_created = False


def log_incident_to_db(incident):
    """Store incident summary in DuckDB for analytics."""
    try:
        from core.analytics.engine import get_conn
        conn = get_conn()
    except (ImportError, Exception):
        return False

    _ensure_tables(conn)

    started = incident.get("started", "")
    ended = incident.get("ended", "")

    # Calculate duration
    duration_min = 0
    if started and ended:
        try:
            s = datetime.fromisoformat(started)
            e = datetime.fromisoformat(ended)
            duration_min = int((e - s).total_seconds() / 60)
        except Exception:
            pass

    conn.execute(
        "INSERT INTO incidents VALUES (?,?,?,?,?,?,?,?,?,?,?)",
        [
            incident.get("id", ""),
            incident.get("title", ""),
            started,
            ended or None,
            duration_min,
            incident.get("context", ""),
            incident.get("namespace", ""),
            incident.get("root_cause", ""),
            incident.get("resolution", ""),
            len(incident.get("notes", [])),
            len(incident.get("snapshots", [])),
        ]
    )

    # Store timeline events
    for event in incident.get("timeline", []):
        conn.execute(
            "INSERT INTO incident_events VALUES (?,?,?,?)",
            [
                incident["id"],
                event.get("time", ""),
                event.get("event", ""),
                event.get("detail", ""),
            ]
        )

    return True


def search_incidents(query=None, days=90, limit=20):
    """Search past incidents by title, root cause, or notes."""
    try:
        from core.analytics.engine import get_conn
        conn = get_conn()
    except (ImportError, Exception):
        return None

    _ensure_tables(conn)

    params = [days]
    filters = ["started::TIMESTAMP >= NOW() - INTERVAL (?) DAY"]
    if query:
        q = f"%{query}%"
        filters.append(
            "(title LIKE ? OR root_cause LIKE ? OR resolution LIKE ?)"
        )
        params.extend([q, q, q])

    where = " AND ".join(filters)

    params.append(limit)
    rows = conn.execute(f"""
        SELECT id, title, started, ended, duration_min,
               context, namespace, root_cause, resolution
        FROM incidents
        WHERE {where}
        ORDER BY started DESC
        LIMIT ?
    """, params).fetchall()

    cols = [
        "id", "title", "started", "ended", "duration_min",
        "context", "namespace", "root_cause", "resolution",
    ]
    return [dict(zip(cols, row)) for row in rows]


def incident_metrics(days=90):
    """
    Incident metrics: MTTR, frequency, top causes.
    """
    try:
        from core.analytics.engine import get_conn
        conn = get_conn()
    except (ImportError, Exception):
        return None

    _ensure_tables(conn)

    row = conn.execute("""
        SELECT
            COUNT(*) AS total,
            AVG(duration_min)::INTEGER AS avg_mttr_min,
            MAX(duration_min) AS max_duration_min,
            MIN(duration_min) AS min_duration_min
        FROM incidents
        WHERE started::TIMESTAMP >= NOW() - INTERVAL (?) DAY
          AND duration_min > 0
    """, [days]).fetchone()

    top_causes = conn.execute("""
        SELECT root_cause, COUNT(*) AS count
        FROM incidents
        WHERE started::TIMESTAMP >= NOW() - INTERVAL (?) DAY
          AND root_cause != ''
        GROUP BY root_cause
        ORDER BY count DESC
        LIMIT 5
    """, [days]).fetchall()

    return {
        "total_incidents": row[0] if row else 0,
        "avg_mttr_minutes": row[1] if row else 0,
        "max_duration_minutes": row[2] if row else 0,
        "min_duration_minutes": row[3] if row else 0,
        "top_root_causes": [
            {"cause": r[0], "count": r[1]} for r in top_causes
        ],
    }


def _ensure_tables(conn):
    """Create incident tables."""
    global _table_created
    if _table_created:
        return

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

    conn.execute("""
        CREATE INDEX IF NOT EXISTS idx_incidents_started
        ON incidents (started)
    """)

    _table_created = True
