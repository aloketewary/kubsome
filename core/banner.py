"""
Startup Banner — dynamic welcome screen with cluster info
and quick health snapshot.
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
    "Run [cyan]doctor[/cyan] to check your setup",
]


def render_banner():
    """Show startup banner with context info and health snapshot."""
    import random

    tip = random.choice(TIPS)

    # Check for active incident
    incident = get_active()
    incident_line = ""
    if incident:
        incident_line = (
            f"\n[bold red]\U0001f6a8 Active Incident: "
            f"{incident['title']}[/bold red]"
        )

    # Environment badge
    env = _env_badge()

    # Quick health snapshot (non-blocking)
    health_line = _quick_health()

    content = (
        f"[bold green]\u25c6 Kubsome[/bold green] "
        f"[dim]v1.12.0[/dim]  {env}\n"
        f"[dim]Context:[/dim] {context.current_context}\n"
        f"[dim]Namespace:[/dim] {context.namespace}"
        f"{incident_line}"
        f"{health_line}\n\n"
        f"[dim]\U0001f4a1 {tip}[/dim]"
    )

    console.print(
        Panel.fit(content, border_style="green")
    )


def _quick_health():
    """
    Fast cluster health snapshot for the banner.
    Uses cached data if available, otherwise skips.
    """
    try:
        from core.collectors.pods import collect_pods
        from core.cache import get_cached

        # Only show if cache is warm (don't block startup)
        pods = get_cached("collect_pods")
        if pods is None:
            return ""

        total = len(pods)
        running = sum(
            1 for p in pods if p["status"] == "Running"
        )
        crashing = sum(
            1 for p in pods
            if p["status"] == "CrashLoopBackOff"
            or p["restarts"] >= 5
        )

        if total == 0:
            return ""

        if crashing:
            status = (
                f"[red]\u25cf {crashing} unhealthy[/red]"
            )
        elif running == total:
            status = "[green]\u25cf All healthy[/green]"
        else:
            status = (
                f"[yellow]\u25cf {running}/{total} running[/yellow]"
            )

        return f"\n[dim]Pods:[/dim]  {status}"
    except Exception:
        return ""


def _env_badge():
    if not context.current_context:
        return ""
    if "prd" in context.current_context:
        return "[bold red]\u26a0 PROD[/bold red]"
    if "sit" in context.current_context:
        return "[yellow]SIT[/yellow]"
    if "dev" in context.current_context:
        return "[green]DEV[/green]"
    return ""
