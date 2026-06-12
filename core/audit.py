"""
Audit Log — tracks destructive operations and plan lifecycles.
"""

import json
from datetime import datetime
from pathlib import Path
from typing import Optional

from core.context import context
from core.models.audit import AuditRecord
from core.models.plan import LifecycleState

AUDIT_FILE = Path.home() / ".kubsome" / "audit.log"


def log_audit(record: AuditRecord):
    """Log a structured audit record."""
    entry = {
        "id": record.id,
        "timestamp": record.timestamp.isoformat(),
        "user": record.user,
        "action": record.action_type,
        "target": record.target,
        "plan_id": record.plan_id,
        "state": record.state.value if record.state else None,
        "details": record.details,
        "result": record.result,
        "context": context.current_context,
        "namespace": context.namespace,
    }

    if _log_to_db(entry):
        return

    AUDIT_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(AUDIT_FILE, "a") as f:
        f.write(json.dumps(entry) + "\n")


def log_plan_transition(plan_id: str, action_type: str, target: str, state: LifecycleState, details: str = ""):
    """Convenience helper to log a plan state transition."""
    record = AuditRecord(
        id=f"evt_{datetime.now().timestamp()}",
        timestamp=datetime.now(),
        user="system", # TODO: Get actual user
        action_type=action_type,
        target=target,
        plan_id=plan_id,
        state=state,
        details=details
    )
    log_audit(record)


def log_action(action, target, details=""):
    """Legacy helper for simple action logging."""
    record = AuditRecord(
        id=f"legacy_{datetime.now().timestamp()}",
        timestamp=datetime.now(),
        user="system",
        action_type=action,
        target=target,
        details=details
    )
    log_audit(record)


def get_audit_log(limit=20, action=None, target=None, days=None):
    """Read audit entries."""
    result = _read_from_db(limit, action, target, days)
    if result is not None:
        return result

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

    if action:
        entries = [e for e in entries if e.get("action") == action]
    if target:
        entries = [e for e in entries if target in e.get("target", "")]

    return entries[-limit:]


def _log_to_db(entry):
    """Write audit entry to DuckDB."""
    try:
        from core.analytics.engine import get_conn
        conn = get_conn()
    except (ImportError, Exception):
        return False

    _ensure_table(conn)
    conn.execute(
        "INSERT INTO audit_log (ts, context, namespace, action, target, details, plan_id, state, result) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [
            datetime.fromisoformat(entry["timestamp"]),
            entry.get("context", ""),
            entry.get("namespace", ""),
            entry["action"],
            entry["target"],
            str(entry.get("details", "")),
            entry.get("plan_id"),
            entry.get("state"),
            entry.get("result"),
        ]
    )
    return True


def _read_from_db(limit, action=None, target=None, days=None):
    """Read audit entries from DuckDB."""
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
        from core.analytics.engine import PARAM_INTERVAL_DAYS
        filters.append(f"ts >= NOW() - {PARAM_INTERVAL_DAYS(days)}")

    where = f"WHERE {' AND '.join(filters)}" if filters else ""

    rows = conn.execute(f"""
        SELECT ts, context, namespace, action, target, details, plan_id, state, result
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
            "plan_id": r[6],
            "state": r[7],
            "result": r[8],
        }
        for r in rows
    ]


_table_created = False


def _ensure_table(conn):
    """Create audit_log table with new columns if not exists."""
    global _table_created
    if _table_created:
        return

    # Check if columns exist (for migration)
    columns = conn.execute("PRAGMA table_info('audit_log')").fetchall()
    if not columns:
        conn.execute("""
            CREATE TABLE audit_log (
                ts TIMESTAMP,
                context VARCHAR,
                namespace VARCHAR,
                action VARCHAR,
                target VARCHAR,
                details VARCHAR,
                plan_id VARCHAR,
                state VARCHAR,
                result VARCHAR
            )
        """)
    else:
        # Migration: Add missing columns if they don't exist
        existing_names = [c[1] for c in columns]
        if "plan_id" not in existing_names:
            conn.execute("ALTER TABLE audit_log ADD COLUMN plan_id VARCHAR")
        if "state" not in existing_names:
            conn.execute("ALTER TABLE audit_log ADD COLUMN state VARCHAR")
        if "result" not in existing_names:
            conn.execute("ALTER TABLE audit_log ADD COLUMN result VARCHAR")

    conn.execute("CREATE INDEX IF NOT EXISTS idx_audit_ts ON audit_log (ts)")
    _table_created = True
