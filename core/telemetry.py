"""
Telemetry — local-only usage analytics.

Tracks command frequency and unresolved NLP queries
to improve intent coverage. All data stays on disk
at ~/.kubsome/telemetry/. No network calls.

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


def is_enabled():
    """Check if telemetry is opted-in."""
    config = load_config()
    return config.get("telemetry", False)


def track_command(cmd_type, target=None):
    """Record a command execution."""
    if not is_enabled():
        return

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
    {top_commands, total_commands, unresolved_count, unresolved_top}
    """
    commands = _read(COMMANDS_FILE)
    unresolved = _read(UNRESOLVED_FILE)

    # Count command frequency
    cmd_counts = {}
    for entry in commands:
        cmd = entry.get("cmd", "unknown")
        cmd_counts[cmd] = cmd_counts.get(cmd, 0) + 1

    top_commands = sorted(
        cmd_counts.items(), key=lambda x: -x[1]
    )[:15]

    # Count unresolved query patterns
    unresolved_counts = {}
    for entry in unresolved:
        q = entry.get("query", "")
        # Normalize: first 2 words
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


def _days_tracked(entries):
    """Count unique days in entries."""
    days = set()
    for e in entries:
        d = e.get("date")
        if d:
            days.add(d)
    return len(days)


def _ensure_dir():
    TELEMETRY_DIR.mkdir(parents=True, exist_ok=True)


def _append(path, entry):
    """Append a JSON line, prune if over limit."""
    with open(path, "a") as f:
        f.write(json.dumps(entry) + "\n")

    # Prune periodically (check file size)
    try:
        lines = path.read_text().strip().split("\n")
        if len(lines) > MAX_ENTRIES:
            # Keep last MAX_ENTRIES
            keep = lines[-MAX_ENTRIES:]
            path.write_text("\n".join(keep) + "\n")
    except Exception:
        pass


def _read(path):
    """Read all entries from a JSONL file."""
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
