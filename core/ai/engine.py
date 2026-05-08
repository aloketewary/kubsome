"""
AI Operations Assistant — rule-based intelligence engine.
Analyzes cluster signals and produces natural language
explanations, summaries, and recommendations.

No external API required — uses pattern matching and
heuristics. Can be extended with LLM integration later.
"""

from core.collectors.pods import collect_pods
from core.collectors.events import collect_events
from core.collectors.nodes import collect_nodes
from core.collectors.deployments import (
    collect_deployments
)
from core.collectors.inspect import (
    inspect_pod, pod_events, pod_logs,
    extract_pod_details
)
from core.collectors.metrics import top_pods
from core.resolver import resolve_pod_name
from core.selector import choose_pod
from core.diagnostics.engine import diagnose
from core.collectors.diagnosis import collect_diagnosis


def handle_ai_query(query):
    """
    Route natural language queries to appropriate
    analysis functions. Returns a structured response.
    """
    lower = query.lower()

    # "why is X failing/crashing/down"
    if "why" in lower:
        return _why_query(query)

    # "summarize" / "summary"
    if "summar" in lower:
        return _summarize_cluster()

    # "what changed" / "what happened"
    if "what changed" in lower or "what happened" in lower:
        return _what_changed()

    # "which pods are unhealthy/failing"
    if "unhealthy" in lower or "failing" in lower:
        return _unhealthy_pods()

    # "top consumers" / "resource hogs"
    if "top" in lower or "consumer" in lower or "hog" in lower:
        return _top_consumers()

    # "is X healthy"
    if "healthy" in lower or "status" in lower:
        return _health_check(query)

    return {
        "title": "🤖 AI Assistant",
        "content": (
            "I can help with:\n\n"
            "  • [cyan]why is <pod> failing[/cyan]\n"
            "  • [cyan]summarize cluster health[/cyan]\n"
            "  • [cyan]what changed in last hour[/cyan]\n"
            "  • [cyan]which pods are unhealthy[/cyan]\n"
            "  • [cyan]top resource consumers[/cyan]\n"
            "  • [cyan]is <deployment> healthy[/cyan]\n"
        ),
        "severity": "info",
    }


def _why_query(query):
    """Analyze why a specific resource is failing."""
    words = query.lower().replace("?", "").split()

    # Extract resource name (word after "is" or last word)
    target = None
    for i, w in enumerate(words):
        if w == "is" and i + 1 < len(words):
            target = words[i + 1]
            break

    if not target:
        # Try last meaningful word
        skip = {
            "why", "is", "failing", "crashing",
            "down", "broken", "not", "working",
            "the", "my"
        }
        for w in reversed(words):
            if w not in skip:
                target = w
                break

    if not target:
        return {
            "title": "🤖 Analysis",
            "content": "Please specify a pod or deployment name.",
            "severity": "info",
        }

    # Resolve pod
    matches = resolve_pod_name(target)
    if not matches:
        return {
            "title": "🤖 Analysis",
            "content": (
                f"No pods matching '{target}' found."
            ),
            "severity": "warning",
        }

    pod_name = matches[0]
    data = collect_diagnosis(pod_name)
    if not data:
        return {
            "title": "🤖 Analysis",
            "content": f"Could not inspect '{pod_name}'.",
            "severity": "warning",
        }

    findings = diagnose(data)

    # Build explanation
    critical = [
        f for f in findings if f["severity"] == "critical"
    ]
    warnings = [
        f for f in findings if f["severity"] == "warning"
    ]

    if not critical and not warnings:
        return {
            "title": f"🤖 {pod_name}",
            "content": (
                f"[green]Pod appears healthy.[/green]\n"
                f"No critical issues detected."
            ),
            "severity": "healthy",
        }

    lines = [f"[bold]Analysis for {pod_name}:[/bold]\n"]

    if critical:
        lines.append("[bold red]Root Causes:[/bold red]")
        for f in critical:
            lines.append(
                f"  ❌ {f['title']}\n"
                f"     {f['detail']}\n"
                f"     [dim]→ {f['action']}[/dim]"
            )

    if warnings:
        lines.append("\n[bold yellow]Warnings:[/bold yellow]")
        for f in warnings:
            lines.append(
                f"  ⚠️  {f['title']}\n"
                f"     [dim]→ {f['action']}[/dim]"
            )

    return {
        "title": f"🤖 Why is {target} failing?",
        "content": "\n".join(lines),
        "severity": "critical" if critical else "warning",
    }


def _summarize_cluster():
    """Produce a cluster health summary."""
    pods = collect_pods()
    nodes = collect_nodes()
    deployments = collect_deployments()
    events = collect_events(limit=50)

    total_pods = len(pods)
    running = sum(
        1 for p in pods if p["status"] == "Running"
    )
    crashing = sum(
        1 for p in pods if p["restarts"] >= 5
    )
    pending = sum(
        1 for p in pods if p["status"] == "Pending"
    )

    total_nodes = len(nodes)
    ready_nodes = sum(
        1 for n in nodes if n["ready"]
    )

    total_deps = len(deployments)
    healthy_deps = sum(
        1 for d in deployments
        if d["available"] >= d["desired"]
    )

    warning_events = sum(
        1 for e in events if e["type"] == "Warning"
    )

    # Determine overall health
    if crashing > 0 or pending > 0 or ready_nodes < total_nodes:
        overall = "[bold yellow]DEGRADED[/bold yellow]"
    elif warning_events > 10:
        overall = "[bold yellow]NOISY[/bold yellow]"
    else:
        overall = "[bold green]HEALTHY[/bold green]"

    lines = [
        f"[bold]Cluster Status:[/bold] {overall}\n",
        f"[cyan]Pods:[/cyan]        "
        f"{running}/{total_pods} running",
    ]

    if crashing:
        lines.append(
            f"             [red]{crashing} crash-looping[/red]"
        )
    if pending:
        lines.append(
            f"             [yellow]{pending} pending[/yellow]"
        )

    lines.extend([
        f"[cyan]Nodes:[/cyan]       "
        f"{ready_nodes}/{total_nodes} ready",
        f"[cyan]Deployments:[/cyan] "
        f"{healthy_deps}/{total_deps} healthy",
        f"[cyan]Events:[/cyan]      "
        f"{warning_events} warnings in recent events",
    ])

    # Actionable insights
    if crashing or pending or warning_events > 5:
        lines.append("\n[bold]Suggested Actions:[/bold]")
        if crashing:
            lines.append(
                "  → Run [cyan]diagnose <pod>[/cyan] "
                "on crash-looping pods"
            )
        if pending:
            lines.append(
                "  → Check node resources: "
                "[cyan]top nodes[/cyan]"
            )
        if warning_events > 5:
            lines.append(
                "  → Review events: "
                "[cyan]events[/cyan]"
            )

    return {
        "title": "🤖 Cluster Summary",
        "content": "\n".join(lines),
        "severity": "info",
    }


def _what_changed():
    """Analyze recent events for changes."""
    events = collect_events(limit=50)

    if not events:
        return {
            "title": "🤖 Recent Changes",
            "content": "No recent events found.",
            "severity": "info",
        }

    # Group by reason
    reasons = {}
    for ev in events:
        reason = ev["reason"]
        if reason not in reasons:
            reasons[reason] = []
        reasons[reason].append(ev)

    lines = ["[bold]Recent Activity:[/bold]\n"]

    # Highlight important changes
    important = [
        "Killing", "Pulled", "Created",
        "Started", "ScalingReplicaSet",
        "SuccessfulDelete", "FailedScheduling",
        "BackOff"
    ]

    for reason in important:
        if reason in reasons:
            evs = reasons[reason]
            objects = set(e["object"] for e in evs)
            lines.append(
                f"  • [cyan]{reason}[/cyan] "
                f"({len(evs)}×) — "
                f"{', '.join(list(objects)[:3])}"
            )

    # Warnings summary
    warnings = [
        e for e in events if e["type"] == "Warning"
    ]
    if warnings:
        lines.append(
            f"\n[yellow]⚠ {len(warnings)} warning "
            f"events[/yellow]"
        )
        unique_warnings = set(
            e["reason"] for e in warnings
        )
        for w in unique_warnings:
            count = sum(
                1 for e in warnings
                if e["reason"] == w
            )
            lines.append(f"    {w}: {count}×")

    return {
        "title": "🤖 What Changed",
        "content": "\n".join(lines),
        "severity": "info",
    }


def _unhealthy_pods():
    """List all unhealthy pods with reasons."""
    pods = collect_pods()

    unhealthy = [
        p for p in pods
        if p["status"] != "Running" or p["restarts"] >= 3
    ]

    if not unhealthy:
        return {
            "title": "🤖 Pod Health",
            "content": (
                "[green]All pods are healthy![/green]"
            ),
            "severity": "healthy",
        }

    lines = [
        f"[bold]{len(unhealthy)} unhealthy pods:[/bold]\n"
    ]

    for pod in sorted(
        unhealthy, key=lambda x: -x["restarts"]
    ):
        if pod["status"] != "Running":
            lines.append(
                f"  ❌ {pod['name']}\n"
                f"     Status: [red]{pod['status']}[/red]"
            )
        else:
            lines.append(
                f"  ⚠️  {pod['name']}\n"
                f"     Restarts: "
                f"[yellow]{pod['restarts']}[/yellow]"
            )

    lines.append(
        "\n[dim]Run: diagnose <pod> for details[/dim]"
    )

    return {
        "title": "🤖 Unhealthy Pods",
        "content": "\n".join(lines),
        "severity": "warning",
    }


def _top_consumers():
    """Show top resource consumers."""
    pods = top_pods()

    if not pods:
        return {
            "title": "🤖 Resource Usage",
            "content": (
                "No metrics available. "
                "Is metrics-server running?"
            ),
            "severity": "warning",
        }

    lines = ["[bold]Top Resource Consumers:[/bold]\n"]
    lines.append("[cyan]By CPU:[/cyan]")
    for pod in pods[:5]:
        lines.append(
            f"  {pod['cpu']:>8}  {pod['name']}"
        )

    # Sort by memory
    by_mem = sorted(
        pods, key=lambda x: x["memory_mb"],
        reverse=True
    )
    lines.append("\n[cyan]By Memory:[/cyan]")
    for pod in by_mem[:5]:
        lines.append(
            f"  {pod['memory']:>8}  {pod['name']}"
        )

    return {
        "title": "🤖 Top Consumers",
        "content": "\n".join(lines),
        "severity": "info",
    }


def _health_check(query):
    """Check health of a specific resource."""
    words = query.lower().replace("?", "").split()

    skip = {
        "is", "healthy", "status", "the",
        "of", "my", "check", "what"
    }
    target = None
    for w in words:
        if w not in skip:
            target = w
            break

    if not target:
        return _summarize_cluster()

    matches = resolve_pod_name(target)
    if not matches:
        return {
            "title": "🤖 Health Check",
            "content": f"No pods matching '{target}'.",
            "severity": "info",
        }

    pod_name = matches[0]
    data = collect_diagnosis(pod_name)
    if not data:
        return {
            "title": "🤖 Health Check",
            "content": f"Could not inspect '{pod_name}'.",
            "severity": "warning",
        }

    findings = diagnose(data)
    critical = sum(
        1 for f in findings if f["severity"] == "critical"
    )
    warnings = sum(
        1 for f in findings if f["severity"] == "warning"
    )

    if critical:
        status = "[bold red]CRITICAL[/bold red]"
    elif warnings:
        status = "[bold yellow]DEGRADED[/bold yellow]"
    else:
        status = "[bold green]HEALTHY[/bold green]"

    details = data["details"]
    content = (
        f"[bold]{pod_name}[/bold]: {status}\n\n"
        f"  Phase:    {details['phase']}\n"
        f"  Node:     {details['node']}\n"
        f"  Restarts: "
        f"{details['containers'][0]['restarts'] if details['containers'] else 0}\n"
        f"  Age:      {details['age']}\n"
    )

    if critical or warnings:
        content += "\n[dim]Run: diagnose " + target + "[/dim]"

    return {
        "title": f"🤖 {pod_name}",
        "content": content,
        "severity": (
            "critical" if critical
            else "warning" if warnings
            else "healthy"
        ),
    }
