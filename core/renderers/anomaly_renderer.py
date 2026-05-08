from rich.console import Console
from rich.panel import Panel
from rich.table import Table

console = Console()


def render_anomalies(alerts):
    if not alerts:
        console.print(
            Panel(
                "[green]✓ No anomalies detected[/green]",
                title="[bold]🔔 Alerts[/bold]",
                border_style="green"
            )
        )
        return

    critical = sum(
        1 for a in alerts if a["severity"] == "critical"
    )
    warnings = sum(
        1 for a in alerts if a["severity"] == "warning"
    )

    border = "red" if critical else "yellow"

    header = (
        f"[bold]{len(alerts)} anomalies detected[/bold]  │  "
        f"[red]● {critical} critical[/red]  "
        f"[yellow]● {warnings} warnings[/yellow]"
    )

    console.print(
        Panel.fit(header, border_style=border)
    )

    table = Table(
        show_header=True,
        header_style="bold cyan",
        border_style="dim",
        expand=True,
        show_lines=True
    )

    table.add_column("", width=3)
    table.add_column("Alert", ratio=2)
    table.add_column("Detail", ratio=3)
    table.add_column("Action", ratio=2, style="dim italic")

    for alert in alerts:
        icon = (
            "🔴" if alert["severity"] == "critical"
            else "🟡"
        )
        style = (
            "red" if alert["severity"] == "critical"
            else "yellow"
        )

        table.add_row(
            icon,
            f"[{style}]{alert['title']}[/{style}]",
            alert["detail"],
            alert["action"]
        )

    console.print(table)


def render_playbook(playbook):
    if not playbook:
        console.print("[dim]No playbook found[/dim]")
        return

    steps = "\n".join(
        f"  {i+1}. {step}"
        for i, step in enumerate(playbook["steps"])
    )

    console.print(
        Panel(
            steps,
            title=(
                f"[bold]📖 {playbook['title']}[/bold]"
            ),
            border_style="cyan",
            padding=(1, 2)
        )
    )


def render_correlations(chains):
    if not chains:
        console.print(
            "[dim]No correlations found[/dim]"
        )
        return

    for chain in chains:
        lines = [
            f"[bold]{chain['pod']}[/bold] "
            f"({chain['status']})\n"
        ]

        for i, link in enumerate(chain["links"]):
            connector = "└─" if i == len(chain["links"]) - 1 else "├─"
            if link["type"] == "event":
                lines.append(
                    f"  {connector} ⚡ {link['source']}: "
                    f"[dim]{link['detail']}[/dim]"
                )
            elif link["type"] == "deployment":
                lines.append(
                    f"  {connector} 🚀 {link['source']}: "
                    f"[dim]{link['detail']}[/dim]"
                )

        lines.append(
            f"\n  [bold cyan]Root Cause:[/bold cyan] "
            f"{chain['root_cause']}"
        )

        border = (
            "red" if chain["status"] != "Running"
            else "yellow"
        )

        console.print(
            Panel(
                "\n".join(lines),
                title="[bold]🔗 Correlation[/bold]",
                border_style=border
            )
        )
