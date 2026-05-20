"""
Audit Log — tracks destructive operations for compliance.
Stored in DuckDB (falls back to flat file if unavailable).
"""

import json
from datetime import datetime
from pathlib import Path

from core.context import context

AUDIT_FILE = Path.home() / ".kubsome" / "audit.log"


def log_action(action, target, details=""):
    """Log a destructive action."""
    entry = {
        "timestamp": datetime.now().isoformat(),
        "context": context.current_context,
        "namespace": context.namespace,
        "action": action,
        "target": target,
        "details": details,
    }

    # Try DuckDB first
    if _log_to_db(entry):
        return

    # Fallback to flat file
    AUDIT_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(AUDIT_FILE, "a") as f:
        f.write(json.dumps(entry) + "\n")


def get_audit_log(limit=20, action=None, target=None, days=None):
    """
    Read audit entries. Supports filtering by action, target, days.
    """
    # Try DuckDB first
    result = _read_from_db(limit, action, target, days)
    if result is not None:
        return result

    # Fallback to flat file
    if not AUDIT_FILE.exists():
        return []

    entries = []
    with open(AUDIT_FILE, "r") as f:
        for line in f:
            line = line.strip()
            if line:
                try:
                    entries.append(json.loads(line))
                except json.JSONDecodeError:
                    pass

    # Apply filters on flat file
    if action:
        entries = [e for e in entries if e.get("action") == action]
    if target:
        entries = [
            e for e in entries
            if target in e.get("target", "")
        ]

    return entries[-limit:]


def audit_stats(days=30):
    """
    Audit statistics — action frequency, top targets, timeline.
    Only available with DuckDB.
    """
    try:
        from core.analytics.engine import get_conn
        conn = get_conn()
    except (ImportError, Exception):
        return None

    _ensure_table(conn)

    rows = conn.execute(f"""
        SELECT
            action,
            COUNT(*) AS count,
            COUNT(DISTINCT target) AS unique_targets
        FROM audit_log
        WHERE ts >= NOW() - INTERVAL '{days} days'
        GROUP BY action
        ORDER BY count DESC
    """).fetchall()

    top_targets = conn.execute(f"""
        SELECT target, action, COUNT(*) AS count
        FROM audit_log
        WHERE ts >= NOW() - INTERVAL '{days} days'
        GROUP BY target, action
        ORDER BY count DESC
        LIMIT 10
    """).fetchall()

    total = conn.execute(f"""
        SELECT COUNT(*) FROM audit_log
        WHERE ts >= NOW() - INTERVAL '{days} days'
    """).fetchone()[0]

    return {
        "total_actions": total,
        "by_action": [
            {"action": r[0], "count": r[1], "targets": r[2]}
            for r in rows
        ],
        "top_targets": [
            {"target": r[0], "action": r[1], "count": r[2]}
            for r in top_targets
        ],
    }


def _log_to_db(entry):
    """Write audit entry to DuckDB. Returns True on success."""
    try:
        from core.analytics.engine import get_conn
        conn = get_conn()
    except (ImportError, Exception):
        return False

    _ensure_table(conn)
    conn.execute(
        "INSERT INTO audit_log VALUES (?, ?, ?, ?, ?, ?)",
        [
            datetime.fromisoformat(entry["timestamp"]),
            entry.get("context", ""),
            entry.get("namespace", ""),
            entry["action"],
            entry["target"],
            entry.get("details", ""),
        ]
    )
    return True


def _read_from_db(limit, action=None, target=None, days=None):
    """Read audit entries from DuckDB. Returns None if unavailable."""
    try:
        from core.analytics.engine import get_conn
        conn = get_conn()
    except (ImportError, Exception):
        return None

    _ensure_table(conn)

    filters = []
    if action:
        filters.append(f"action = '{action}'")
    if target:
        filters.append(f"target LIKE '%{target}%'")
    if days:
        filters.append(f"ts >= NOW() - INTERVAL '{days} days'")

    where = f"WHERE {' AND '.join(filters)}" if filters else ""

    rows = conn.execute(f"""
        SELECT ts, context, namespace, action, target, details
        FROM audit_log
        {where}
        ORDER BY ts DESC
        LIMIT {limit}
    """).fetchall()

    return [
        {
            "timestamp": str(r[0]),
            "context": r[1],
            "namespace": r[2],
            "action": r[3],
            "target": r[4],
            "details": r[5],
        }
        for r in rows
    ]


_table_created = False


def _ensure_table(conn):
    """Create audit_log table if not exists."""
    global _table_created
    if _table_created:
        return
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
    conn.execute("""
        CREATE INDEX IF NOT EXISTS idx_audit_ts
        ON audit_log (ts)
    """)
    conn.execute("""
        CREATE INDEX IF NOT EXISTS idx_audit_action
        ON audit_log (action, ts)
    """)
    _table_created = True
