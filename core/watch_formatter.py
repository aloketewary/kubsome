"""
Watch Formatter — live-updating pod table for `pods watch`.
"""

from rich.table import Table
from rich.panel import Panel
from rich.console import Group
from datetime import datetime

from config.settings import SETTINGS
from core.insights import pod_suggestion


def get_severity(pod):
    status = pod["status"]
    restarts = pod["restarts"]

    if status in ["CrashLoopBackOff", "Error"]:
        return "critical"
    if status == "Pending":
        return "warning"
    if restarts >= SETTINGS["restart_critical_threshold"]:
        return "critical"
    if restarts >= SETTINGS["restart_warning_threshold"]:
        return "warning"
    return "healthy"


def severity_style(severity):
    if severity == "critical":
        return "red"
    if severity == "warning":
        return "yellow"
    return "green"


def status_icon(severity):
    if severity == "critical":
        return "[red]●[/red]"
    if severity == "warning":
        return "[yellow]●[/yellow]"
    return "[green]●[/green]"


def _colored_status(status):
    s = status.lower()
    if s in ("running", "succeeded", "completed"):
        return f"[green]{status}[/green]"
    if s in ("crashloopbackoff", "error", "failed",
             "oomkilled", "imagepullbackoff"):
        return f"[red]{status}[/red]"
    if s in ("pending", "terminating", "containercreating"):
        return f"[yellow]{status}[/yellow]"
    return f"[dim]{status}[/dim]"


def _colored_restarts(count):
    if count == 0:
        return "[dim]0[/dim]"
    if count >= 20:
        return f"[bold red]{count}[/bold red]"
    if count >= 5:
        return f"[yellow]{count}[/yellow]"
    return str(count)


def _truncate_name(name, max_len=48):
    """No truncation — show full pod name for easy copying."""
    return name


def build_watch_view(pods, namespace, target=None):
    """Returns a renderable that Live can display and update in-place."""

    if target:
        pods = [p for p in pods if target in p["name"]]

    pods = sorted(
        pods,
        key=lambda x: (
            {"critical": 0, "warning": 1, "healthy": 2}[get_severity(x)],
            -x["restarts"],
            x["name"]
        )
    )

    healthy = sum(1 for p in pods if get_severity(p) == "healthy")
    warning = sum(1 for p in pods if get_severity(p) == "warning")
    critical = sum(1 for p in pods if get_severity(p) == "critical")
    total = len(pods)

    now = datetime.now().strftime("%H:%M:%S")

    header_parts = [
        "[bold cyan]⟳ WATCHING[/bold cyan]",
        f"[dim]{namespace}[/dim]",
        "│",
        f"[bold]{total}[/bold] pods",
        "│",
        f"[green]● {healthy}[/green]",
        f"[yellow]● {warning}[/yellow]",
        f"[red]● {critical}[/red]",
        "│",
        f"[dim]{now}[/dim]",
        "│",
        "[dim italic]Ctrl+C to exit[/dim italic]",
    ]

    # Filter indicator (#3)
    if target:
        header_parts.insert(
            3, f"[dim]filter:[/dim][cyan]{target}[/cyan]  │"
        )

    header = "  ".join(header_parts)

    header_panel = Panel.fit(
        header,
        border_style=t()["primary"]
    )

    table = Table(
        show_header=True,
        header_style=t()["header"],
        border_style=t()["border"],
        pad_edge=True,
        show_lines=False,
        expand=True
    )

    table.add_column("", width=2)
    table.add_column("Pod", no_wrap=True, ratio=4)
    table.add_column("Status", justify="center", ratio=1)
    table.add_column("Restarts", justify="right", ratio=1)
    table.add_column("Age", justify="right", ratio=1)
    table.add_column("Insight", style="dim italic", ratio=2)

    for pod in pods:
        severity = get_severity(pod)
        style = severity_style(severity)
        icon = status_icon(severity)
        name = _truncate_name(pod["name"])

        suggestion = pod_suggestion(pod)
        insight = suggestion if suggestion != "Healthy" else "[dim]✓[/dim]"

        table.add_row(
            icon,
            f"[{style}]{name}[/{style}]",
            _colored_status(pod["status"]),
            _colored_restarts(pod["restarts"]),
            pod.get("age", "") or "[dim]< 1m[/dim]",
            insight
        )

    return Group(header_panel, table)
