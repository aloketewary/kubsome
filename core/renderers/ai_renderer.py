"""
AI Renderer — AI response display with severity-colored borders,
structured content, and follow-up suggestions.
"""

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
    border = SEVERITY_BORDERS.get(response.get("severity", "info"), "dim")

    content = response.get("content", "")

    # Add follow-up suggestions if present
    suggestions = response.get("suggestions", [])
    if suggestions:
        content += "\n\n[dim]Follow-up:[/dim]"
        for s in suggestions[:3]:
            content += f"\n  [cyan]→ {s}[/cyan]"

    console.print(
        Panel(
            content,
            title=f"[bold]🧠 {response.get('title', 'AI')}[/bold]",
            border_style=border,
            padding=(1, 2),
        )
    )
