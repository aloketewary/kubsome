from rich.console import Console
from rich.table import Table
from rich.panel import Panel

console = Console()

from core.theme import t

KIND_ICONS = {
    "Pod": "📦",
    "Deployment": "🚀",
    "Service": "🔌",
    "ConfigMap": "📄",
    "Secret": "🔒",
    "Ingress": "🌐",
}


def render_search_results(query, results):
    if not results:
        console.print(
            f"[dim]No results for '{query}'[/dim]"
        )
        return

    table = Table(
        show_header=True,
        header_style=t()["header"],
        border_style=t()["border"],
        expand=True
    )

    table.add_column("", width=3)
    table.add_column("Kind", width=12)
    table.add_column("Name")
    table.add_column("Match", justify="right", width=6)

    for r in results:
        icon = KIND_ICONS.get(r["kind"], "•")
        score = f"{int(r['score'])}%"

        score_style = (
            "green" if r["score"] > 80
            else "yellow" if r["score"] > 60
            else "dim"
        )

        table.add_row(
            icon,
            r["kind"],
            r["name"],
            f"[{score_style}]{score}[/{score_style}]"
        )

    console.print(
        Panel(
            table,
            title=f"[bold]🔍 Search: {query}[/bold]",
            border_style=t()["primary"]
        )
    )
