"""
Node Operations Renderer — cordon, uncordon, drain, wait, api-resources.
"""

from rich.console import Console
from rich.panel import Panel
from rich.table import Table

console = Console()


def render_cordon(result):
    icon = "✓" if result["success"] else "✗"
    color = "green" if result["success"] else "red"
    console.print(
        f"[{color}]{icon}[/{color}] "
        f"[bold]cordon[/bold] {result['node']}: "
        f"{result['message']}"
    )


def render_uncordon(result):
    icon = "✓" if result["success"] else "✗"
    color = "green" if result["success"] else "red"
    console.print(
        f"[{color}]{icon}[/{color}] "
        f"[bold]uncordon[/bold] {result['node']}: "
        f"{result['message']}"
    )


def render_drain(result):
    icon = "✓" if result["success"] else "✗"
    color = "green" if result["success"] else "red"
    title = "🔧 Node Drain"
    if result["force"]:
        title += " (forced)"

    content = f"[{color}]{icon} {result['message']}[/{color}]"
    console.print(Panel(
        content,
        title=f"[bold]{title}[/bold] — {result['node']}",
        border_style="cyan" if result["success"] else "red",
    ))


def render_wait(result):
    icon = "✓" if result["success"] else "✗"
    color = "green" if result["success"] else "red"
    console.print(
        f"[{color}]{icon}[/{color}] "
        f"wait {result['resource']}/{result['name']} "
        f"--for={result['condition']}: "
        f"[dim]{result['message']}[/dim]"
    )


def render_api_resources(resources):
    if not resources:
        console.print("[yellow]No API resources found.[/yellow]")
        return

    table = Table(
        title="[bold]📋 API Resources[/bold]",
        border_style="dim",
        expand=True,
    )
    table.add_column("Name", style="cyan")
    table.add_column("Short", style="dim")
    table.add_column("API Version", style="yellow")
    table.add_column("Namespaced", style="green")
    table.add_column("Kind", style="bold")

    for r in resources:
        table.add_row(
            r["name"],
            r["shortnames"],
            r["apiversion"],
            r["namespaced"],
            r["kind"],
        )

    console.print(table)
