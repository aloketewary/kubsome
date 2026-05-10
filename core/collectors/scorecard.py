"""
Cluster Score Card — grades cluster health A-F
across security, resources, availability, and operations.
"""

from core.collectors.pods import collect_pods
from core.collectors.nodes import collect_nodes
from core.collectors.deployments import collect_deployments
from core.collectors.events import collect_events


def cluster_scorecard():
    """
    Generate a cluster health scorecard with
    A-F grades per category and overall.
    """
    pods = collect_pods()
    nodes = collect_nodes()
    deployments = collect_deployments()
    events = collect_events(limit=100)

    scores = {
        "availability": _score_availability(
            pods, nodes, deployments
        ),
        "stability": _score_stability(pods, events),
        "resources": _score_resources(pods, nodes),
        "operations": _score_operations(
            deployments, events
        ),
    }

    # Overall = weighted average
    weights = {
        "availability": 0.35,
        "stability": 0.30,
        "resources": 0.20,
        "operations": 0.15,
    }
    overall = sum(
        scores[k]["score"] * weights[k]
        for k in scores
    )

    return {
        "overall_score": round(overall),
        "overall_grade": _to_grade(overall),
        "categories": scores,
        "summary": _build_summary(scores),
        "recommendations": _build_recommendations(
            scores
        ),
    }


def _score_availability(pods, nodes, deployments):
    """Score based on running pods, ready nodes, available deployments."""
    total_pods = len(pods) or 1
    running = sum(
        1 for p in pods if p["status"] == "Running"
    )
    pod_pct = (running / total_pods) * 100

    total_nodes = len(nodes) or 1
    ready = sum(1 for n in nodes if n["ready"])
    node_pct = (ready / total_nodes) * 100

    total_deps = len(deployments) or 1
    available = sum(
        1 for d in deployments
        if d["available"] >= d["desired"]
    )
    dep_pct = (available / total_deps) * 100

    score = (pod_pct * 0.5 + node_pct * 0.3 + dep_pct * 0.2)

    issues = []
    if pod_pct < 100:
        issues.append(
            f"{total_pods - running} pods not running"
        )
    if node_pct < 100:
        issues.append(
            f"{total_nodes - ready} nodes not ready"
        )
    if dep_pct < 100:
        issues.append(
            f"{total_deps - available} deployments unavailable"
        )

    return {
        "score": round(score),
        "grade": _to_grade(score),
        "issues": issues,
    }


def _score_stability(pods, events):
    """Score based on restart counts and warning events."""
    total_pods = len(pods) or 1
    high_restart = sum(
        1 for p in pods if p["restarts"] >= 5
    )
    crash_loop = sum(
        1 for p in pods
        if p["status"] == "CrashLoopBackOff"
    )

    warning_events = sum(
        1 for e in events if e["type"] == "Warning"
    )

    # Deductions
    score = 100
    score -= (high_restart / total_pods) * 40
    score -= (crash_loop / total_pods) * 50
    score -= min(warning_events * 0.5, 30)
    score = max(score, 0)

    issues = []
    if high_restart:
        issues.append(
            f"{high_restart} pods with high restarts"
        )
    if crash_loop:
        issues.append(
            f"{crash_loop} pods crashlooping"
        )
    if warning_events > 10:
        issues.append(
            f"{warning_events} warning events"
        )

    return {
        "score": round(score),
        "grade": _to_grade(score),
        "issues": issues,
    }


def _score_resources(pods, nodes):
    """Score based on resource configuration."""
    total_pods = len(pods) or 1

    # Check if pods have resource limits (from events/status)
    # Simple heuristic: if many pods are pending, resources are tight
    pending = sum(
        1 for p in pods if p["status"] == "Pending"
    )

    score = 100
    score -= (pending / total_pods) * 60

    # Node pressure
    not_ready = sum(1 for n in nodes if not n["ready"])
    if not_ready:
        score -= not_ready * 20

    score = max(score, 0)

    issues = []
    if pending:
        issues.append(f"{pending} pods pending (resource pressure)")
    if not_ready:
        issues.append(f"{not_ready} nodes under pressure")

    return {
        "score": round(score),
        "grade": _to_grade(score),
        "issues": issues,
    }


def _score_operations(deployments, events):
    """Score based on deployment health and recent operations."""
    total_deps = len(deployments) or 1
    stuck = sum(
        1 for d in deployments
        if d.get("available", 0) < d.get("desired", 1)
    )

    # Check for recent failed operations
    failed_events = sum(
        1 for e in events
        if e.get("reason") in (
            "FailedScheduling", "BackOff",
            "FailedMount", "FailedAttachVolume",
        )
    )

    score = 100
    score -= (stuck / total_deps) * 40
    score -= min(failed_events * 2, 30)
    score = max(score, 0)

    issues = []
    if stuck:
        issues.append(f"{stuck} deployments stuck")
    if failed_events:
        issues.append(f"{failed_events} failed operations")

    return {
        "score": round(score),
        "grade": _to_grade(score),
        "issues": issues,
    }


def _to_grade(score):
    if score >= 90:
        return "A"
    if score >= 80:
        return "B"
    if score >= 70:
        return "C"
    if score >= 60:
        return "D"
    return "F"


def _build_summary(scores):
    """One-line summary."""
    grades = [
        f"{k}: {v['grade']}"
        for k, v in scores.items()
    ]
    return " | ".join(grades)


def _build_recommendations(scores):
    """Actionable recommendations based on scores."""
    recs = []
    for category, data in scores.items():
        if data["score"] < 80:
            for issue in data["issues"][:2]:
                recs.append({
                    "category": category,
                    "issue": issue,
                    "action": _suggest_action(
                        category, issue
                    ),
                })
    return recs


def _suggest_action(category, issue):
    if "not running" in issue:
        return "Run: diagnose <pod> on failing pods"
    if "not ready" in issue:
        return "Run: top nodes to check pressure"
    if "crashlooping" in issue:
        return "Run: diagnose <pod> for root cause"
    if "restart" in issue:
        return "Run: logs <pod> --previous"
    if "pending" in issue:
        return "Run: capacity to check headroom"
    if "stuck" in issue:
        return "Run: rollout <deployment>"
    if "warning" in issue:
        return "Run: events to investigate"
    return f"Investigate {category}"
