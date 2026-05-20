"""
Connect Renderer — integration status display,
connection results, and auto-discovery output.
"""

from rich.console import Console
from rich.panel import Panel
from rich.table import Table

console = Console()

from core.theme import t


def render_integrations(integrations):
    """Render list of all integrations with status."""
    table = Table(
        show_header=True,
        header_style=t()["header"],
        border_style=t()["border"],
        expand=True,
        show_lines=False,
    )
    table.add_column("", width=3)
    table.add_column("Integration", ratio=2)
    table.add_column("Status", width=14)
    table.add_column("Detail", ratio=3, style="dim")

    connected = 0
    for i in integrations:
        if i["status"] == "connected":
            icon = "[green]●[/green]"
            status = "[green]Connected[/green]"
            connected += 1
        else:
            icon = "[dim]○[/dim]"
            status = "[dim]Not connected[/dim]"

        table.add_row(
            icon,
            f"{i['icon']} {i['name']}",
            status,
            i.get("detail", "") or i["description"],
        )

    total = len(integrations)
    console.print(
        Panel(
            table,
            title="[bold]🔌 Integrations[/bold]",
            subtitle=(
                f"[dim]{connected}/{total} connected[/dim]"
            ),
            border_style=t()["primary"],
        )
    )

    if connected < total:
        console.print(
            "[dim]  Connect: kubsome connect <name> [url]\n"
            "  Auto-discover: kubsome connect --discover[/dim]"
        )


def render_connect_result(result):
    """Render the result of a connect attempt."""
    if result["success"]:
        console.print(
            f"[green]✓ {result['message']}[/green]"
        )
        if result.get("detail"):
            console.print(
                f"  [dim]{result['detail']}[/dim]"
            )
    else:
        console.print(
            f"[red]✗ {result['message']}[/red]"
        )
        if result.get("detail"):
            console.print(
                f"  [dim]{result['detail']}[/dim]"
            )
        if result.get("needs_input"):
            console.print(
                f"\n[cyan]  {result.get('input_label', 'Input')}"
                f" required[/cyan]"
            )


def render_disconnect_result(result):
    """Render disconnect result."""
    if result["success"]:
        console.print(
            f"[green]✓ {result['message']}[/green]"
        )
    else:
        console.print(
            f"[yellow]{result['message']}[/yellow]"
        )


def render_discoveries(discoveries):
    """Render auto-discovered integrations."""
    if not discoveries:
        console.print(
            "[dim]No integrations auto-discovered.\n"
            "  Ensure services are running in the cluster "
            "or provide URLs manually.[/dim]"
        )
        return

    lines = [
        f"[bold]Found {len(discoveries)} "
        f"integration(s):[/bold]\n"
    ]

    for d in discoveries:
        lines.append(
            f"  [green]●[/green] [bold]{d['name']}[/bold]"
            f"  [dim]({d['source']})[/dim]"
        )
        if d.get("url"):
            lines.append(f"    [dim]{d['url']}[/dim]")

    console.print(
        Panel(
            "\n".join(lines),
            title="[bold]🔍 Auto-Discovery[/bold]",
            border_style=t()["success"],
        )
    )


def render_connect_all_results(results):
    """Render results of connecting all discovered integrations."""
    for r in results:
        if r["success"]:
            console.print(
                f"  [green]✓[/green] {r['name']} — "
                f"{r['message']}"
            )
        else:
            console.print(
                f"  [red]✗[/red] {r['name']} — "
                f"{r['message']}"
            )
