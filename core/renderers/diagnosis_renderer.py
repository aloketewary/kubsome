"""
Diagnosis Renderer — root cause analysis output with health score,
prioritized findings, actionable remediation steps, and playbook links.
"""

from rich.console import Console
from rich.panel import Panel
from rich.table import Table

console = Console()

SEVERITY_CONFIG = {
    "critical": {"color": "red", "icon": "●", "label": "CRITICAL", "weight": 30},
    "warning": {"color": "yellow", "icon": "●", "label": "WARNING", "weight": 10},
    "info": {"color": "cyan", "icon": "○", "label": "INFO", "weight": 2},
    "healthy": {"color": "green", "icon": "✓", "label": "HEALTHY", "weight": 0},
}


def render_diagnosis(pod_name, findings):
    # ─── Count by severity ───
    counts = {"critical": 0, "warning": 0, "info": 0}
    for f in findings:
        sev = f.get("severity", "info")
        if sev in counts:
            counts[sev] += 1

    critical = counts["critical"]
    warnings = counts["warning"]
    info = counts["info"]
    total_issues = critical + warnings + info

    # ─── Health score ───
    if total_issues == 0:
        health_pct = 100
    else:
        health_pct = max(0, 100 - (
            critical * SEVERITY_CONFIG["critical"]["weight"]
            + warnings * SEVERITY_CONFIG["warning"]["weight"]
            + info * SEVERITY_CONFIG["info"]["weight"]
        ))

    # Status determination
    if critical > 0:
        status_label = "[bold red]CRITICAL[/bold red]"
        border = "red"
        grade = "F" if health_pct < 30 else "D"
    elif warnings > 0:
        status_label = "[bold yellow]DEGRADED[/bold yellow]"
        border = "yellow"
        grade = "C" if health_pct < 60 else "B"
    else:
        status_label = "[bold green]HEALTHY[/bold green]"
        border = "green"
        grade = "A"

    # Health bar (20 chars wide)
    bar_width = 20
    filled = int((health_pct / 100) * bar_width)
    if health_pct > 70:
        bar_color = "green"
    elif health_pct > 40:
        bar_color = "yellow"
    else:
        bar_color = "red"

    bar = (
        f"[{bar_color}]" + "█" * filled + f"[/{bar_color}]"
        + "[dim]" + "░" * (bar_width - filled) + "[/dim]"
    )

    # Grade badge
    grade_colors = {"A": "green", "B": "green", "C": "yellow", "D": "red", "F": "red"}
    gc = grade_colors.get(grade, "white")
    grade_badge = f"[bold {gc}]{grade}[/bold {gc}]"

    # ─── Header panel ───
    header = (
        f"[bold]{pod_name}[/bold]\n"
        f"\n"
        f"  Status:  {status_label}    Grade: {grade_badge}\n"
        f"  Health:  {bar}  {health_pct}%\n"
        f"\n"
        f"  [red]● {critical} critical[/red]  "
        f"[yellow]● {warnings} warnings[/yellow]  "
        f"[cyan]○ {info} info[/cyan]"
    )

    console.print(
        Panel(
            header,
            title="[bold]🔬 Diagnosis[/bold]",
            border_style=border,
        )
    )

    # ─── Findings ───
    if total_issues == 0:
        console.print(
            Panel(
                "[green]  ✓ No issues detected — pod is operating normally.[/green]\n"
                "[dim]  All health checks passed. No action required.[/dim]",
                border_style="green",
            )
        )
        return

    # Sort: critical first, then warning, then info
    sorted_findings = sorted(
        findings,
        key=lambda f: (
            {"critical": 0, "warning": 1, "info": 2, "healthy": 3}
            .get(f.get("severity", "info"), 3)
        )
    )

    # Render each finding as a numbered card
    for i, f in enumerate(sorted_findings, 1):
        sev = f.get("severity", "info")
        cfg = SEVERITY_CONFIG.get(sev, SEVERITY_CONFIG["info"])
        color = cfg["color"]
        icon = cfg["icon"]

        title = f.get("title", "Unknown issue")
        detail = f.get("detail", "")
        action = f.get("action", "")

        # Build finding content
        lines = [
            f"[{color}]{icon}[/{color}] "
            f"[bold {color}]{title}[/bold {color}]",
        ]

        if detail:
            lines.append(f"  [dim]│[/dim] {detail}")

        if action:
            lines.append(f"  [dim]│[/dim]")
            lines.append(
                f"  [dim]└─[/dim] [italic]→ {action}[/italic]"
            )

        content = "\n".join(lines)

        console.print(
            Panel(
                content,
                title=f"[dim]#{i}[/dim] [{color}]{cfg['label']}[/{color}]",
                border_style=color,
                padding=(0, 1),
            )
        )

    # ─── Summary footer ───
    console.print()

    # Quick actions
    if critical > 0:
        console.print(
            f"[dim]  Suggested next steps:[/dim]"
        )
        console.print(
            f"    [cyan]logs {pod_name}[/cyan]        "
            f"[dim]— check recent errors[/dim]"
        )
        console.print(
            f"    [cyan]events[/cyan]              "
            f"[dim]— review cluster events[/dim]"
        )
        console.print(
            f"    [cyan]playbook {_guess_playbook(findings)}[/cyan]  "
            f"[dim]— step-by-step remediation[/dim]"
        )
        console.print()
    elif warnings > 0:
        console.print(
            f"[dim]  Tip: run [cyan]playbook {_guess_playbook(findings)}[/cyan]"
            f" for guided remediation[/dim]"
        )
        console.print()


def _guess_playbook(findings):
    """Guess the most relevant playbook based on findings."""
    for f in findings:
        title = f.get("title", "").lower()
        if "oom" in title:
            return "OOMKilled"
        if "crash" in title or "backoff" in title:
            return "CrashLoopBackOff"
        if "image" in title and "pull" in title:
            return "ImagePullBackOff"
        if "pending" in title or "schedule" in title:
            return "FailedScheduling"
        if "restart" in title:
            return "HighRestarts"
        if "dns" in title:
            return "DNS"
        if "network" in title:
            return "NetworkPolicy"
        if "resource" in title or "cpu" in title or "memory" in title:
            return "ResourceExhaustion"
    return "CrashLoopBackOff"
