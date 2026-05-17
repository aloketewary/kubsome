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
    from core.nlp.matcher import parse_query
    from core.context import context

    parsed = parse_query(query)

    intent = parsed["intent"] if parsed else None
    entities = parsed["entities"] if parsed else {}
    target = entities.get("target")

    # Update conversation memory
    if target:
        context.remember_target(target)
    context.last_intent = intent

    if intent == "count_pods":
        return _count_pods(query, target)

    if intent == "why_failing":
        return _why_query(query, target)

    if intent == "diagnose":
        if not target:
            return _high_restart_pods()
        return _why_query(query, target)

    if intent == "recommend":
        return _recommend_next_steps()

    if intent == "summarize":
        return _summarize_cluster()

    if intent == "what_changed":
        return _what_changed()

    if intent == "unhealthy":
        return _unhealthy_pods()

    if intent == "top_pods":
        return _top_consumers()

    if intent == "events":
        return _warning_events()

    if intent == "anomalies":
        return _anomaly_check()

    if intent == "health_check":
        return _health_check(query, target)

    if intent == "is_safe":
        return _why_query(query, target)

    if intent == "inspect" and target:
        return _why_query(query, target)

    if intent == "logs" and target:
        return _pod_logs_summary(target)

    if intent == "trace" and target:
        return _why_query(query, target)

    if intent == "describe" and target:
        return _why_query(query, target)

    # "How to" questions → explain module
    lower = query.lower()
    if _is_howto_query(lower):
        from core.ai.explain import explain
        return explain(query)

    # Fallback
    from core.incident.manager import get_active
    active_incident = get_active()

    if active_incident:
        return {
            "title": "🚨 Active Incident",
            "content": (
                f"[bold red]Tracking: {active_incident['title']}[/bold red]\n"
                f"Started: [dim]{active_incident['started'][:19].replace('T', ' ')}[/dim]\n\n"
                f"I am in [bold]Incident Mode[/bold]. I can help you record your investigation:\n\n"
                "  • [cyan]note <text>[/cyan] — add an observation\n"
                "  • [cyan]snapshot[/cyan] — capture current state\n"
                "  • [cyan]incident stop[/cyan] — resolve & export report\n\n"
                "[bold]Contextual Queries:[/bold]\n"
                "  • [cyan]what changed recently[/cyan]\n"
                "  • [cyan]diagnose unhealthy pods[/cyan]\n"
            ),
            "severity": "critical",
        }

    return {
        "title": "🤖 AI Assistant",
        "content": (
            "I can help with:\n\n"
            "  [bold]DIAGNOSE[/bold]\n"
            "  • [cyan]why is <pod> failing[/cyan]\n"
            "  • [cyan]diagnose high restart pods[/cyan]\n"
            "  • [cyan]which pods are unhealthy[/cyan]\n\n"
            "  [bold]ANALYZE[/bold]\n"
            "  • [cyan]summarize cluster health[/cyan]\n"
            "  • [cyan]recommend next steps[/cyan] [dim](NEW)[/dim]\n"
            "  • [cyan]top resource consumers[/cyan]\n\n"
            "  [bold]INVESTIGATE[/bold]\n"
            "  • [cyan]what changed recently[/cyan]\n"
            "  • [cyan]show warning events[/cyan]\n"
            "  • [cyan]any anomalies detected[/cyan]\n"
        ),
        "severity": "info",
    }


def get_follow_up_suggestions(intent, target=None):
    """
    Return contextual follow-up questions based on
    the intent that was just answered.
    Uses conversation memory for richer suggestions.
    """
    from core.context import context

    # Use conversation memory if no explicit target
    if not target and context.last_target:
        target = context.last_target

    suggestions = {
        "why_failing": [
            f"show logs for {target}" if target else "show warning events",
            f"is it safe to restart {target}" if target else "which pods are unhealthy",
            "what changed recently",
        ],
        "count_pods": [
            "which pods are unhealthy",
            "summarize cluster health",
            "top resource consumers",
        ],
        "summarize": [
            "any anomalies detected",
            "what changed recently",
            "top resource consumers",
        ],
        "unhealthy": [
            f"diagnose {target}" if target else "diagnose high restart pods",
            "what changed recently",
            "show warning events",
        ],
        "what_changed": [
            "any anomalies detected",
            "which pods are unhealthy",
            "summarize cluster health",
        ],
        "anomalies": [
            "which pods are unhealthy",
            "what changed recently",
            "summarize cluster health",
        ],
        "top_pods": [
            "any anomalies detected",
            "which pods are unhealthy",
            "summarize cluster health",
        ],
        "health_check": [
            f"diagnose {target}" if target else "summarize cluster health",
            f"logs for {target}" if target else "show warning events",
            "any anomalies detected",
        ],
        "logs": [
            f"diagnose {target}" if target else "which pods are unhealthy",
            f"why is {target} failing" if target else "any anomalies",
            "what changed recently",
        ],
        "inspect": [
            f"diagnose {target}" if target else "which pods are unhealthy",
            f"trace {target}" if target else "summarize cluster health",
            "show warning events",
        ],
    }
    return suggestions.get(intent, [])


def _count_pods(query, target=None):
    """Count pods matching a name pattern."""
    if not target or target in {
        "pods", "total", "all", "the", "running",
    }:
        # General count
        pods = collect_pods()
        running = sum(
            1 for p in pods
            if p["status"] in {"Running", "Succeeded", "Completed"}
        )
        return {
            "title": "🤖 Pod Count",
            "content": (
                f"[bold]Total pods:[/bold] {len(pods)}\n"
                f"  [green]● Running:[/green] {running}\n"
                f"  [yellow]● Other:[/yellow] "
                f"{len(pods) - running}"
            ),
            "severity": "info",
        }

    pods = collect_pods()
    matching = [
        p for p in pods
        if target in p["name"].lower()
    ]

    if not matching:
        return {
            "title": f"🤖 {target} pods",
            "content": (
                f"No pods matching '{target}' found."
            ),
            "severity": "info",
        }

    running = [
        p for p in matching
        if p["status"] in {"Running", "Succeeded", "Completed"}
    ]
    not_running = [
        p for p in matching
        if p["status"] not in {"Running", "Succeeded", "Completed"}
    ]

    lines = [
        f"[bold]{len(matching)} pods matching "
        f"'{target}':[/bold]\n",
        f"  [green]● Running:[/green] {len(running)}",
    ]

    if not_running:
        lines.append(
            f"  [red]● Not running:[/red] "
            f"{len(not_running)}"
        )

    lines.append("\n[bold]Pods:[/bold]")
    for p in matching:
        status_color = (
            "green" if p["status"] == "Running"
            else "red"
        )
        restart_info = (
            f" (R:{p['restarts']})"
            if p["restarts"] > 0 else ""
        )
        lines.append(
            f"  [{status_color}]●[/{status_color}] "
            f"{p['name']} "
            f"[dim]{p['status']}{restart_info}[/dim]"
        )

    return {
        "title": f"🤖 {target} pods",
        "content": "\n".join(lines),
        "severity": "info",
    }


def _why_query(query, target=None):
    """Analyze why a specific resource is failing."""
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

    # Fetch logs for error detection
    logs = pod_logs(pod_name, tail=50)
    log_errors = [
        l for l in logs
        if any(x in l.lower() for x in [
            "error", "fail", "exception", "fatal", "panic"
        ])
    ]

    # Fetch events
    events = pod_events(pod_name)
    warning_events = [
        e for e in events if e["type"] == "Warning"
    ]

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
        lines.append("[bold red]⛔ Root Causes:[/bold red]")
        for f in critical:
            lines.append(
                f"  ❌ {f['title']}\n"
                f"     {_truncate(f['detail'], 120)}\n"
                f"     [dim]→ {f['action']}[/dim]"
            )

    if warnings:
        lines.append("\n[bold yellow]⚠ Warnings:[/bold yellow]")
        for f in warnings:
            lines.append(
                f"  ⚠️  {f['title']}\n"
                f"     [dim]→ {f['action']}[/dim]"
            )

    # Add evidence from logs
    if log_errors:
        lines.append(
            f"\n[bold red]📋 Log Evidence "
            f"({len(log_errors)} errors):[/bold red]"
        )
        for l in log_errors[:3]:
            lines.append(
                f"  [dim]{_truncate(l.strip(), 100)}[/dim]"
            )

    # Add summarized events
    if warning_events:
        lines.append(
            _format_warning_events(warning_events)
        )

    # Suggested next steps
    lines.append("\n[bold]💡 Next Steps:[/bold]")
    lines.extend(_suggest_actions(critical, warnings))

    return {
        "title": f"🤖 Why is {target} failing?",
        "content": "\n".join(lines),
        "severity": "critical" if critical else "warning",
    }


def _truncate(text, max_len=100):
    """Truncate text to max_len with ellipsis."""
    if len(text) <= max_len:
        return text
    return text[:max_len - 3] + "..."


def _is_howto_query(lower):
    """Detect 'how to configure/setup/add' type questions."""
    howto_patterns = [
        "how to ", "how do i ", "how can i ",
        "configure ", "setup ", "set up ",
        "add probe", "add liveness", "add readiness",
        "what is ", "what are ",
        "explain ",
    ]
    return any(p in lower for p in howto_patterns)


def _format_warning_events(warning_events):
    """Summarize warning events intelligently."""
    # Deduplicate by reason
    by_reason = {}
    for e in warning_events:
        reason = e["reason"]
        if reason not in by_reason:
            by_reason[reason] = []
        by_reason[reason].append(e)

    lines = [
        f"\n[bold yellow]📡 Warning Events "
        f"({len(warning_events)}):[/bold yellow]"
    ]

    for reason, evts in by_reason.items():
        count_label = (
            f" (×{len(evts)})" if len(evts) > 1 else ""
        )
        lines.append(
            f"  ⚠️  [yellow]{reason}[/yellow]{count_label}"
        )
        # Summarize the message instead of dumping raw
        msg = evts[0]["message"]
        summary = _summarize_event_message(reason, msg)
        lines.append(f"     {summary}")

    return "\n".join(lines)


def _summarize_event_message(reason, message):
    """Extract key info from verbose event messages."""
    import re

    if reason == "FailedScheduling":
        # Extract key constraints from scheduling message
        parts = []
        # Check for insufficient resources
        insuf = re.findall(
            r"(\d+) Insufficient (\w+)", message
        )
        for count, resource in insuf:
            parts.append(
                f"[red]{count} node(s) insufficient "
                f"{resource}[/red]"
            )
        # Count tainted nodes
        taints = re.findall(
            r"(\d+) node\(s\) had untolerated taint "
            r"\{workload: ([^}]+)\}",
            message
        )
        if taints:
            total_tainted = sum(int(t[0]) for t in taints)
            taint_names = [t[1] for t in taints[:3]]
            more = (
                f" +{len(taints) - 3} more"
                if len(taints) > 3 else ""
            )
            parts.append(
                f"{total_tainted} node(s) tainted "
                f"[dim]({', '.join(taint_names)}"
                f"{more})[/dim]"
            )
        # Check for other conditions
        not_ready = re.search(
            r"(\d+) node\(s\) had untolerated taint "
            r"\{node.kubernetes.io/not-ready",
            message
        )
        if not_ready:
            parts.append(
                f"{not_ready.group(1)} node(s) not ready"
            )
        # Total nodes
        total = re.search(
            r"0/(\d+) nodes are available", message
        )
        if total:
            parts.insert(
                0,
                f"[bold]0/{total.group(1)} nodes "
                f"available[/bold]"
            )

        if parts:
            return "\n     ".join(parts)
        return _truncate(message, 120)

    if reason == "BackOff":
        return _truncate(message, 120)

    if reason == "FailedMount":
        return _truncate(message, 120)

    if reason == "FailedToRetrieveImagePullSecret":
        return "Image pull secret not found or inaccessible"

    if reason == "FailedGetScale":
        return _truncate(message, 120)

    # Default: truncate long messages
    return _truncate(message, 120)


def _suggest_actions(critical, warnings):
    """Generate actionable next steps from findings."""
    actions = []
    seen = set()

    for f in critical + warnings:
        title_lower = f["title"].lower()
        if "schedul" in title_lower and "scheduling" not in seen:
            seen.add("scheduling")
            actions.append(
                "  → Check node capacity: "
                "[cyan]capacity[/cyan]"
            )
            actions.append(
                "  → Review taints/tolerations in "
                "deployment spec"
            )
        elif "oom" in title_lower and "oom" not in seen:
            seen.add("oom")
            actions.append(
                "  → Increase memory limits or "
                "optimize app memory"
            )
            actions.append(
                "  → Check usage: "
                "[cyan]top pods[/cyan]"
            )
        elif "crash" in title_lower and "crash" not in seen:
            seen.add("crash")
            actions.append(
                "  → Check logs: "
                "[cyan]logs <pod>[/cyan]"
            )
            actions.append(
                "  → Review startup probes"
            )
        elif "image" in title_lower and "image" not in seen:
            seen.add("image")
            actions.append(
                "  → Verify image exists and "
                "pull secrets are configured"
            )

    if not actions:
        actions.append(
            "  → Run [cyan]inspect <pod>[/cyan] "
            "for full details"
        )
        actions.append(
            "  → Check [cyan]events[/cyan] "
            "for cluster-wide issues"
        )

    return actions


def _summarize_cluster():
    """Produce a cluster health summary."""
    pods = collect_pods()
    nodes = collect_nodes()
    deployments = collect_deployments()
    events = collect_events(limit=50)

    total_pods = len(pods)
    running = sum(
        1 for p in pods
        if p["status"] in {"Running", "Succeeded", "Completed"}
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

    healthy_statuses = {"Running", "Succeeded", "Completed"}
    unhealthy = [
        p for p in pods
        if p["status"] not in healthy_statuses or p["restarts"] >= 3
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


def _high_restart_pods():
    """Find pods with high restart counts."""
    pods = collect_pods()

    high_restart = sorted(
        [p for p in pods if p["restarts"] >= 3],
        key=lambda x: -x["restarts"]
    )

    if not high_restart:
        return {
            "title": "🤖 Restart Analysis",
            "content": "[green]No pods with high restarts.[/green]",
            "severity": "healthy",
        }

    lines = [
        f"[bold]{len(high_restart)} pods with high restarts:[/bold]\n"
    ]

    for pod in high_restart[:10]:
        severity = "red" if pod["restarts"] >= 10 else "yellow"
        lines.append(
            f"  [{severity}]● {pod['restarts']:>3} restarts[/{severity}]  "
            f"{pod['name']}"
        )

    lines.append(
        "\n[bold]Possible causes:[/bold]"
        "\n  • Application crash on startup"
        "\n  • OOM kills (check memory limits)"
        "\n  • Failed health probes"
        "\n  • Missing config/secrets"
        "\n\n[dim]Run: diagnose <pod> for root cause[/dim]"
    )

    return {
        "title": "🤖 High Restart Pods",
        "content": "\n".join(lines),
        "severity": "warning",
    }


def _warning_events():
    """Show recent warning events."""
    events = collect_events(limit=50)

    warnings = [
        e for e in events if e["type"] == "Warning"
    ]

    if not warnings:
        return {
            "title": "🤖 Events",
            "content": "[green]No warning events.[/green]",
            "severity": "healthy",
        }

    # Group by reason
    reasons = {}
    for e in warnings:
        r = e["reason"]
        if r not in reasons:
            reasons[r] = []
        reasons[r].append(e)

    lines = [
        f"[bold]{len(warnings)} warning events:[/bold]\n"
    ]

    for reason, evs in sorted(
        reasons.items(), key=lambda x: -len(x[1])
    ):
        objects = set(e["object"] for e in evs)
        lines.append(
            f"  [yellow]● {reason}[/yellow] ({len(evs)}×)"
        )
        for obj in list(objects)[:3]:
            lines.append(f"    [dim]{obj}[/dim]")

    lines.append(
        "\n[dim]Run: events watch for live stream[/dim]"
    )

    return {
        "title": "🤖 Warning Events",
        "content": "\n".join(lines),
        "severity": "warning",
    }


def _anomaly_check():
    """Quick anomaly detection."""
    from core.ai.anomaly import detect_anomalies

    alerts = detect_anomalies()

    if not alerts:
        return {
            "title": "🤖 Anomaly Check",
            "content": "[green]✓ No anomalies detected.[/green]",
            "severity": "healthy",
        }

    critical = [a for a in alerts if a["severity"] == "critical"]
    warnings = [a for a in alerts if a["severity"] == "warning"]

    lines = [
        f"[bold]{len(alerts)} anomalies detected:[/bold]\n"
    ]

    for a in critical:
        lines.append(
            f"  [red]● {a['title']}[/red]\n"
            f"    {a['detail']}\n"
            f"    [dim]→ {a['action']}[/dim]"
        )

    for a in warnings:
        lines.append(
            f"  [yellow]● {a['title']}[/yellow]\n"
            f"    {a['detail']}"
        )

    return {
        "title": "🤖 Anomalies",
        "content": "\n".join(lines),
        "severity": "critical" if critical else "warning",
    }


def _pod_logs_summary(target):
    """Show recent log errors for a pod."""
    matches = resolve_pod_name(target)
    if not matches:
        return {
            "title": "🤖 Logs",
            "content": f"No pods matching '{target}' found.",
            "severity": "warning",
        }

    pod_name = matches[0]
    logs = pod_logs(pod_name, tail=30)

    if not logs or not logs.strip():
        return {
            "title": f"🤖 Logs: {pod_name}",
            "content": "No recent logs available.",
            "severity": "info",
        }

    lines_list = logs.strip().split("\n")
    errors = [
        l for l in lines_list
        if any(x in l.lower() for x in [
            "error", "fail", "exception", "fatal", "panic"
        ])
    ]

    content_lines = [
        f"[bold]{pod_name}[/bold] — last {len(lines_list)} lines\n"
    ]

    if errors:
        content_lines.append(
            f"[red]{len(errors)} error lines found:[/red]\n"
        )
        for e in errors[:5]:
            content_lines.append(f"  [dim]{e.strip()[:100]}[/dim]")
    else:
        content_lines.append("[green]No errors in recent logs.[/green]")
        content_lines.append("\n[dim]Last 3 lines:[/dim]")
        for l in lines_list[-3:]:
            content_lines.append(f"  [dim]{l.strip()[:100]}[/dim]")

    return {
        "title": f"🤖 Logs: {pod_name}",
        "content": "\n".join(content_lines),
        "severity": "warning" if errors else "info",
    }


def _health_check(query, target=None):
    """Check health of a specific resource."""
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


def _recommend_next_steps():
    """Aggregate insights to recommend operational improvements."""
    from core.collectors.scorecard import cluster_scorecard
    from core.collectors.cost import resource_recommendations
    from core.collectors.security import security_scan
    from core.ai.anomaly import detect_anomalies

    scorecard = cluster_scorecard()
    anomalies = detect_anomalies()
    costs = resource_recommendations()
    security = security_scan()

    lines = [
        "[bold]Operational Recommendations:[/bold]\n",
    ]

    # 1. Critical Anomalies First
    critical_anomalies = [
        a for a in anomalies if a["severity"] == "critical"
    ]
    if critical_anomalies:
        lines.append("[bold red]⛔ Critical Issues (Fix Now):[/bold red]")
        for a in critical_anomalies[:2]:
            lines.append(f"  • {a['title']}: [dim]{a['action']}[/dim]")
        lines.append("")

    # 2. Scorecard Insights
    if scorecard["overall_score"] < 90:
        lines.append(
            f"[bold]📈 Cluster Health (Grade: {scorecard['overall_grade']}):[/bold]"
        )
        for rec in scorecard["recommendations"][:2]:
            lines.append(f"  • {rec['issue']}: [cyan]{rec['action']}[/cyan]")
        lines.append("")

    # 3. Cost Savings (Growth/ROI)
    potential_savings = sum(
        r.get("savings_monthly", 0) for r in costs
    )
    if potential_savings > 0:
        lines.append("[bold green]💰 Potential Savings:[/bold green]")
        lines.append(
            f"  You can save approximately [green]${potential_savings}/mo[/green] "
            "by right-sizing workloads."
        )
        lines.append("  → Run [cyan]optimize[/cyan] to see details.\n")

    # 4. Security Wins
    critical_security = [
        f for f in security if f["severity"] == "critical"
    ]
    if critical_security:
        lines.append("[bold yellow]🔒 Security Hardening:[/bold yellow]")
        lines.append(
            f"  Found {len(critical_security)} critical security misconfigurations."
        )
        lines.append("  → Run [cyan]security[/cyan] to review.\n")

    if len(lines) <= 2:
        return {
            "title": "🤖 Recommendations",
            "content": (
                "[green]✓ Your cluster looks great![/green]\n\n"
                "I don't have any major recommendations at the moment. "
                "Keep monitoring with [cyan]overview[/cyan]."
            ),
            "severity": "healthy",
        }

    return {
        "title": "🤖 Operational Recommendations",
        "content": "\n".join(lines),
        "severity": "info",
    }
