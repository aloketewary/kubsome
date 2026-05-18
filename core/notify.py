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
            # Use arguments for osascript to prevent command injection
            subprocess.run(
                [
                    "osascript", "-e",
                    "on run {msg, sub}\n"
                    '  display notification msg with title "Kubsome" subtitle sub\n'
                    "end run",
                    message,
                    title
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


def _get_cluster_info():
    """Get current cluster context and namespace."""
    try:
        from core.context import context
        return {
            "context": context.current_context or "unknown",
            "namespace": context.namespace or "default",
        }
    except Exception:
        return {"context": "unknown", "namespace": "default"}


def notify_webhook(title, message, severity="warning"):
    """Send notification to configured webhooks."""
    from core.config import load_config
    config = load_config()
    webhooks = config.get("webhooks", [])

    if not webhooks:
        return

    cluster = _get_cluster_info()

    for hook in webhooks:
        t = threading.Thread(
            target=_send_webhook,
            args=(hook, title, message, severity, cluster),
            daemon=True
        )
        t.start()


def _send_webhook(hook, title, message, severity, cluster):
    """Send to a single webhook (runs in background thread)."""
    import urllib.request

    url = hook.get("url", "")
    hook_type = hook.get("type", "generic")

    if not url:
        return

    try:
        if hook_type == "slack":
            payload = _slack_payload(title, message, severity, cluster)
        elif hook_type == "teams":
            payload = _teams_payload(title, message, severity, cluster)
        elif hook_type == "webex":
            payload = _webex_payload(title, message, severity, cluster)
        elif hook_type == "pagerduty":
            payload = _pagerduty_payload(title, message, severity, cluster)
        elif hook_type == "opsgenie":
            payload = _opsgenie_payload(title, message, severity, cluster, hook)
        else:
            payload = _generic_payload(title, message, severity, cluster)

        data = json.dumps(payload).encode("utf-8")
        headers = {"Content-Type": "application/json"}

        # OpsGenie needs API key in header
        if hook_type == "opsgenie" and hook.get("api_key"):
            headers["Authorization"] = f"GenieKey {hook['api_key']}"

        req = urllib.request.Request(
            url, data=data, headers=headers
        )
        urllib.request.urlopen(req, timeout=10)
    except Exception as e:
        import sys
        print(
            f"[webhook] Failed to send to {hook_type}: {e}",
            file=sys.stderr
        )


def _slack_payload(title, message, severity, cluster):
    color = (
        "#ef4444" if severity == "critical"
        else "#eab308" if severity == "warning"
        else "#22c55e"
    )
    icon = (
        ":red_circle:" if severity == "critical"
        else ":warning:" if severity == "warning"
        else ":white_check_mark:"
    )
    ctx = cluster["context"]
    ns = cluster["namespace"]
    return {
        "blocks": [
            {
                "type": "header",
                "text": {"type": "plain_text", "text": f"{icon} {title}", "emoji": True}
            },
            {
                "type": "section",
                "text": {"type": "mrkdwn", "text": message}
            },
            {
                "type": "context",
                "elements": [{"type": "mrkdwn", "text": f":kubernetes: `{ctx}` / `{ns}` • *{severity.upper()}*"}]
            }
        ],
        "attachments": [{"color": color, "blocks": []}]
    }


def _teams_payload(title, message, severity, cluster):
    color = (
        "FF0000" if severity == "critical"
        else "FFA500" if severity == "warning"
        else "00FF00"
    )
    icon = (
        "\U0001f534" if severity == "critical"
        else "\U0001f7e1" if severity == "warning"
        else "\U0001f7e2"
    )
    return {
        "@type": "MessageCard",
        "themeColor": color,
        "title": f"{icon} Kubsome: {title}",
        "text": message,
        "sections": [{
            "facts": [
                {"name": "Cluster", "value": cluster["context"]},
                {"name": "Namespace", "value": cluster["namespace"]},
                {"name": "Severity", "value": severity.upper()},
            ]
        }]
    }


def _generic_payload(title, message, severity, cluster):
    return {
        "source": "kubsome",
        "title": title,
        "message": message,
        "severity": severity,
        "cluster": cluster["context"],
        "namespace": cluster["namespace"],
    }


def _webex_payload(title, message, severity, cluster):
    icon = (
        "\U0001f534" if severity == "critical"
        else "\U0001f7e1" if severity == "warning"
        else "\U0001f7e2"
    )
    ctx = cluster["context"]
    ns = cluster["namespace"]
    return {
        "markdown": (
            f"## {icon} {title}\n\n"
            f"{message}\n\n"
            f"---\n"
            f"**Cluster:** `{ctx}` | **Namespace:** `{ns}` | **Severity:** {severity.upper()}"
        )
    }


def _pagerduty_payload(title, message, severity, cluster):
    """PagerDuty Events API v2 payload."""
    pd_severity = {
        "critical": "critical",
        "warning": "warning",
        "info": "info",
    }.get(severity, "warning")

    return {
        "routing_key": "",  # Filled from URL (integration key)
        "event_action": "trigger",
        "payload": {
            "summary": f"[Kubsome] {title}: {message[:200]}",
            "severity": pd_severity,
            "source": f"kubsome/{cluster['context']}",
            "component": cluster["namespace"],
            "custom_details": {
                "cluster": cluster["context"],
                "namespace": cluster["namespace"],
                "message": message,
            },
        },
    }


def _opsgenie_payload(title, message, severity, cluster, hook=None):
    """OpsGenie Alert API payload."""
    priority = {
        "critical": "P1",
        "warning": "P3",
        "info": "P5",
    }.get(severity, "P3")

    return {
        "message": f"[Kubsome] {title}",
        "description": message,
        "priority": priority,
        "tags": ["kubsome", cluster["context"], cluster["namespace"]],
        "details": {
            "cluster": cluster["context"],
            "namespace": cluster["namespace"],
            "severity": severity,
        },
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
    warnings = [
        a for a in alerts
        if a.get("severity") == "warning"
    ]

    if critical:
        details = "\n".join(
            f"\u2022 {a.get('message', a.get('title', 'Unknown'))}"
            for a in critical[:5]
        )
        msg = (
            f"{len(critical)} critical issue(s) detected:\n\n"
            f"{details}"
        )
        notify("Critical Alert", f"{len(critical)} critical issues")
        notify_webhook("Critical Alert", msg, "critical")
    elif warnings:
        details = "\n".join(
            f"\u2022 {a.get('message', a.get('title', 'Unknown'))}"
            for a in warnings[:5]
        )
        msg = (
            f"{len(warnings)} warning(s) detected:\n\n"
            f"{details}"
        )
        notify_webhook("Warning Alert", msg, "warning")
