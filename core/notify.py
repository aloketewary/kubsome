"""
Notifications — desktop + webhook alerts for critical events.

Configure in ~/.kubsome/config.yaml:
  notifications: true
  webhooks:
    - url: https://hooks.slack.com/services/XXX
      type: slack
    - url: https://outlook.office.com/webhook/XXX
      type: teams
    - url: https://webexapis.com/v1/webhooks/incoming/XXX
      type: webex
    - url: https://your-server.com/alert
      type: generic
"""

import subprocess
import platform
import json
import threading


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
        pass


def notify_webhook(title, message, severity="warning"):
    """Send notification to configured webhooks."""
    from core.config import load_config
    config = load_config()
    webhooks = config.get("webhooks", [])

    if not webhooks:
        return

    for hook in webhooks:
        t = threading.Thread(
            target=_send_webhook,
            args=(hook, title, message, severity),
            daemon=True
        )
        t.start()


def _send_webhook(hook, title, message, severity):
    """Send to a single webhook (runs in background thread)."""
    import urllib.request

    url = hook.get("url", "")
    hook_type = hook.get("type", "generic")

    if not url:
        return

    try:
        if hook_type == "slack":
            payload = _slack_payload(title, message, severity)
        elif hook_type == "teams":
            payload = _teams_payload(title, message, severity)
        elif hook_type == "webex":
            payload = _webex_payload(title, message, severity)
        else:
            payload = _generic_payload(title, message, severity)

        data = json.dumps(payload).encode("utf-8")
        req = urllib.request.Request(
            url, data=data,
            headers={"Content-Type": "application/json"}
        )
        urllib.request.urlopen(req, timeout=10)
    except Exception:
        pass


def _slack_payload(title, message, severity):
    color = (
        "#ef4444" if severity == "critical"
        else "#eab308" if severity == "warning"
        else "#22c55e"
    )
    return {
        "attachments": [{
            "color": color,
            "title": f"Kubsome: {title}",
            "text": message,
            "footer": "Kubsome Alert",
        }]
    }


def _teams_payload(title, message, severity):
    color = (
        "FF0000" if severity == "critical"
        else "FFA500" if severity == "warning"
        else "00FF00"
    )
    return {
        "@type": "MessageCard",
        "themeColor": color,
        "title": f"Kubsome: {title}",
        "text": message,
    }


def _generic_payload(title, message, severity):
    return {
        "source": "kubsome",
        "title": title,
        "message": message,
        "severity": severity,
    }


def _webex_payload(title, message, severity):
    icon = (
        "🔴" if severity == "critical"
        else "🟡" if severity == "warning"
        else "🟢"
    )
    return {
        "markdown": (
            f"{icon} **Kubsome: {title}**\n\n"
            f"{message}"
        )
    }


def notify_if_critical(alerts):
    """Send notification if critical alerts detected."""
    from core.config import load_config
    config = load_config()

    if not config.get("notifications", False):
        return

    # Handle string (from watch_alert) or list
    if isinstance(alerts, str):
        notify("Watch Alert", alerts)
        notify_webhook("Watch Alert", alerts, "warning")
        return

    critical = [
        a for a in alerts
        if a.get("severity") == "critical"
    ]

    if critical:
        msg = f"{len(critical)} critical issues detected"
        notify("Critical Alert", msg)
        notify_webhook("Critical Alert", msg, "critical")
