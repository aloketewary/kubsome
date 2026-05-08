from rich.console import Console
from rich.panel import Panel
from rich.table import Table

console = Console()

SEVERITY_STYLES = {
    "critical": ("red", "❌"),
    "warning": ("yellow", "⚠️ "),
    "info": ("cyan", "ℹ️ "),
    "healthy": ("green", "✓"),
}


def render_diagnosis(pod_name, findings):
    # Health score
    critical = sum(
        1 for f in findings if f["severity"] == "critical"
    )
    warnings = sum(
        1 for f in findings if f["severity"] == "warning"
    )
    info = sum(
        1 for f in findings if f["severity"] == "info"
    )

    if critical > 0:
        score_label = "[bold red]CRITICAL[/bold red]"
        border = "red"
    elif warnings > 0:
        score_label = "[bold yellow]DEGRADED[/bold yellow]"
        border = "yellow"
    else:
        score_label = "[bold green]HEALTHY[/bold green]"
        border = "green"

    # Health bar
    total_issues = critical + warnings + info
    if total_issues == 0:
        bar = "[green]" + "█" * 20 + "[/green]"
    else:
        health_pct = max(
            0, 100 - (critical * 30 + warnings * 10 + info * 2)
        )
        filled = int((health_pct / 100) * 20)
        bar_color = "green" if health_pct > 60 else "yellow" if health_pct > 30 else "red"
        bar = (
            f"[{bar_color}]" + "█" * filled + f"[/{bar_color}]"
            + "[dim]" + "░" * (20 - filled) + "[/dim]"
        )

    header = (
        f"[bold cyan]Pod:[/bold cyan]     {pod_name}\n"
        f"[bold cyan]Status:[/bold cyan]  {score_label}\n"
        f"[bold cyan]Health:[/bold cyan]  {bar}  {health_pct if total_issues else 100}%\n"
        f"\n"
        f"  [red]● {critical} critical[/red]  "
        f"[yellow]● {warnings} warnings[/yellow]  "
        f"[cyan]● {info} info[/cyan]"
    )

    console.print(
        Panel(
            header,
            title="[bold]🔬 Diagnosis[/bold]",
            border_style=border
        )
    )

    # Findings table
    if findings and findings[0]["severity"] != "healthy":
        table = Table(
            show_header=True,
            header_style="bold cyan",
            border_style="dim",
            expand=True,
            show_lines=True
        )

        table.add_column("", width=3)
        table.add_column("Finding", ratio=2)
        table.add_column("Detail", ratio=3)
        table.add_column("Action", ratio=3, style="dim italic")

        for f in findings:
            style, icon = SEVERITY_STYLES.get(
                f["severity"], ("white", "•")
            )

            table.add_row(
                icon,
                f"[{style}]{f['title']}[/{style}]",
                f["detail"],
                f["action"]
            )

        console.print(
            Panel(
                table,
                title="[bold]📋 Findings[/bold]",
                border_style="dim"
            )
        )
    else:
        console.print(
            Panel(
                "[green]✓ No issues detected. Pod is healthy.[/green]",
                border_style="green"
            )
        )
