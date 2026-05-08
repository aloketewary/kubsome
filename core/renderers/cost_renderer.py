from rich.console import Console
from rich.panel import Panel
from rich.table import Table

console = Console()

SEVERITY_STYLES = {
    "critical": ("red", "🔴"),
    "high": ("red", "🟠"),
    "medium": ("yellow", "🟡"),
    "low": ("dim", "⚪"),
    "warning": ("yellow", "🟡"),
    "info": ("cyan", "🔵"),
}


def render_cost_recommendations(recommendations):
    if not recommendations:
        console.print(
            Panel(
                "[green]✓ Resources are well-sized[/green]",
                title="[bold]💰 Resource Optimization[/bold]",
                border_style="green"
            )
        )
        return

    over = sum(
        1 for r in recommendations
        if "over" in r["type"]
    )
    under = sum(
        1 for r in recommendations
        if "under" in r["type"]
    )

    header = (
        f"[bold]{len(recommendations)} "
        f"recommendations[/bold]  │  "
        f"[cyan]↓ {over} over-provisioned[/cyan]  "
        f"[yellow]↑ {under} under-provisioned[/yellow]"
    )

    console.print(
        Panel.fit(header, border_style="cyan")
    )

    table = Table(
        show_header=True,
        header_style="bold cyan",
        border_style="dim",
        expand=True,
        show_lines=False
    )

    table.add_column("Pod", no_wrap=True, ratio=3)
    table.add_column("Issue", ratio=2)
    table.add_column("Detail", ratio=3)
    table.add_column("Suggestion", style="dim italic", ratio=3)

    for r in recommendations:
        style, icon = SEVERITY_STYLES.get(
            r["severity"], ("white", "•")
        )

        table.add_row(
            r["pod"][:40],
            f"[{style}]{r['title']}[/{style}]",
            r["detail"],
            r["suggestion"]
        )

    console.print(table)


def render_security_scan(findings):
    if not findings:
        console.print(
            Panel(
                "[green]✓ No security issues found[/green]",
                title="[bold]🔒 Security Scan[/bold]",
                border_style="green"
            )
        )
        return

    critical = sum(
        1 for f in findings if f["severity"] == "critical"
    )
    high = sum(
        1 for f in findings if f["severity"] == "high"
    )
    medium = sum(
        1 for f in findings if f["severity"] == "medium"
    )

    border = (
        "red" if critical or high
        else "yellow" if medium
        else "dim"
    )

    header = (
        f"[bold]{len(findings)} findings[/bold]  │  "
        f"[red]● {critical} critical[/red]  "
        f"[red]● {high} high[/red]  "
        f"[yellow]● {medium} medium[/yellow]"
    )

    console.print(
        Panel.fit(header, border_style=border)
    )

    table = Table(
        show_header=True,
        header_style="bold cyan",
        border_style="dim",
        expand=True,
        show_lines=False
    )

    table.add_column("", width=3)
    table.add_column("Severity", width=9)
    table.add_column("Pod", no_wrap=True, ratio=2)
    table.add_column("Issue", ratio=2)
    table.add_column("Fix", style="dim italic", ratio=3)

    for f in findings:
        style, icon = SEVERITY_STYLES.get(
            f["severity"], ("white", "•")
        )

        table.add_row(
            icon,
            f"[{style}]{f['severity'].upper()}[/{style}]",
            f["pod"][:35],
            f["issue"],
            f["fix"]
        )

    console.print(table)


def render_unused_resources(unused):
    if not unused:
        console.print(
            Panel(
                "[green]✓ No unused resources found[/green]",
                title="[bold]🗑️  Unused Resources[/bold]",
                border_style="green"
            )
        )
        return

    table = Table.grid(padding=(0, 2))
    table.add_column(width=12)
    table.add_column()

    for item in unused:
        table.add_row(
            f"[dim]{item['kind']}[/dim]",
            item["name"]
        )

    console.print(
        Panel(
            table,
            title=(
                f"[bold]🗑️  {len(unused)} "
                f"Unused Resources[/bold]"
            ),
            border_style="yellow"
        )
    )
