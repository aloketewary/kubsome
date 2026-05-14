"""
Startup Banner — dynamic welcome screen with cluster info.
"""

from rich.console import Console
from rich.panel import Panel
from rich.table import Table

from core.context import context
from core.incident.manager import get_active

console = Console()

TIPS = [
    "Type [cyan]h[/cyan] for help",
    "Use [cyan]![/cyan] to repeat last command",
    "Try [cyan]workflow health[/cyan] for quick assessment",
    "Use [cyan]&&[/cyan] to chain commands: [dim]pods && events[/dim]",
    "Natural language works: [dim]show me logs for payment[/dim]",
]


def render_banner():
    """Show startup banner with context info."""
    import random

    tip = random.choice(TIPS)

    # Check for active incident
    incident = get_active()
    incident_line = ""
    if incident:
        incident_line = (
            f"\n[bold red]🚨 Active Incident: "
            f"{incident['title']}[/bold red]"
        )

    # Environment badge
    env = _env_badge()

    content = (
        f"[bold green]◆ Kubsome[/bold green] "
        f"[dim]v1.11.0[/dim]  {env}\n"
        f"[dim]Context:[/dim] {context.current_context}\n"
        f"[dim]Namespace:[/dim] {context.namespace}"
        f"{incident_line}\n\n"
        f"[dim]💡 {tip}[/dim]"
    )

    console.print(
        Panel.fit(content, border_style="green")
    )


def _env_badge():
    if not context.current_context:
        return ""
    if "prd" in context.current_context:
        return "[bold red]⚠ PROD[/bold red]"
    if "sit" in context.current_context:
        return "[yellow]SIT[/yellow]"
    if "dev" in context.current_context:
        return "[green]DEV[/green]"
    return ""
