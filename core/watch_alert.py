"""
Watch & Alert — monitor conditions in background
and trigger notifications when thresholds are met.
"""

import threading
import time
from datetime import datetime

from core.collectors.pods import collect_pods
from core.notify import notify_if_critical


class WatchAlert:
    """Background monitor that checks conditions."""

    def __init__(self):
        self.watches = []
        self._running = False
        self._thread = None

    def add(self, name, condition, interval=30):
        """
        Add a watch condition.
        condition: callable that returns (triggered, message)
        """
        self.watches.append({
            "name": name,
            "condition": condition,
            "interval": interval,
            "last_check": None,
            "triggered": False,
            "alerts": [],
        })

    def remove(self, name):
        self.watches = [
            w for w in self.watches
            if w["name"] != name
        ]

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
                    "last_check": w["last_check"],
                    "alert_count": len(w["alerts"]),
                }
                for w in self.watches
            ],
        }

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
            if triggered and not watch["triggered"]:
                watch["triggered"] = True
                watch["alerts"].append({
                    "time": datetime.now().isoformat(),
                    "message": message,
                })
                notify_if_critical(
                    f"[Watch] {watch['name']}: {message}"
                )
            elif not triggered:
                watch["triggered"] = False
        except Exception:
            pass


# Singleton instance
_watcher = WatchAlert()


def get_watcher():
    return _watcher


# Pre-built condition factories

def pod_crash_condition(pod_pattern):
    """Alert when a pod matching pattern crashes."""
    def check():
        pods = collect_pods()
        matching = [
            p for p in pods
            if pod_pattern in p["name"].lower()
        ]
        crashing = [
            p for p in matching
            if p["status"] in (
                "CrashLoopBackOff", "Error"
            )
        ]
        if crashing:
            names = ", ".join(
                p["name"] for p in crashing[:3]
            )
            return True, f"Crashing: {names}"
        return False, ""
    return check


def pod_restart_condition(pod_pattern, threshold=5):
    """Alert when restarts exceed threshold."""
    def check():
        pods = collect_pods()
        matching = [
            p for p in pods
            if pod_pattern in p["name"].lower()
        ]
        high = [
            p for p in matching
            if p["restarts"] >= threshold
        ]
        if high:
            return (
                True,
                f"{high[0]['name']} has "
                f"{high[0]['restarts']} restarts"
            )
        return False, ""
    return check


def pod_count_condition(pod_pattern, min_count=1):
    """Alert when pod count drops below minimum."""
    def check():
        pods = collect_pods()
        matching = [
            p for p in pods
            if pod_pattern in p["name"].lower()
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
