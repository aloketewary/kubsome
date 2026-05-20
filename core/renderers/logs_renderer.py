"""
Logs Renderer — colorized pod log output with line numbers,
level detection, and error/warning summaries.
"""

from rich.console import Console
from rich.panel import Panel
from rich.text import Text
from rich.table import Table

console = Console()

from core.theme import t


LOG_LEVELS = {
    "error": "red",
    "fatal": "bold red",
    "warn": "yellow",
    "warning": "yellow",
    "info": "dim",
    "debug": "dim blue",
    "trace": "dim cyan",
    "exception": "red",
    "panic": "bold red",
}


def detect_level(line):
    lower = line.lower()
    for keyword, style in LOG_LEVELS.items():
        if keyword in lower:
            return style
    return None


def render_logs(lines, pod_name, errors_only=False):
    if not lines or (len(lines) == 1 and not lines[0]):
        console.print("[dim]No logs found[/dim]")
        return

    title = f"📜 {pod_name}"
    if errors_only:
        title += " [red](errors only)[/red]"

    error_count = sum(
        1 for l in lines
        if any(
            kw in l.lower()
            for kw in ["error", "fatal", "exception", "panic"]
        )
    )

    warn_count = sum(
        1 for l in lines if "warn" in l.lower()
    )

    # Summary bar
    parts = [f"[bold]{len(lines)}[/bold] lines"]
    if error_count:
        parts.append(f"[red]● {error_count} errors[/red]")
    if warn_count:
        parts.append(f"[yellow]● {warn_count} warnings[/yellow]")
    if not error_count and not warn_count:
        parts.append("[green]● clean[/green]")

    summary = "  │  ".join(parts)
    console.print(Panel.fit(summary, border_style=t()["primary"]))

    # Render log lines with line numbers and coloring
    max_num_width = len(str(len(lines)))

    for i, line in enumerate(lines, 1):
        num = f"[dim]{i:>{max_num_width}}[/dim]"
        ts, content = _split_timestamp(line)

        style = detect_level(content)
        if ts:
            ts_display = f"[dim]{ts}[/dim] "
        else:
            ts_display = ""

        if style:
            console.print(
                f" {num} {ts_display}[{style}]{content}[/{style}]"
            )
        else:
            console.print(f" {num} {ts_display}{content}")

    # Footer
    console.print(
        f"[dim]{'─' * 3} {len(lines)} lines from {pod_name} {'─' * 3}[/dim]"
    )


def render_streaming_line(line):
    """Print a single log line with color for live streaming."""
    ts, content = _split_timestamp(line)
    style = detect_level(content)

    ts_display = f"[dim]{ts}[/dim] " if ts else ""

    if style:
        console.print(f" {ts_display}[{style}]{content}[/{style}]")
    else:
        console.print(f" {ts_display}{content}")


def _split_timestamp(line):
    """Split ISO timestamp from log content if present."""
    if len(line) > 24 and line[0].isdigit() and "T" in line[:24]:
        parts = line.split(" ", 1)
        if len(parts) == 2 and "T" in parts[0]:
            return parts[0][:19], parts[1]
    return None, line


# Pod colors for logcat mode
POD_COLORS = [
    "cyan", "green", "magenta", "yellow",
    "blue", "bright_red", "bright_green",
    "bright_cyan", "bright_magenta",
]


def render_combined_logs(log_entries, pods):
    """Render merged logs from multiple pods (logcat style)."""
    if not log_entries:
        console.print("[dim]No logs found[/dim]")
        return

    # Assign colors to pods
    pod_color_map = {}
    for i, pod in enumerate(pods):
        short = _short_pod_name(pod)
        pod_color_map[pod] = {
            "color": POD_COLORS[i % len(POD_COLORS)],
            "short": short,
        }

    # Summary
    error_count = sum(
        1 for e in log_entries
        if detect_level(e["line"])
        and "red" in (detect_level(e["line"]) or "")
    )

    parts = [
        f"[bold]{len(log_entries)}[/bold] lines",
        f"[bold]{len(pods)}[/bold] pods",
    ]
    if error_count:
        parts.append(f"[red]● {error_count} errors[/red]")

    console.print(Panel.fit("  │  ".join(parts), border_style=t()["primary"]))

    # Legend
    legend_parts = []
    for pod, info in pod_color_map.items():
        legend_parts.append(
            f"[{info['color']}]● {info['short']}[/{info['color']}]"
        )
    console.print("  " + "  ".join(legend_parts))
    console.print()

    # Render lines
    tag_width = max(
        len(info["short"]) for info in pod_color_map.values()
    ) if pod_color_map else 20

    for entry in log_entries:
        pod = entry["pod"]
        line = entry["line"]
        info = pod_color_map.get(
            pod, {"color": "white", "short": pod[:15]}
        )

        ts, content = _split_timestamp(line)
        level_style = detect_level(content)
        tag = (
            f"[{info['color']}]"
            f"{info['short']:>{tag_width}}"
            f"[/{info['color']}]"
        )

        ts_display = f"[dim]{ts[11:19]}[/dim] " if ts else ""

        if level_style:
            console.print(
                f"{tag} │ {ts_display}"
                f"[{level_style}]{content}[/{level_style}]"
            )
        else:
            console.print(f"{tag} │ {ts_display}{content}")


def render_streaming_combined_line(pod, line, pod_color_map):
    """Print a single combined log line with pod tag."""
    info = pod_color_map.get(
        pod, {"color": "white", "short": pod[:20]}
    )
    tag = f"[{info['color']}]{info['short']:>26}[/{info['color']}]"

    ts, content = _split_timestamp(line)
    level_style = detect_level(content)
    ts_display = f"[dim]{ts[11:19]}[/dim] " if ts else ""

    if level_style:
        console.print(
            f"{tag} │ {ts_display}"
            f"[{level_style}]{content}[/{level_style}]"
        )
    else:
        console.print(f"{tag} │ {ts_display}{content}")


def _short_pod_name(pod_name):
    """Extract readable name — deployment name + replica hash."""
    parts = pod_name.rsplit("-", 2)
    if len(parts) >= 3:
        dep_name = parts[0]
        replica_hash = (
            parts[-1] if len(parts[-1]) <= 5
            else parts[-1][:5]
        )
        if len(dep_name) > 20:
            dep_name = dep_name[:20]
        return f"{dep_name}/{replica_hash}"
    return pod_name[:20]
