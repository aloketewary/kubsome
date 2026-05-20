from rich.console import Console
from rich.table import Table
from rich.panel import Panel
from rich.align import Align

from config.settings import SETTINGS
from core.insights import pod_suggestion
from core.context import context
from core.theme import t

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
    theme = t()
    if severity == "critical":
        return theme["error"]
    if severity == "warning":
        return theme["warning"]
    return theme["success"]


def status_icon(severity):
    theme = t()
    if severity == "critical":
        return f"[{theme['error']}]●[/{theme['error']}]"
    if severity == "warning":
        return f"[{theme['warning']}]●[/{theme['warning']}]"
    return f"[{theme['success']}]●[/{theme['success']}]"


def _colored_status(status):
    """Color the status text based on its value."""
    theme = t()
    s = status.lower()
    if s in ("running", "succeeded", "completed"):
        return f"[{theme['success']}]{status}[/{theme['success']}]"
    if s in ("crashloopbackoff", "error", "failed",
             "oomkilled", "imagepullbackoff"):
        return f"[{theme['error']}]{status}[/{theme['error']}]"
    if s in ("pending", "terminating", "containercreating",
             "init:0/1", "podinitializing"):
        return f"[{theme['warning']}]{status}[/{theme['warning']}]"
    return f"[{theme['muted']}]{status}[/{theme['muted']}]"


def _colored_restarts(count):
    """Color restart count by severity."""
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


def render_summary(pods):
    theme = t()
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
        f"[{theme['success']}]" + "█" * h + f"[/{theme['success']}]"
        + f"[{theme['warning']}]" + "█" * w + f"[/{theme['warning']}]"
        + f"[{theme['error']}]" + "█" * c + f"[/{theme['error']}]"
    )

    ns = context.namespace
    ctx = context.current_context or ""
    ctx_short = ctx.split("/")[-1] if "/" in ctx else ctx

    summary = (
        f"[{theme['muted']}]{ctx_short}[/{theme['muted']}]/[bold]{ns}[/bold]  │  "
        f"[bold]{total}[/bold] pods  │  "
        f"[{theme['success']}]● {healthy}[/{theme['success']}]  "
        f"[{theme['warning']}]● {warning}[/{theme['warning']}]  "
        f"[{theme['error']}]● {critical}[/{theme['error']}]  │  "
        f"{bar}"
    )

    console.print(
        Align.center(
            Panel.fit(
                summary,
                border_style=theme["primary"]
            )
        )
    )


def render_pods_table(pods):
    theme = t()
    pods = sorted(
        pods,
        key=lambda x: (
            {"critical": 0, "warning": 1, "healthy": 2}[get_severity(x)],
            -x["restarts"],
            x["name"]
        )
    )

    render_summary(pods)

    # Check if any pod has sentry version data
    has_sentry = any(
        _extract_sentry(pod.get("labels", []))
        for pod in pods
    )

    table = Table(
        show_header=True,
        header_style=theme["header"],
        border_style=theme["border"],
        pad_edge=True,
        show_lines=False,
    )

    table.add_column("", width=2)
    table.add_column("Pod", no_wrap=True)
    table.add_column("Status", justify="center")
    table.add_column("Restarts", justify="right")
    table.add_column("Age", justify="right")
    if has_sentry:
        table.add_column("Sentry", style="dim")
    table.add_column("Labels", style="dim")

    for pod in pods:
        severity = get_severity(pod)
        style = severity_style(severity)
        icon = status_icon(severity)
        name = _truncate_name(pod["name"])

        labels = pod.get("labels", [])
        sentry_ver = _extract_sentry(labels)

        # Show key labels (app, component) as compact string
        label_str = ", ".join(
            lbl.split("=", 1)[1]
            for lbl in labels
            if any(k in lbl for k in ["app=", "component="])
        )[:30]

        row = [
            icon,
            f"[{style}]{name}[/{style}]",
            _colored_status(pod["status"]),
            _colored_restarts(pod["restarts"]),
            pod.get("age", "") or "[dim]< 1m[/dim]",
        ]
        if has_sentry:
            row.append(sentry_ver)
        row.append(label_str)

        table.add_row(*row)

    console.print(table)

    # Footer with count
    console.print(
        f"[dim]{'─' * 3} {len(pods)} pods {'─' * 3}[/dim]"
    )


def _extract_sentry(labels):
    """Extract sentry/version label value."""
    for lbl in labels:
        if "=" in lbl:
            k, v = lbl.split("=", 1)
            if k in (
                "version", "app.kubernetes.io/version",
                "sentry-version", "sentry.io/version",
            ):
                return v
    return ""
