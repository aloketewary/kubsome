"""
Telemetry — local-only usage analytics.

Tracks command frequency and unresolved NLP queries
to improve intent coverage. All data stays local.
Uses DuckDB for queryable analytics (falls back to JSONL).

Opt-in via config:
  telemetry: true
"""

import json
import time
from pathlib import Path
from datetime import datetime

from core.config import load_config

TELEMETRY_DIR = Path.home() / ".kubsome" / "telemetry"
COMMANDS_FILE = TELEMETRY_DIR / "commands.jsonl"
UNRESOLVED_FILE = TELEMETRY_DIR / "unresolved.jsonl"
MAX_ENTRIES = 5000

_table_created = False


def is_enabled():
    """Check if telemetry is opted-in."""
    config = load_config()
    return config.get("telemetry", False)


def track_command(cmd_type, target=None):
    """Record a command execution."""
    if not is_enabled():
        return

    if _track_to_db(cmd_type, target):
        return

    # Fallback
    _ensure_dir()
    entry = {
        "ts": time.time(),
        "cmd": cmd_type,
        "target": target,
        "date": datetime.now().strftime("%Y-%m-%d"),
    }
    _append(COMMANDS_FILE, entry)


def track_unresolved(user_input, nlp_score=None):
    """Record an unresolved query (NLP miss)."""
    if not is_enabled():
        return

    if _track_unresolved_to_db(user_input, nlp_score):
        return

    # Fallback
    _ensure_dir()
    entry = {
        "ts": time.time(),
        "query": user_input[:200],
        "nlp_score": nlp_score,
        "date": datetime.now().strftime("%Y-%m-%d"),
    }
    _append(UNRESOLVED_FILE, entry)


def get_stats():
    """
    Return usage statistics.
    {top_commands, total_commands, unresolved_count, top_unresolved}
    """
    # Try DuckDB
    result = _stats_from_db()
    if result:
        return result

    # Fallback to flat files
    commands = _read(COMMANDS_FILE)
    unresolved = _read(UNRESOLVED_FILE)

    cmd_counts = {}
    for entry in commands:
        cmd = entry.get("cmd", "unknown")
        cmd_counts[cmd] = cmd_counts.get(cmd, 0) + 1

    top_commands = sorted(
        cmd_counts.items(), key=lambda x: -x[1]
    )[:15]

    unresolved_counts = {}
    for entry in unresolved:
        q = entry.get("query", "")
        key = " ".join(q.split()[:3]).lower()
        unresolved_counts[key] = (
            unresolved_counts.get(key, 0) + 1
        )

    top_unresolved = sorted(
        unresolved_counts.items(), key=lambda x: -x[1]
    )[:10]

    return {
        "total_commands": len(commands),
        "top_commands": top_commands,
        "unresolved_count": len(unresolved),
        "top_unresolved": top_unresolved,
        "days_tracked": _days_tracked(commands),
    }


def command_frequency(days=7, cmd_type=None):
    """
    Command frequency over time. DuckDB only.
    Returns daily counts for charting.
    """
    try:
        from core.analytics.engine import get_conn
        conn = get_conn()
    except (ImportError, Exception):
        return None

    _ensure_tables(conn)

    cmd_filter = f"AND cmd = '{cmd_type}'" if cmd_type else ""

    rows = conn.execute(f"""
        SELECT
            ts::DATE AS day,
            cmd,
            COUNT(*) AS count
        FROM command_usage
        WHERE ts >= NOW() - INTERVAL '{days} days'
          {cmd_filter}
        GROUP BY day, cmd
        ORDER BY day, count DESC
    """).fetchall()

    return [
        {"day": str(r[0]), "cmd": r[1], "count": r[2]}
        for r in rows
    ]


def peak_usage_hours():
    """Find peak usage hours. DuckDB only."""
    try:
        from core.analytics.engine import get_conn
        conn = get_conn()
    except (ImportError, Exception):
        return None

    _ensure_tables(conn)

    rows = conn.execute("""
        SELECT
            EXTRACT(HOUR FROM ts)::INTEGER AS hour,
            COUNT(*) AS count
        FROM command_usage
        GROUP BY hour
        ORDER BY count DESC
    """).fetchall()

    return [{"hour": r[0], "count": r[1]} for r in rows]


# --- DuckDB implementation ---

def _track_to_db(cmd_type, target):
    """Write command to DuckDB. Returns True on success."""
    try:
        from core.analytics.engine import get_conn
        conn = get_conn()
    except (ImportError, Exception):
        return False

    _ensure_tables(conn)
    conn.execute(
        "INSERT INTO command_usage VALUES (?, ?, ?)",
        [datetime.now(), cmd_type, target or ""]
    )
    return True


def _track_unresolved_to_db(user_input, nlp_score):
    """Write unresolved query to DuckDB."""
    try:
        from core.analytics.engine import get_conn
        conn = get_conn()
    except (ImportError, Exception):
        return False

    _ensure_tables(conn)
    conn.execute(
        "INSERT INTO unresolved_queries VALUES (?, ?, ?)",
        [datetime.now(), user_input[:200], nlp_score]
    )
    return True


def _stats_from_db():
    """Get stats from DuckDB."""
    try:
        from core.analytics.engine import get_conn
        conn = get_conn()
    except (ImportError, Exception):
        return None

    _ensure_tables(conn)

    # Check if we have data
    total = conn.execute(
        "SELECT COUNT(*) FROM command_usage"
    ).fetchone()[0]
    if total == 0:
        return None

    top_commands = conn.execute("""
        SELECT cmd, COUNT(*) AS count
        FROM command_usage
        GROUP BY cmd
        ORDER BY count DESC
        LIMIT 15
    """).fetchall()

    unresolved_count = conn.execute(
        "SELECT COUNT(*) FROM unresolved_queries"
    ).fetchone()[0]

    top_unresolved = conn.execute("""
        SELECT query, COUNT(*) AS count
        FROM unresolved_queries
        GROUP BY query
        ORDER BY count DESC
        LIMIT 10
    """).fetchall()

    days = conn.execute("""
        SELECT COUNT(DISTINCT ts::DATE) FROM command_usage
    """).fetchone()[0]

    return {
        "total_commands": total,
        "top_commands": [(r[0], r[1]) for r in top_commands],
        "unresolved_count": unresolved_count,
        "top_unresolved": [(r[0], r[1]) for r in top_unresolved],
        "days_tracked": days,
    }


def _ensure_tables(conn):
    """Create telemetry tables if not exists."""
    global _table_created
    if _table_created:
        return
    conn.execute("""
        CREATE TABLE IF NOT EXISTS command_usage (
            ts TIMESTAMP,
            cmd VARCHAR,
            target VARCHAR
        )
    """)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS unresolved_queries (
            ts TIMESTAMP,
            query VARCHAR,
            nlp_score DOUBLE
        )
    """)
    conn.execute("""
        CREATE INDEX IF NOT EXISTS idx_cmd_ts
        ON command_usage (ts)
    """)
    conn.execute("""
        CREATE INDEX IF NOT EXISTS idx_cmd_cmd
        ON command_usage (cmd)
    """)
    _table_created = True


# --- Flat file fallback ---

def _days_tracked(entries):
    days = set()
    for e in entries:
        d = e.get("date")
        if d:
            days.add(d)
    return len(days)


def _ensure_dir():
    TELEMETRY_DIR.mkdir(parents=True, exist_ok=True)


def _append(path, entry):
    with open(path, "a") as f:
        f.write(json.dumps(entry) + "\n")
    try:
        lines = path.read_text().strip().split("\n")
        if len(lines) > MAX_ENTRIES:
            keep = lines[-MAX_ENTRIES:]
            path.write_text("\n".join(keep) + "\n")
    except Exception:
        pass


def _read(path):
    if not path.exists():
        return []
    entries = []
    try:
        for line in path.read_text().strip().split("\n"):
            if line:
                entries.append(json.loads(line))
    except Exception:
        pass
    return entries
