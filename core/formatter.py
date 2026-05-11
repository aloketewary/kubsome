from rich.console import Console
from rich.table import Table
from rich.panel import Panel
from rich.align import Align

from config.settings import SETTINGS
from core.insights import pod_suggestion

console = Console()


def get_severity(pod):
    status = pod["status"]
    restarts = pod["restarts"]
    critical_threshold = SETTINGS["restart_critical_threshold"]
    warning_threshold = SETTINGS["restart_warning_threshold"]

    if status in ["CrashLoopBackOff", "Error"]:
        return "critical"
    if status == "Pending":
        return "warning"
    if restarts >= critical_threshold:
        return "critical"
    if restarts >= warning_threshold:
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


def truncate_name(name, max_len=45):
    if len(name) <= max_len:
        return name
    return name[:20] + "…" + name[-20:]


def render_summary(pods):
    healthy = sum(1 for p in pods if get_severity(p) == "healthy")
    warning = sum(1 for p in pods if get_severity(p) == "warning")
    critical = sum(1 for p in pods if get_severity(p) == "critical")
    total = len(pods)

    width = 20
    if total > 0:
        h = int((healthy / total) * width)
        w = int((warning / total) * width)
        c = width - h - w
    else:
        h, w, c = 0, 0, 0

    bar = (
        "[green]" + "█" * h + "[/green]"
        + "[yellow]" + "█" * w + "[/yellow]"
        + "[red]" + "█" * c + "[/red]"
    )

    summary = (
        f"[bold]{total}[/bold] pods  │  "
        f"[green]● {healthy}[/green]  "
        f"[yellow]● {warning}[/yellow]  "
        f"[red]● {critical}[/red]  │  "
        f"{bar}"
    )

    console.print(
        Align.center(
            Panel.fit(
                summary,
                border_style="cyan"
            )
        )
    )


def render_pods_table(pods):
    pods = sorted(
        pods,
        key=lambda x: (
            {"critical": 0, "warning": 1, "healthy": 2}[get_severity(x)],
            -x["restarts"],
            x["name"]
        )
    )

    render_summary(pods)

    table = Table(
        show_header=True,
        header_style="bold cyan",
        border_style="dim",
        pad_edge=True,
        show_lines=False
    )

    table.add_column("", width=2)
    table.add_column("Pod", no_wrap=True)
    table.add_column("Status", justify="center")
    table.add_column("Restarts", justify="right")
    table.add_column("Age", justify="right")
    table.add_column("Labels", style="dim")

    for pod in pods:
        severity = get_severity(pod)
        style = severity_style(severity)
        icon = status_icon(severity)
        name = truncate_name(pod["name"])

        # Show key labels (app, version) as compact string
        labels = pod.get("labels", [])
        label_str = ", ".join(
            lbl.split("=", 1)[1]
            for lbl in labels
            if any(k in lbl for k in ["app=", "version="])
        )[:30]

        table.add_row(
            icon,
            f"[{style}]{name}[/{style}]",
            pod["status"],
            str(pod["restarts"]),
            pod.get("age", ""),
            label_str
        )

    console.print(table)
