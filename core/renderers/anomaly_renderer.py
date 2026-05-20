"""
Anomaly Renderer — alerts, playbooks, and correlation chains
with severity indicators and actionable next steps.
"""

from rich.console import Console
from rich.panel import Panel
from rich.table import Table

console = Console()

from core.theme import t


def render_anomalies(alerts):
    if not alerts:
        console.print(
            Panel(
                "[green]  ✓ No anomalies detected — "
                "cluster is operating normally[/green]",
                title="[bold]🔔 Alerts[/bold]",
                border_style=t()["success"],
            )
        )
        return

    critical = sum(1 for a in alerts if a["severity"] == "critical")
    warnings = sum(1 for a in alerts if a["severity"] == "warning")
    border = "red" if critical else "yellow"

    # Summary
    parts = [f"[bold]{len(alerts)}[/bold] anomalies"]
    if critical:
        parts.append(f"[red]● {critical} critical[/red]")
    if warnings:
        parts.append(f"[yellow]● {warnings} warnings[/yellow]")

    console.print(Panel.fit("  │  ".join(parts), border_style=border))

    # Alerts as individual cards
    for i, alert in enumerate(alerts, 1):
        sev = alert["severity"]
        color = "red" if sev == "critical" else "yellow"
        icon = "●" if sev == "critical" else "●"

        lines = [
            f"[{color}]{icon}[/{color}] "
            f"[bold {color}]{alert['title']}[/bold {color}]",
        ]

        if alert.get("detail"):
            lines.append(f"  [dim]│[/dim] {alert['detail']}")

        if alert.get("action"):
            lines.append(f"  [dim]└─[/dim] [italic]→ {alert['action']}[/italic]")

        console.print(
            Panel(
                "\n".join(lines),
                title=f"[dim]#{i}[/dim] [{color}]{sev.upper()}[/{color}]",
                border_style=color,
                padding=(0, 1),
            )
        )

    # Footer hint
    if critical:
        console.print(
            "\n[dim]  Run [cyan]diagnose <pod>[/cyan] "
            "for root cause analysis[/dim]"
        )


def render_playbook(playbook):
    if not playbook:
        console.print("[dim]No playbook found[/dim]")
        return

    steps = []
    for i, step in enumerate(playbook["steps"], 1):
        # Detect if step contains a command (cyan markers)
        if "[cyan]" in step or "kubectl" in step:
            steps.append(
                f"  [bold]{i}.[/bold] {step}"
            )
        else:
            steps.append(f"  [dim]{i}.[/dim] {step}")

    content = "\n".join(steps)

    console.print(
        Panel(
            content,
            title=f"[bold]📖 {playbook['title']}[/bold]",
            border_style=t()["primary"],
            padding=(1, 2),
        )
    )

    # Footer
    console.print(
        f"[dim]  {len(playbook['steps'])} steps — "
        f"follow in order for best results[/dim]"
    )


def render_correlations(chains):
    if not chains:
        console.print("[dim]No correlations found[/dim]")
        return

    console.print(
        Panel.fit(
            f"[bold]{len(chains)}[/bold] correlation chains",
            border_style=t()["primary"],
        )
    )

    for chain in chains:
        status = chain.get("status", "Unknown")
        status_color = (
            "green" if status == "Running"
            else "red" if status in ("CrashLoopBackOff", "Error")
            else "yellow"
        )

        lines = [
            f"[bold]{chain['pod']}[/bold]  "
            f"[{status_color}]{status}[/{status_color}]",
            "",
        ]

        for i, link in enumerate(chain.get("links", [])):
            is_last = i == len(chain["links"]) - 1
            connector = "└─" if is_last else "├─"

            if link["type"] == "event":
                icon = "⚡"
            elif link["type"] == "deployment":
                icon = "🚀"
            else:
                icon = "•"

            lines.append(
                f"  {connector} {icon} {link['source']}: "
                f"[dim]{link['detail']}[/dim]"
            )

        lines.append("")
        lines.append(
            f"  [bold cyan]Root Cause:[/bold cyan] "
            f"{chain.get('root_cause', 'Unknown')}"
        )

        border = "red" if status != "Running" else "yellow"

        console.print(
            Panel(
                "\n".join(lines),
                title="[bold]🔗 Correlation[/bold]",
                border_style=border,
            )
        )
