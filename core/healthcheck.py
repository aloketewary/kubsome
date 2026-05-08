"""
Health Check — runs all checks and produces a summary score.
Used for: `check` command and CI/CD integration.
"""

from core.collectors.pods import collect_pods
from core.collectors.nodes import collect_nodes
from core.collectors.deployments import collect_deployments
from core.collectors.security import security_scan
from core.ai.anomaly import detect_anomalies
from core.analyzer import (
    analyze_pods, analyze_nodes, analyze_deployments
)


def run_health_check():
    """
    Run all health checks and return a scored report.
    Score: 0-100 (100 = perfect health)
    """
    pods = collect_pods()
    nodes = collect_nodes()
    deployments = collect_deployments()

    pod_h = analyze_pods(pods)
    node_h = analyze_nodes(nodes)
    dep_h = analyze_deployments(deployments)

    alerts = detect_anomalies()
    sec = security_scan()

    # Calculate score
    score = 100

    # Pod health (-5 per warning, -15 per critical)
    score -= pod_h["warning"] * 5
    score -= pod_h["critical"] * 15

    # Node health (-20 per not-ready node)
    score -= node_h["warning"] * 20

    # Deployment health (-10 per unavailable)
    score -= dep_h["unavailable"] * 10

    # Anomalies (-10 per critical, -5 per warning)
    for a in alerts:
        if a["severity"] == "critical":
            score -= 10
        elif a["severity"] == "warning":
            score -= 5

    # Security (-3 per critical/high finding)
    critical_sec = sum(
        1 for s in sec
        if s["severity"] in ("critical", "high")
    )
    score -= critical_sec * 3

    score = max(0, min(100, score))

    # Grade
    if score >= 90:
        grade = "A"
    elif score >= 75:
        grade = "B"
    elif score >= 60:
        grade = "C"
    elif score >= 40:
        grade = "D"
    else:
        grade = "F"

    return {
        "score": score,
        "grade": grade,
        "pods": pod_h,
        "nodes": node_h,
        "deployments": dep_h,
        "alerts_count": len(alerts),
        "security_issues": len(sec),
        "critical_security": critical_sec,
        "checks": [
            {
                "name": "Pod Health",
                "pass": pod_h["critical"] == 0,
                "detail": (
                    f"{pod_h['healthy']} healthy, "
                    f"{pod_h['critical']} critical"
                ),
            },
            {
                "name": "Node Health",
                "pass": node_h["warning"] == 0,
                "detail": (
                    f"{node_h['healthy']} ready, "
                    f"{node_h['warning']} not ready"
                ),
            },
            {
                "name": "Deployments",
                "pass": dep_h["unavailable"] == 0,
                "detail": (
                    f"{dep_h['healthy']} healthy, "
                    f"{dep_h['unavailable']} unavailable"
                ),
            },
            {
                "name": "Anomalies",
                "pass": len(alerts) == 0,
                "detail": f"{len(alerts)} detected",
            },
            {
                "name": "Security",
                "pass": critical_sec == 0,
                "detail": (
                    f"{critical_sec} critical/high issues"
                ),
            },
        ],
    }
