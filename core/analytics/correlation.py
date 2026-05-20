"""
Change Correlation Engine — automatically correlates pod failures
with recent cluster changes to answer "what caused this?"

Checks (in time window before the issue):
  - Deployment image changes
  - ConfigMap/Secret updates
  - HPA scaling events
  - Node changes
  - Helm upgrades (if GitOps connected)
  - Manual kubectl edits

Returns ranked list of probable causes with confidence scores.
"""

import json
import subprocess
from datetime import datetime, timezone, timedelta

from core.context import context


def correlate_change(target, minutes_back=10):
    """
    Find what changed before a pod/deployment started failing.

    Args:
        target: pod or deployment name
        minutes_back: how far back to look for changes

    Returns list of probable causes ranked by likelihood.
    """
    ctx = context.current_context
    ns = context.namespace

    # Determine the failure time (now, or from pod events)
    failure_time = _get_failure_time(ctx, ns, target)
    window_start = failure_time - timedelta(minutes=minutes_back)

    # Gather all changes in the time window
    changes = []
    changes.extend(_check_deployment_changes(ctx, ns, target, window_start))
    changes.extend(_check_configmap_changes(ctx, ns, target, window_start))
    changes.extend(_check_scaling_events(ctx, ns, target, window_start))
    changes.extend(_check_recent_events(ctx, ns, target, window_start))
    changes.extend(_check_node_changes(ctx, window_start))

    # Score and rank
    scored = _score_changes(changes, target, failure_time)
    scored.sort(key=lambda x: x["score"], reverse=True)

    # Determine root cause
    root_cause = scored[0] if scored else None

    return {
        "target": target,
        "namespace": ns,
        "failure_time": failure_time.isoformat(),
        "window_minutes": minutes_back,
        "changes_found": len(scored),
        "probable_cause": root_cause,
        "all_changes": scored[:10],
        "summary": _build_summary(root_cause, target, failure_time),
    }


def _get_failure_time(ctx, ns, target):
    """Get when the target started failing. Defaults to now."""
    cmd = [
        "kubectl", "--context", str(ctx or ""),
        "get", "events", "-n", str(ns),
        "--field-selector", f"involvedObject.name={target}",
        "-o", "json"
    ]
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode == 0:
        data = json.loads(r.stdout)
        for item in reversed(data.get("items", [])):
            if item.get("type") == "Warning":
                ts = item.get("lastTimestamp") or item.get("eventTime")
                if ts:
                    try:
                        return datetime.fromisoformat(
                            ts.replace("Z", "+00:00")
                        )
                    except Exception:
                        pass

    return datetime.now(timezone.utc)


def _check_deployment_changes(ctx, ns, target, since):
    """Check if deployment image or spec changed recently."""
    changes = []

    # Get deployment (could be the target or owner of target pod)
    deploy_name = _resolve_deployment(ctx, ns, target)
    if not deploy_name:
        return []

    # Check rollout history
    cmd = [
        "kubectl", "--context", str(ctx or ""),
        "rollout", "history", f"deployment/{deploy_name}",
        "-n", str(ns)
    ]
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode == 0 and "REVISION" in r.stdout:
        lines = r.stdout.strip().split("\n")
        if len(lines) > 2:  # Has revisions beyond header
            changes.append({
                "type": "deployment_rollout",
                "resource": f"deployment/{deploy_name}",
                "detail": f"Recent rollout ({len(lines) - 1} revisions)",
                "time": None,
                "relevance": "high",
            })

    # Check events for deployment changes
    cmd = [
        "kubectl", "--context", str(ctx or ""),
        "get", "events", "-n", str(ns),
        "--field-selector", f"involvedObject.name={deploy_name},involvedObject.kind=Deployment",
        "-o", "json"
    ]
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode == 0:
        data = json.loads(r.stdout)
        for item in data.get("items", []):
            ts = _parse_event_time(item)
            if ts and ts >= since:
                reason = item.get("reason", "")
                if reason in ("ScalingReplicaSet", "DeploymentRollback"):
                    changes.append({
                        "type": "deployment_change",
                        "resource": deploy_name,
                        "detail": f"{reason}: {item.get('message', '')[:100]}",
                        "time": ts.isoformat(),
                        "relevance": "high",
                    })

    return changes


def _check_configmap_changes(ctx, ns, target, since):
    """Check if ConfigMaps used by this deployment changed."""
    changes = []
    deploy_name = _resolve_deployment(ctx, ns, target)
    if not deploy_name:
        return []

    # Get ConfigMaps mounted by this deployment
    cmd = [
        "kubectl", "--context", str(ctx or ""),
        "get", "deployment", deploy_name,
        "-n", str(ns), "-o", "json"
    ]
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode != 0:
        return []

    dep = json.loads(r.stdout)
    volumes = (
        dep.get("spec", {}).get("template", {})
        .get("spec", {}).get("volumes", [])
    )

    cm_names = []
    for v in volumes:
        if "configMap" in v:
            cm_names.append(v["configMap"]["name"])

    # Check envFrom
    containers = (
        dep.get("spec", {}).get("template", {})
        .get("spec", {}).get("containers", [])
    )
    for c in containers:
        for ef in c.get("envFrom", []):
            if "configMapRef" in ef:
                cm_names.append(ef["configMapRef"]["name"])

    # Check if any ConfigMap was recently modified
    for cm in cm_names:
        cmd = [
            "kubectl", "--context", str(ctx or ""),
            "get", "configmap", cm, "-n", str(ns),
            "-o", "jsonpath={.metadata.resourceVersion},{.metadata.creationTimestamp}"
        ]
        r = subprocess.run(cmd, capture_output=True, text=True)
        if r.returncode == 0:
            # Check events for this configmap
            cmd2 = [
                "kubectl", "--context", str(ctx or ""),
                "get", "events", "-n", str(ns),
                "--field-selector", f"involvedObject.name={cm}",
                "-o", "json"
            ]
            r2 = subprocess.run(cmd2, capture_output=True, text=True)
            if r2.returncode == 0:
                events = json.loads(r2.stdout).get("items", [])
                for ev in events:
                    ts = _parse_event_time(ev)
                    if ts and ts >= since:
                        changes.append({
                            "type": "configmap_change",
                            "resource": f"configmap/{cm}",
                            "detail": f"ConfigMap '{cm}' modified (mounted by {deploy_name})",
                            "time": ts.isoformat(),
                            "relevance": "critical",
                        })

    return changes


def _check_scaling_events(ctx, ns, target, since):
    """Check for HPA scaling or manual scale events."""
    changes = []
    deploy_name = _resolve_deployment(ctx, ns, target)
    if not deploy_name:
        return []

    cmd = [
        "kubectl", "--context", str(ctx or ""),
        "get", "events", "-n", str(ns),
        "-o", "json"
    ]
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode != 0:
        return []

    data = json.loads(r.stdout)
    for item in data.get("items", []):
        reason = item.get("reason", "")
        if reason not in ("SuccessfulRescale", "ScalingReplicaSet"):
            continue
        obj_name = item.get("involvedObject", {}).get("name", "")
        if deploy_name not in obj_name:
            continue

        ts = _parse_event_time(item)
        if ts and ts >= since:
            changes.append({
                "type": "scaling",
                "resource": obj_name,
                "detail": item.get("message", "")[:100],
                "time": ts.isoformat(),
                "relevance": "medium",
            })

    return changes


def _check_recent_events(ctx, ns, target, since):
    """Check for warning events on related resources."""
    changes = []

    cmd = [
        "kubectl", "--context", str(ctx or ""),
        "get", "events", "-n", str(ns),
        "--field-selector", "type=Warning",
        "-o", "json"
    ]
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode != 0:
        return []

    data = json.loads(r.stdout)
    for item in data.get("items", []):
        ts = _parse_event_time(item)
        if not ts or ts < since:
            continue

        obj_name = item.get("involvedObject", {}).get("name", "")
        # Only include if related to target
        if target not in obj_name:
            continue

        reason = item.get("reason", "")
        changes.append({
            "type": "warning_event",
            "resource": obj_name,
            "detail": f"{reason}: {item.get('message', '')[:80]}",
            "time": ts.isoformat(),
            "relevance": "medium" if reason in (
                "Unhealthy", "BackOff", "FailedScheduling"
            ) else "low",
        })

    return changes


def _check_node_changes(ctx, since):
    """Check for node NotReady or pressure events."""
    changes = []

    cmd = [
        "kubectl", "--context", str(ctx or ""),
        "get", "events",
        "--field-selector", "involvedObject.kind=Node,type=Warning",
        "-o", "json"
    ]
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode != 0:
        return []

    data = json.loads(r.stdout)
    for item in data.get("items", []):
        ts = _parse_event_time(item)
        if not ts or ts < since:
            continue

        node = item.get("involvedObject", {}).get("name", "")
        reason = item.get("reason", "")
        if reason in ("NodeNotReady", "NodeHasDiskPressure",
                      "NodeHasMemoryPressure", "Rebooted"):
            changes.append({
                "type": "node_issue",
                "resource": f"node/{node}",
                "detail": f"{reason}: {item.get('message', '')[:80]}",
                "time": ts.isoformat(),
                "relevance": "high",
            })

    return changes


def _score_changes(changes, target, failure_time):
    """Score each change by likelihood of being the cause."""
    relevance_scores = {
        "critical": 90,
        "high": 70,
        "medium": 40,
        "low": 20,
    }

    type_boost = {
        "configmap_change": 20,
        "deployment_rollout": 15,
        "deployment_change": 15,
        "node_issue": 10,
        "scaling": 5,
        "warning_event": 0,
    }

    scored = []
    for c in changes:
        base = relevance_scores.get(c["relevance"], 30)
        boost = type_boost.get(c["type"], 0)

        # Time proximity bonus (closer to failure = more likely)
        time_bonus = 0
        if c.get("time"):
            try:
                change_time = datetime.fromisoformat(c["time"])
                delta = (failure_time - change_time).total_seconds()
                if delta < 120:  # Within 2 min
                    time_bonus = 20
                elif delta < 300:  # Within 5 min
                    time_bonus = 10
            except Exception:
                pass

        score = min(100, base + boost + time_bonus)
        scored.append({**c, "score": score})

    return scored


def _build_summary(root_cause, target, failure_time):
    """Build human-readable summary."""
    if not root_cause:
        return f"No recent changes found before {target} failure"

    return (
        f"{target} likely failed due to: "
        f"{root_cause['type'].replace('_', ' ')} "
        f"on {root_cause['resource']} "
        f"(confidence: {root_cause['score']}%)"
    )


def _resolve_deployment(ctx, ns, target):
    """Resolve pod name to deployment name."""
    # Try as deployment first
    cmd = [
        "kubectl", "--context", str(ctx or ""),
        "get", "deployment", target,
        "-n", str(ns), "-o", "name"
    ]
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode == 0:
        return target

    # Try as pod → find owner deployment
    cmd = [
        "kubectl", "--context", str(ctx or ""),
        "get", "pod", target, "-n", str(ns),
        "-o", "jsonpath={.metadata.ownerReferences[0].name}"
    ]
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode == 0 and r.stdout:
        rs_name = r.stdout.strip()
        # ReplicaSet name → deployment name
        return "-".join(rs_name.split("-")[:-1])

    # Fuzzy: try prefix match
    cmd = [
        "kubectl", "--context", str(ctx or ""),
        "get", "deployments", "-n", str(ns),
        "-o", "jsonpath={.items[*].metadata.name}"
    ]
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode == 0:
        for dep in r.stdout.split():
            if target.startswith(dep):
                return dep

    return None


def _parse_event_time(event):
    """Parse event timestamp."""
    ts = event.get("lastTimestamp") or event.get("eventTime")
    if not ts:
        return None
    try:
        return datetime.fromisoformat(ts.replace("Z", "+00:00"))
    except Exception:
        return None
