"""
Anomaly Detection — identifies unusual patterns:
- Restart spikes (sudden increase)
- Event storms (high warning rate)
- Resource pressure (many pods near limits)
- Scheduling failures (pending pods)
- Cascading failures (multiple related pods failing)
"""

from core.collectors.pods import collect_pods
from core.collectors.events import collect_events
from core.collectors.nodes import collect_nodes


def detect_anomalies(pods=None, events=None, nodes=None):
    """Run all anomaly detectors, return list of alerts."""
    alerts = []

    pods = pods if pods is not None else collect_pods()
    events = events if events is not None else collect_events(limit=50)
    nodes = nodes if nodes is not None else collect_nodes()

    alerts.extend(_restart_spike(pods))
    alerts.extend(_event_storm(events))
    alerts.extend(_scheduling_pressure(pods))
    alerts.extend(_node_pressure(nodes))
    alerts.extend(_cascading_failure(pods))

    # Sort by severity
    severity_order = {
        "critical": 0, "warning": 1, "info": 2
    }
    alerts.sort(
        key=lambda a: severity_order.get(
            a["severity"], 3
        )
    )

    return alerts


def _restart_spike(pods):
    """Detect pods with abnormally high restarts."""
    alerts = []

    high_restart = [
        p for p in pods if p["restarts"] >= 10
    ]
    medium_restart = [
        p for p in pods
        if 5 <= p["restarts"] < 10
    ]

    if len(high_restart) >= 3:
        alerts.append({
            "severity": "critical",
            "type": "restart_spike",
            "title": "Restart Storm Detected",
            "detail": (
                f"{len(high_restart)} pods with 10+ restarts"
            ),
            "affected": [
                p["name"] for p in high_restart[:5]
            ],
            "action": (
                "Possible cluster-wide issue. "
                "Check shared dependencies "
                "(DNS, secrets, configmaps)."
            ),
        })
    elif high_restart:
        for p in high_restart:
            alerts.append({
                "severity": "warning",
                "type": "restart_spike",
                "title": f"High restarts: {p['name']}",
                "detail": f"{p['restarts']} restarts",
                "affected": [p["name"]],
                "action": f"diagnose {p['name']}",
            })

    return alerts


def _event_storm(events):
    """Detect unusually high warning event rate."""
    alerts = []

    warnings = [
        e for e in events if e["type"] == "Warning"
    ]

    if len(warnings) > 30:
        # Group by reason
        reasons = {}
        for e in warnings:
            r = e["reason"]
            reasons[r] = reasons.get(r, 0) + 1

        top_reason = max(reasons, key=reasons.get)

        alerts.append({
            "severity": "critical",
            "type": "event_storm",
            "title": "Event Storm",
            "detail": (
                f"{len(warnings)} warnings — "
                f"top: {top_reason} ({reasons[top_reason]}×)"
            ),
            "affected": list(set(
                e["object"] for e in warnings
            ))[:5],
            "action": "events watch",
        })
    elif len(warnings) > 15:
        alerts.append({
            "severity": "warning",
            "type": "event_storm",
            "title": "Elevated Warning Events",
            "detail": f"{len(warnings)} warnings in recent events",
            "affected": [],
            "action": "events",
        })

    return alerts


def _scheduling_pressure(pods):
    """Detect pending pods indicating scheduling issues."""
    alerts = []

    pending = [
        p for p in pods if p["status"] == "Pending"
    ]

    if len(pending) >= 3:
        alerts.append({
            "severity": "critical",
            "type": "scheduling",
            "title": "Scheduling Pressure",
            "detail": (
                f"{len(pending)} pods stuck in Pending"
            ),
            "affected": [
                p["name"] for p in pending[:5]
            ],
            "action": (
                "Check node capacity: top nodes"
            ),
        })
    elif pending:
        alerts.append({
            "severity": "warning",
            "type": "scheduling",
            "title": "Pending Pods",
            "detail": f"{len(pending)} pod(s) pending",
            "affected": [p["name"] for p in pending],
            "action": "inspect <pod>",
        })

    return alerts


def _node_pressure(nodes):
    """Detect unhealthy nodes."""
    alerts = []

    not_ready = [n for n in nodes if not n["ready"]]

    if not_ready:
        alerts.append({
            "severity": "critical",
            "type": "node_pressure",
            "title": "Nodes Not Ready",
            "detail": (
                f"{len(not_ready)}/{len(nodes)} "
                f"nodes not ready"
            ),
            "affected": [
                n["name"] for n in not_ready
            ],
            "action": "Check node conditions",
        })

    return alerts


def _cascading_failure(pods):
    """Detect multiple related pods failing (same prefix)."""
    alerts = []

    failing = [
        p for p in pods
        if p["status"] != "Running" or p["restarts"] >= 5
    ]

    if len(failing) < 2:
        return alerts

    # Group by deployment prefix (name without pod hash)
    prefixes = {}
    for p in failing:
        parts = p["name"].rsplit("-", 2)
        prefix = parts[0] if len(parts) >= 3 else p["name"]
        if prefix not in prefixes:
            prefixes[prefix] = []
        prefixes[prefix].append(p)

    for prefix, group in prefixes.items():
        if len(group) >= 2:
            alerts.append({
                "severity": "critical",
                "type": "cascading",
                "title": f"Cascading Failure: {prefix}",
                "detail": (
                    f"{len(group)} pods failing "
                    f"in same deployment"
                ),
                "affected": [
                    p["name"] for p in group
                ],
                "action": (
                    f"trace {prefix}"
                ),
            })

    return alerts
