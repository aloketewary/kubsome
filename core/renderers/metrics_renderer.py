"""
Metrics Renderer — CPU/memory usage with visual bars,
ranked pods, hot node indicators, and pressure warnings.
"""

from rich.console import Console
from rich.panel import Panel
from rich.table import Table

console = Console()


def _usage_bar(percent, width=15):
    """Render a colored usage bar with percentage label."""
    percent = min(100, max(0, percent))
    filled = int((percent / 100) * width)
    empty = width - filled

    if percent >= 80:
        color = "red"
    elif percent >= 60:
        color = "yellow"
    else:
        color = "green"

    bar = (
        f"[{color}]" + "█" * filled + f"[/{color}]"
        + "[dim]" + "░" * empty + "[/dim]"
    )
    return f"{bar} [{color}]{percent:>3}%[/{color}]"


def _truncate(name, max_len=40):
    if len(name) <= max_len:
        return name
    half = (max_len - 1) // 2
    return name[:half] + "…" + name[-(max_len - half - 1):]


def render_top_pods(pods):
    if not pods:
        console.print(
            "[dim]No metrics available "
            "(is metrics-server running?)[/dim]"
        )
        return

    max_cpu = max(p["cpu_millicores"] for p in pods) or 1
    max_mem = max(p["memory_mb"] for p in pods) or 1

    # Count hot pods
    hot = sum(
        1 for p in pods
        if (p["cpu_millicores"] / max_cpu) >= 0.8
    )

    # Summary
    parts = [
        f"[bold]{len(pods)}[/bold] pods",
        f"Top CPU: [cyan]{pods[0]['cpu']}[/cyan]",
        f"Top Mem: [cyan]{pods[0]['memory']}[/cyan]",
    ]
    if hot:
        parts.append(f"[red]● {hot} hot[/red]")

    console.print(
        Panel.fit("  │  ".join(parts), border_style="cyan")
    )

    table = Table(
        show_header=True,
        header_style="bold cyan",
        border_style="dim",
        expand=True,
        show_lines=False,
    )

    table.add_column("#", width=3, justify="right")
    table.add_column("Pod", no_wrap=True, ratio=3)
    table.add_column("CPU", justify="right", width=8)
    table.add_column("CPU Usage", width=22)
    table.add_column("Memory", justify="right", width=10)
    table.add_column("Mem Usage", width=22)

    for i, pod in enumerate(pods, 1):
        cpu_pct = int((pod["cpu_millicores"] / max_cpu) * 100)
        mem_pct = int((pod["memory_mb"] / max_mem) * 100)

        # Rank styling
        if i <= 3:
            rank = f"[bold red]{i}[/bold red]"
        else:
            rank = f"[dim]{i}[/dim]"

        name = pod["name"]
        is_hot = cpu_pct >= 80 or mem_pct >= 80
        name_display = (
            f"[bold]{name}[/bold]" if is_hot else name
        )

        table.add_row(
            rank,
            name_display,
            pod["cpu"],
            _usage_bar(cpu_pct),
            pod["memory"],
            _usage_bar(mem_pct),
        )

    console.print(table)
    console.print(
        f"[dim]{'─' * 3} {len(pods)} pods, "
        f"sorted by CPU {'─' * 3}[/dim]"
    )


def render_top_nodes(nodes):
    if not nodes:
        console.print(
            "[dim]No metrics available "
            "(is metrics-server running?)[/dim]"
        )
        return

    avg_cpu = sum(n["cpu_pct_val"] for n in nodes) // len(nodes)
    avg_mem = sum(n["mem_pct_val"] for n in nodes) // len(nodes)
    hot_nodes = sum(1 for n in nodes if n["cpu_pct_val"] >= 80)
    pressure_nodes = sum(
        1 for n in nodes if n["mem_pct_val"] >= 85
    )

    # Summary
    parts = [
        f"[bold]{len(nodes)}[/bold] nodes",
        f"Avg CPU: [cyan]{avg_cpu}%[/cyan]",
        f"Avg Mem: [cyan]{avg_mem}%[/cyan]",
    ]
    if hot_nodes:
        parts.append(f"[red]● {hot_nodes} hot[/red]")
    if pressure_nodes:
        parts.append(
            f"[yellow]● {pressure_nodes} memory pressure[/yellow]"
        )

    console.print(
        Panel.fit("  │  ".join(parts), border_style="cyan")
    )

    table = Table(
        show_header=True,
        header_style="bold cyan",
        border_style="dim",
        expand=True,
        show_lines=False,
    )

    table.add_column("", width=2)
    table.add_column("Node", no_wrap=True, ratio=3)
    table.add_column("CPU", justify="right", width=8)
    table.add_column("CPU Usage", width=22)
    table.add_column("Memory", justify="right", width=8)
    table.add_column("Mem Usage", width=22)

    for node in nodes:
        cpu_val = node["cpu_pct_val"]
        mem_val = node["mem_pct_val"]

        # Status icon
        if cpu_val >= 80 or mem_val >= 85:
            icon = "[red]●[/red]"
        elif cpu_val >= 60 or mem_val >= 70:
            icon = "[yellow]●[/yellow]"
        else:
            icon = "[green]●[/green]"

        name = node["name"]

        table.add_row(
            icon,
            name,
            node["cpu_percent"],
            _usage_bar(cpu_val),
            node["memory_percent"],
            _usage_bar(mem_val),
        )

    console.print(table)
    console.print(
        f"[dim]{'─' * 3} {len(nodes)} nodes {'─' * 3}[/dim]"
    )
