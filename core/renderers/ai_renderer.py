from rich.console import Console
from rich.panel import Panel

console = Console()

SEVERITY_BORDERS = {
    "critical": "red",
    "warning": "yellow",
    "info": "cyan",
    "healthy": "green",
}


def render_ai_response(response):
    border = SEVERITY_BORDERS.get(
        response["severity"], "dim"
    )

    console.print(
        Panel(
            response["content"],
            title=f"[bold]{response['title']}[/bold]",
            border_style=border,
            padding=(1, 2)
        )
    )
