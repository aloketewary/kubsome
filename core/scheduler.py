"""
Scheduler — cron-like recurring command execution.

Schedules stored in ~/.kubsome/schedules.yaml:
  - name: daily-health
    cron: "0 8 * * *"
    commands:
      - scorecard
      - export
    notify: true

Runs in background thread during CLI session.
"""

import time
import threading
import yaml
from pathlib import Path
from datetime import datetime

from core.config import load_config


SCHEDULES_FILE = Path.home() / ".kubsome" / "schedules.yaml"

_scheduler = None


class Scheduler:
    """Background scheduler for recurring commands."""

    def __init__(self):
        self.schedules = []
        self._running = False
        self._thread = None
        self._load()

    def _load(self):
        """Load schedules from file."""
        if not SCHEDULES_FILE.exists():
            return

        try:
            with open(SCHEDULES_FILE, "r") as f:
                data = yaml.safe_load(f) or []
            self.schedules = data if isinstance(data, list) else []
        except Exception:
            self.schedules = []

    def save(self):
        """Persist schedules to file."""
        SCHEDULES_FILE.parent.mkdir(parents=True, exist_ok=True)
        with open(SCHEDULES_FILE, "w") as f:
            yaml.dump(
                self.schedules, f, default_flow_style=False
            )

    def add(self, name, cron_expr, commands, notify=False):
        """Add a new schedule."""
        self.schedules.append({
            "name": name,
            "cron": cron_expr,
            "commands": commands,
            "notify": notify,
            "last_run": None,
        })
        self.save()

    def remove(self, name):
        """Remove a schedule by name."""
        self.schedules = [
            s for s in self.schedules if s["name"] != name
        ]
        self.save()

    def list_schedules(self):
        """Return all schedules with status."""
        return [
            {
                "name": s["name"],
                "cron": s["cron"],
                "commands": s["commands"],
                "notify": s.get("notify", False),
                "last_run": s.get("last_run"),
                "next_run": _next_run_label(s["cron"]),
            }
            for s in self.schedules
        ]

    def start(self):
        """Start background scheduler thread."""
        if self._running or not self.schedules:
            return
        self._running = True
        self._thread = threading.Thread(
            target=self._loop, daemon=True
        )
        self._thread.start()

    def stop(self):
        self._running = False

    def _loop(self):
        """Check schedules every 60s."""
        while self._running:
            now = datetime.now()
            for schedule in self.schedules:
                if _should_run(schedule["cron"], now, schedule.get("last_run")):
                    self._execute(schedule, now)
            time.sleep(60)

    def _execute(self, schedule, now):
        """Run scheduled commands."""
        try:
            from core.commands import resolve_command
            from core.dispatcher import dispatch

            for cmd_str in schedule["commands"]:
                command = resolve_command(cmd_str)
                if command and not isinstance(command, str):
                    dispatch(command)

            schedule["last_run"] = now.isoformat()
            self.save()

            if schedule.get("notify"):
                from core.notify import notify
                notify(
                    "Schedule Complete",
                    f"{schedule['name']}: {len(schedule['commands'])} commands"
                )
        except Exception:
            pass


def get_scheduler():
    """Get singleton scheduler instance."""
    global _scheduler
    if _scheduler is None:
        _scheduler = Scheduler()
    return _scheduler


def _should_run(cron_expr, now, last_run):
    """
    Simple cron check. Supports:
    - "0 8 * * *" (hour 8, any day)
    - "*/30 * * * *" (every 30 min)
    - "0 */6 * * *" (every 6 hours)
    """
    if last_run:
        try:
            last = datetime.fromisoformat(last_run)
            # Don't run more than once per minute
            if (now - last).total_seconds() < 60:
                return False
        except Exception:
            pass

    parts = cron_expr.strip().split()
    if len(parts) != 5:
        return False

    minute, hour, dom, month, dow = parts

    if not _match_field(minute, now.minute):
        return False
    if not _match_field(hour, now.hour):
        return False
    if not _match_field(dom, now.day):
        return False
    if not _match_field(month, now.month):
        return False
    if not _match_field(dow, now.weekday()):
        return False

    return True


def _match_field(field, value):
    """Match a single cron field against a value."""
    if field == "*":
        return True

    # */N — every N
    if field.startswith("*/"):
        try:
            step = int(field[2:])
            return value % step == 0
        except ValueError:
            return False

    # Exact match
    try:
        return int(field) == value
    except ValueError:
        return False


def _next_run_label(cron_expr):
    """Human-readable next run estimate."""
    parts = cron_expr.strip().split()
    if len(parts) != 5:
        return "invalid"

    minute, hour, _, _, _ = parts

    if minute.startswith("*/"):
        return f"every {minute[2:]}min"
    if hour.startswith("*/"):
        return f"every {hour[2:]}h"
    if hour != "*" and minute != "*":
        return f"daily at {hour}:{minute.zfill(2)}"
    return cron_expr
