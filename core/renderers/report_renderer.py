from rich.console import Console
from rich.panel import Panel
from rich.table import Table

console = Console()

from core.theme import t


def render_health_check(result):
    score = result["score"]
    grade = result["grade"]

    # Score color
    if score >= 90:
        color = "green"
    elif score >= 75:
        color = "cyan"
    elif score >= 60:
        color = "yellow"
    else:
        color = "red"

    # Score bar
    filled = int(score / 5)
    bar = (
        f"[{color}]" + "█" * filled + f"[/{color}]"
        + "[dim]" + "░" * (20 - filled) + "[/dim]"
    )

    header = (
        f"[bold {color}]{grade}[/bold {color}]  "
        f"{bar}  "
        f"[bold]{score}/100[/bold]"
    )

    console.print(
        Panel(
            header,
            title="[bold]🏥 Cluster Health Score[/bold]",
            border_style=color
        )
    )

    # Checks table
    table = Table(
        show_header=True,
        header_style=t()["header"],
        border_style=t()["border"],
        expand=True
    )

    table.add_column("", width=3)
    table.add_column("Check", ratio=2)
    table.add_column("Result", ratio=3)

    for check in result["checks"]:
        icon = "[green]✓[/green]" if check["pass"] else "[red]✗[/red]"
        style = "" if check["pass"] else "red"

        table.add_row(
            icon,
            check["name"],
            f"[{style}]{check['detail']}[/{style}]"
            if style else check["detail"]
        )

    console.print(table)


def render_export_success(path):
    console.print(
        Panel(
            f"[green]✓ Report exported[/green]\n\n"
            f"  [dim]{path}[/dim]",
            title="[bold]📄 Export[/bold]",
            border_style=t()["success"]
        )
    )


def render_audit_log(entries):
    if not entries:
        console.print("[dim]No audit entries[/dim]")
        return

    table = Table(
        show_header=True,
        header_style=t()["header"],
        border_style=t()["border"],
        expand=True
    )

    table.add_column("Time", width=20)
    table.add_column("Action", width=12)
    table.add_column("Target", ratio=2)
    table.add_column("Context", ratio=2, style="dim")

    for entry in reversed(entries):
        table.add_row(
            entry["timestamp"][11:19],
            entry["action"],
            entry["target"],
            f"{entry['context']}/{entry['namespace']}"
        )

    console.print(
        Panel(
            table,
            title="[bold]📝 Audit Log[/bold]",
            border_style=t()["border"]
        )
    )
