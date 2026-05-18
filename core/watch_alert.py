"""
Watch & Alert — background condition monitoring with
notifications, recovery detection, and alert history.
"""

import threading
import time
from datetime import datetime, timezone

from core.collectors.pods import collect_pods
from core.notify import notify_if_critical


class WatchAlert:
    """Background monitor that checks conditions and fires alerts."""

    def __init__(self):
        self.watches = []
        self._running = False
        self._thread = None
        self._history = []  # Global alert history

    def add(self, name, condition, interval=30, muted=False):
        """
        Add a watch condition.
        condition: callable that returns (triggered: bool, message: str)
        """
        # Prevent duplicates
        self.remove(name)
        self.watches.append({
            "name": name,
            "condition": condition,
            "interval": interval,
            "last_check": None,
            "triggered": False,
            "muted": muted,
            "alerts": [],
            "created_at": datetime.now(timezone.utc).isoformat(),
            "check_count": 0,
            "last_message": "",
        })

    def remove(self, name):
        """Remove a watch by name."""
        self.watches = [
            w for w in self.watches if w["name"] != name
        ]

    def mute(self, name):
        """Mute a watch (still checks, no notifications)."""
        for w in self.watches:
            if w["name"] == name:
                w["muted"] = True
                return True
        return False

    def unmute(self, name):
        """Unmute a watch."""
        for w in self.watches:
            if w["name"] == name:
                w["muted"] = False
                return True
        return False

    def clear_all(self):
        """Remove all watches."""
        self.watches.clear()

    def start(self):
        if self._running:
            return
        self._running = True
        self._thread = threading.Thread(
            target=self._loop, daemon=True
        )
        self._thread.start()

    def stop(self):
        self._running = False

    def status(self):
        return {
            "running": self._running,
            "watches": [
                {
                    "name": w["name"],
                    "triggered": w["triggered"],
                    "muted": w["muted"],
                    "last_check": w["last_check"],
                    "alert_count": len(w["alerts"]),
                    "check_count": w["check_count"],
                    "interval": w["interval"],
                    "last_message": w["last_message"],
                    "created_at": w["created_at"],
                }
                for w in self.watches
            ],
        }

    def history(self, limit=20):
        """Return recent alert history across all watches."""
        return self._history[-limit:]

    def _loop(self):
        while self._running:
            now = time.time()
            for watch in self.watches:
                if (
                    watch["last_check"] is None
                    or now - watch["last_check"]
                    >= watch["interval"]
                ):
                    self._check(watch)
                    watch["last_check"] = now
            time.sleep(5)

    def _check(self, watch):
        try:
            triggered, message = watch["condition"]()
            watch["check_count"] += 1
            watch["last_message"] = message if triggered else ""

            if triggered and not watch["triggered"]:
                # New alert
                watch["triggered"] = True
                alert_entry = {
                    "time": datetime.now(timezone.utc).isoformat(),
                    "watch": watch["name"],
                    "message": message,
                    "type": "triggered",
                }
                watch["alerts"].append(alert_entry)
                self._history.append(alert_entry)

                if not watch["muted"]:
                    notify_if_critical(
                        f"🔔 {watch['name']}: {message}"
                    )

            elif not triggered and watch["triggered"]:
                # Recovery
                watch["triggered"] = False
                recovery_entry = {
                    "time": datetime.now(timezone.utc).isoformat(),
                    "watch": watch["name"],
                    "message": "Recovered",
                    "type": "recovered",
                }
                watch["alerts"].append(recovery_entry)
                self._history.append(recovery_entry)

                if not watch["muted"]:
                    notify_if_critical(
                        f"✅ {watch['name']}: Recovered"
                    )

        except Exception:
            pass


# Singleton instance
_watcher = WatchAlert()


def get_watcher():
    return _watcher


# ─── Condition Factories ───


def pod_crash_condition(pod_pattern):
    """Alert when a pod matching pattern enters CrashLoopBackOff or Error."""
    def check():
        pods = collect_pods()
        matching = [
            p for p in pods
            if pod_pattern.lower() in p["name"].lower()
        ]
        crashing = [
            p for p in matching
            if p["status"] in ("CrashLoopBackOff", "Error", "Failed")
        ]
        if crashing:
            names = ", ".join(p["name"] for p in crashing[:3])
            return True, f"Crashing: {names}"
        return False, ""
    return check


def pod_restart_condition(pod_pattern, threshold=5):
    """Alert when restarts exceed threshold."""
    def check():
        pods = collect_pods()
        matching = [
            p for p in pods
            if pod_pattern.lower() in p["name"].lower()
        ]
        high = [
            p for p in matching
            if p["restarts"] >= threshold
        ]
        if high:
            worst = max(high, key=lambda p: p["restarts"])
            return (
                True,
                f"{worst['name']} has {worst['restarts']} restarts "
                f"(threshold: {threshold})"
            )
        return False, ""
    return check


def pod_count_condition(pod_pattern, min_count=1):
    """Alert when running pod count drops below minimum."""
    def check():
        pods = collect_pods()
        matching = [
            p for p in pods
            if pod_pattern.lower() in p["name"].lower()
            and p["status"] == "Running"
        ]
        if len(matching) < min_count:
            return (
                True,
                f"Only {len(matching)} running "
                f"(expected >= {min_count})"
            )
        return False, ""
    return check


def pod_oom_condition(pod_pattern):
    """Alert when a pod is OOMKilled."""
    def check():
        pods = collect_pods()
        matching = [
            p for p in pods
            if pod_pattern.lower() in p["name"].lower()
        ]
        oom = [
            p for p in matching
            if "OOMKilled" in p.get("status", "")
            or p.get("last_state", "") == "OOMKilled"
        ]
        if oom:
            return True, f"OOMKilled: {oom[0]['name']}"
        return False, ""
    return check


def pod_pending_condition(pod_pattern, max_seconds=120):
    """Alert when a pod stays Pending longer than max_seconds."""
    _first_seen = {}

    def check():
        pods = collect_pods()
        matching = [
            p for p in pods
            if pod_pattern.lower() in p["name"].lower()
            and p["status"] == "Pending"
        ]
        now = time.time()

        for p in matching:
            name = p["name"]
            if name not in _first_seen:
                _first_seen[name] = now
            elif now - _first_seen[name] >= max_seconds:
                return (
                    True,
                    f"{name} pending for "
                    f"{int(now - _first_seen[name])}s"
                )

        # Clean up resolved pods
        pending_names = {p["name"] for p in matching}
        for name in list(_first_seen.keys()):
            if name not in pending_names:
                del _first_seen[name]

        return False, ""
    return check


def pod_ready_condition(pod_pattern, min_ready=1):
    """Alert when fewer than min_ready pods are in Ready state."""
    def check():
        pods = collect_pods()
        matching = [
            p for p in pods
            if pod_pattern.lower() in p["name"].lower()
        ]
        ready = [
            p for p in matching
            if p["status"] == "Running" and p["restarts"] < 5
        ]
        if len(ready) < min_ready:
            return (
                True,
                f"Only {len(ready)} ready "
                f"(need >= {min_ready})"
            )
        return False, ""
    return check
