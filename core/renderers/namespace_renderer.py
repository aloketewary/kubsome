from rich.console import Console
from rich.panel import Panel
from rich.table import Table

console = Console()

from core.theme import t

RESOURCE_ICONS = {
    "pods": "📦",
    "deployments": "🚀",
    "services": "🔌",
    "configmaps": "📄",
    "secrets": "🔒",
    "ingress": "🌐",
    "jobs": "⚡",
    "cronjobs": "🕐",
    "statefulsets": "🗄️",
    "daemonsets": "🔄",
}


def render_namespace_summary(data):
    # Header
    header = (
        f"[bold cyan]Namespace:[/bold cyan] "
        f"{data['namespace']}\n"
        f"[bold cyan]Context:[/bold cyan]   "
        f"{data['context']}"
    )

    console.print(
        Panel(
            header,
            title="[bold]📁 Namespace Overview[/bold]",
            border_style=t()["primary"]
        )
    )

    # Resource counts
    table = Table.grid(padding=(0, 3))
    table.add_column(width=3)
    table.add_column(width=14)
    table.add_column(justify="right", width=5)

    for rtype, count in sorted(
        data["resources"].items(),
        key=lambda x: -x[1]
    ):
        icon = RESOURCE_ICONS.get(rtype, "•")
        table.add_row(
            icon, rtype.capitalize(), str(count)
        )

    console.print(
        Panel(
            table,
            title="[bold]📊 Resources[/bold]",
            border_style=t()["border"]
        )
    )

    # Pod status breakdown
    if data["pod_statuses"]:
        status_lines = []
        for status, count in data["pod_statuses"].items():
            if status == "Running":
                style = "green"
            elif status == "Pending":
                style = "yellow"
            else:
                style = "red"

            status_lines.append(
                f"  [{style}]● {status}: {count}[/{style}]"
            )

        console.print(
            Panel(
                "\n".join(status_lines),
                title="[bold]📦 Pod Status[/bold]",
                border_style=t()["border"]
            )
        )
