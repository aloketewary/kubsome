"""
Audit Log — tracks destructive operations for compliance.
Stored in ~/.kubsome/audit.log
"""

import json
from datetime import datetime
from pathlib import Path

from core.context import context

AUDIT_FILE = Path.home() / ".kubsome" / "audit.log"


def log_action(action, target, details=""):
    """Log a destructive action."""
    AUDIT_FILE.parent.mkdir(parents=True, exist_ok=True)

    entry = {
        "timestamp": datetime.now().isoformat(),
        "context": context.current_context,
        "namespace": context.namespace,
        "action": action,
        "target": target,
        "details": details,
    }

    with open(AUDIT_FILE, "a") as f:
        f.write(json.dumps(entry) + "\n")


def get_audit_log(limit=20):
    """Read recent audit entries."""
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

    return entries[-limit:]
