"""
Taints Renderer — display node taints as Rich tables.
"""

from rich.console import Console
from rich.table import Table
from rich.panel import Panel

from core.theme import t

console = Console()


def render_taints(nodes):
    """Render all node taints in a table."""
    theme = t()

    total_taints = sum(len(n["taints"]) for n in nodes)
    tainted_nodes = sum(1 for n in nodes if n["taints"])

    if not total_taints:
        console.print(
            "[green]✓ No taints on any node[/green]"
        )
        return

    table = Table(
        show_header=True,
        header_style=theme["header"],
        border_style=theme["border"],
        expand=True,
    )
    table.add_column("Node", style="bold")
    table.add_column("Key")
    table.add_column("Value")
    table.add_column("Effect", justify="center")

    for node in nodes:
        if not node["taints"]:
            continue
        for i, taint in enumerate(node["taints"]):
            node_name = node["node"] if i == 0 else ""
            effect = taint["effect"]
            effect_style = _effect_color(effect)
            table.add_row(
                node_name,
                f"[cyan]{taint['key']}[/cyan]",
                taint["value"] or "[dim]<none>[/dim]",
                f"[{effect_style}]{effect}[/{effect_style}]",
            )

    console.print(
        Panel(
            table,
            title=(
                f"[bold]🏷 Node Taints[/bold]  "
                f"[dim]{total_taints} taints on "
                f"{tainted_nodes} node(s)[/dim]"
            ),
            border_style=theme["primary"],
        )
    )


def _effect_color(effect):
    if effect == "NoSchedule":
        return "yellow"
    if effect == "NoExecute":
        return "red"
    if effect == "PreferNoSchedule":
        return "dim"
    return "white"
