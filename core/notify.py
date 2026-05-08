"""
Notifications — desktop alerts for critical events.
Uses osascript on macOS (no dependencies).

Configure in ~/.kubsome/config.yaml:
  notifications: true
"""

import subprocess
import platform


def notify(title, message):
    """Send a desktop notification."""
    system = platform.system()

    try:
        if system == "Darwin":
            subprocess.run(
                [
                    "osascript", "-e",
                    f'display notification "{message}" '
                    f'with title "Kubsome" '
                    f'subtitle "{title}"'
                ],
                capture_output=True,
                timeout=5
            )
        elif system == "Linux":
            subprocess.run(
                [
                    "notify-send",
                    f"Kubsome: {title}",
                    message
                ],
                capture_output=True,
                timeout=5
            )
    except Exception:
        pass  # Notifications are best-effort


def notify_if_critical(alerts):
    """Send notification if critical alerts detected."""
    from core.config import load_config
    config = load_config()

    if not config.get("notifications", False):
        return

    critical = [
        a for a in alerts
        if a.get("severity") == "critical"
    ]

    if critical:
        notify(
            "Critical Alert",
            f"{len(critical)} critical issues detected"
        )
