"""
Export — generate shareable reports in JSON or Markdown.
"""

import json
from datetime import datetime
from pathlib import Path

from core.context import context
from core.collectors.pods import collect_pods
from core.collectors.nodes import collect_nodes
from core.collectors.deployments import collect_deployments
from core.collectors.events import collect_events
from core.collectors.security import security_scan
from core.collectors.cost import (
    resource_recommendations, find_unused_resources
)
from core.analyzer import (
    analyze_pods, analyze_nodes, analyze_deployments
)
from core.ai.anomaly import detect_anomalies

EXPORT_DIR = Path.home() / ".kubeasy" / "reports"


def export_report(format="md"):
    """Generate a full cluster report."""
    EXPORT_DIR.mkdir(parents=True, exist_ok=True)

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")

    pods = collect_pods()
    nodes = collect_nodes()
    deployments = collect_deployments()
    events = collect_events(limit=30)
    alerts = detect_anomalies()
    sec_findings = security_scan()
    cost_recs = resource_recommendations()
    unused = find_unused_resources()

    pod_health = analyze_pods(pods)
    node_health = analyze_nodes(nodes)
    dep_health = analyze_deployments(deployments)

    report_data = {
        "generated": datetime.now().isoformat(),
        "context": context.current_context,
        "namespace": context.namespace,
        "summary": {
            "pods": pod_health,
            "nodes": node_health,
            "deployments": dep_health,
        },
        "alerts": [
            {"severity": a["severity"], "title": a["title"], "detail": a["detail"]}
            for a in alerts
        ],
        "security": [
            {"severity": f["severity"], "pod": f["pod"], "issue": f["issue"]}
            for f in sec_findings[:20]
        ],
        "cost_recommendations": [
            {"pod": r["pod"], "type": r["type"], "suggestion": r["suggestion"]}
            for r in cost_recs[:20]
        ],
        "unused_resources": unused,
        "recent_events": [
            {"type": e["type"], "reason": e["reason"], "object": e["object"]}
            for e in events if e["type"] == "Warning"
        ],
    }

    if format == "json":
        path = EXPORT_DIR / f"report_{timestamp}.json"
        with open(path, "w") as f:
            json.dump(report_data, f, indent=2)
    else:
        path = EXPORT_DIR / f"report_{timestamp}.md"
        md = _to_markdown(report_data)
        with open(path, "w") as f:
            f.write(md)

    return str(path)


def _to_markdown(data):
    lines = [
        f"# KubeEasy Cluster Report",
        f"",
        f"**Generated:** {data['generated'][:19]}",
        f"**Context:** {data['context']}",
        f"**Namespace:** {data['namespace']}",
        f"",
        f"## Summary",
        f"",
        f"| Resource | Healthy | Warning | Critical |",
        f"|----------|---------|---------|----------|",
        f"| Pods | {data['summary']['pods']['healthy']} | {data['summary']['pods']['warning']} | {data['summary']['pods']['critical']} |",
        f"| Nodes | {data['summary']['nodes']['healthy']} | {data['summary']['nodes']['warning']} | - |",
        f"| Deployments | {data['summary']['deployments']['healthy']} | - | {data['summary']['deployments']['unavailable']} |",
        f"",
    ]

    if data["alerts"]:
        lines.append("## Alerts")
        lines.append("")
        for a in data["alerts"]:
            lines.append(
                f"- **[{a['severity'].upper()}]** "
                f"{a['title']}: {a['detail']}"
            )
        lines.append("")

    if data["security"]:
        lines.append("## Security Findings")
        lines.append("")
        lines.append("| Severity | Pod | Issue |")
        lines.append("|----------|-----|-------|")
        for f in data["security"]:
            lines.append(
                f"| {f['severity']} | {f['pod']} | {f['issue']} |"
            )
        lines.append("")

    if data["cost_recommendations"]:
        lines.append("## Resource Optimization")
        lines.append("")
        for r in data["cost_recommendations"]:
            lines.append(
                f"- **{r['pod']}**: {r['suggestion']}"
            )
        lines.append("")

    if data["unused_resources"]:
        lines.append("## Unused Resources")
        lines.append("")
        for u in data["unused_resources"]:
            lines.append(f"- {u['kind']}: {u['name']}")
        lines.append("")

    if data["recent_events"]:
        lines.append("## Warning Events")
        lines.append("")
        for e in data["recent_events"]:
            lines.append(
                f"- {e['reason']}: {e['object']}"
            )
        lines.append("")

    return "\n".join(lines)
