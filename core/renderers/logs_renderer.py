from rich.console import Console
from rich.panel import Panel
from rich.text import Text

console = Console()


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

    summary = (
        f"[bold]{len(lines)}[/bold] lines"
    )

    error_count = sum(
        1 for l in lines
        if any(
            kw in l.lower()
            for kw in ["error", "fatal", "exception", "panic"]
        )
    )

    warn_count = sum(
        1 for l in lines
        if "warn" in l.lower()
    )

    if error_count:
        summary += f"  │  [red]● {error_count} errors[/red]"
    if warn_count:
        summary += f"  │  [yellow]● {warn_count} warnings[/yellow]"

    console.print(
        Panel.fit(summary, border_style="cyan")
    )

    colored_lines = []
    for line in lines:
        style = detect_level(line)
        if style:
            colored_lines.append(
                f"[{style}]{line}[/{style}]"
            )
        else:
            colored_lines.append(line)

    output = "\n".join(colored_lines)

    console.print(
        Panel(
            output,
            title=title,
            border_style="dim",
            padding=(0, 1)
        )
    )


def render_streaming_line(line):
    """Print a single log line with color for live streaming."""
    style = detect_level(line)
    if style:
        console.print(f"[{style}]{line}[/{style}]")
    else:
        console.print(line)


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
        # Use short name (last segment before hash)
        short = _short_pod_name(pod)
        pod_color_map[pod] = {
            "color": POD_COLORS[i % len(POD_COLORS)],
            "short": short,
        }

    # Summary
    summary = (
        f"[bold]{len(log_entries)}[/bold] lines from "
        f"[bold]{len(pods)}[/bold] pods"
    )
    console.print(Panel.fit(summary, border_style="cyan"))

    # Legend
    legend_parts = []
    for pod, info in pod_color_map.items():
        legend_parts.append(
            f"[{info['color']}]● {info['short']}[/{info['color']}]"
        )
    console.print("  " + "  ".join(legend_parts))
    console.print()

    # Render lines
    for entry in log_entries:
        pod = entry["pod"]
        line = entry["line"]
        info = pod_color_map.get(pod, {"color": "white", "short": pod[:15]})

        # Strip timestamp for cleaner display (keep content)
        display_line = line
        if len(line) > 30 and line[0].isdigit():
            # Timestamp is usually first ~30 chars
            parts = line.split(" ", 1)
            if len(parts) == 2 and "T" in parts[0]:
                display_line = parts[1]

        level_style = detect_level(display_line)
        tag = f"[{info['color']}]{info['short']:>26}[/{info['color']}]"

        if level_style:
            console.print(
                f"{tag} │ [{level_style}]{display_line}[/{level_style}]"
            )
        else:
            console.print(f"{tag} │ {display_line}")


def render_streaming_combined_line(pod, line, pod_color_map):
    """Print a single combined log line with pod tag."""
    info = pod_color_map.get(pod, {"color": "white", "short": pod[:20]})
    tag = f"[{info['color']}]{info['short']:>26}[/{info['color']}]"

    level_style = detect_level(line)
    if level_style:
        console.print(
            f"{tag} │ [{level_style}]{line}[/{level_style}]"
        )
    else:
        console.print(f"{tag} │ {line}")


def _short_pod_name(pod_name):
    """Extract readable name — deployment name + replica hash."""
    parts = pod_name.rsplit("-", 2)
    if len(parts) >= 3:
        # e.g. customer-account-management-565745c654-67nbx
        # → customer-account-mgmt/67nbx
        dep_name = parts[0]
        replica_hash = parts[-1] if len(parts[-1]) <= 5 else parts[-1][:5]
        # Truncate dep name if too long
        if len(dep_name) > 20:
            dep_name = dep_name[:20]
        return f"{dep_name}/{replica_hash}"
    return pod_name[:20]
