"""
Correlation Engine — links signals across resources
to build root cause chains.

Example chain:
  Event(FailedScheduling) → Pod(Pending) → Node(full)
  Event(BackOff) → Pod(CrashLoop) → Deployment(degraded)
"""

from core.collectors.pods import collect_pods
from core.collectors.events import collect_events
from core.collectors.deployments import (
    collect_deployments
)


def correlate(pod_name=None):
    """
    Build correlation chains for the namespace.
    If pod_name given, focus on that pod's chain.
    """
    pods = collect_pods()
    events = collect_events(limit=50)
    deployments = collect_deployments()

    chains = []

    if pod_name:
        # Single pod correlation
        pod = next(
            (p for p in pods if pod_name in p["name"]),
            None
        )
        if pod:
            chain = _build_chain(
                pod, events, deployments
            )
            if chain["links"]:
                chains.append(chain)
    else:
        # Find all unhealthy pods and correlate
        unhealthy = [
            p for p in pods
            if p["status"] != "Running"
            or p["restarts"] >= 5
        ]

        for pod in unhealthy[:5]:
            chain = _build_chain(
                pod, events, deployments
            )
            if chain["links"]:
                chains.append(chain)

    return chains


def _build_chain(pod, events, deployments):
    """Build a cause-effect chain for a pod."""
    chain = {
        "pod": pod["name"],
        "status": pod["status"],
        "links": [],
    }

    # Find related events
    pod_events = [
        e for e in events
        if pod["name"] in e.get("object", "")
        and e["type"] == "Warning"
    ]

    for ev in pod_events[:3]:
        chain["links"].append({
            "type": "event",
            "source": ev["reason"],
            "detail": ev["message"][:80],
        })

    # Find parent deployment
    prefix = _deployment_prefix(pod["name"])
    parent_dep = next(
        (d for d in deployments
         if d["name"] == prefix),
        None
    )

    if parent_dep:
        if parent_dep["available"] < parent_dep["desired"]:
            chain["links"].append({
                "type": "deployment",
                "source": parent_dep["name"],
                "detail": (
                    f"Degraded: "
                    f"{parent_dep['available']}/"
                    f"{parent_dep['desired']} available"
                ),
            })

    # Determine root cause
    if pod_events:
        reasons = [e["reason"] for e in pod_events]
        if "BackOff" in reasons:
            chain["root_cause"] = "Application crash"
        elif "FailedScheduling" in reasons:
            chain["root_cause"] = "Resource exhaustion"
        elif "Unhealthy" in reasons:
            chain["root_cause"] = "Probe failure"
        elif "FailedMount" in reasons:
            chain["root_cause"] = "Volume issue"
        else:
            chain["root_cause"] = reasons[0]
    else:
        chain["root_cause"] = "Unknown"

    return chain


def _deployment_prefix(pod_name):
    """Extract deployment name from pod name."""
    parts = pod_name.rsplit("-", 2)
    if len(parts) >= 3:
        return parts[0]
    return pod_name
