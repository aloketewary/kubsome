from rich.console import Console
from rich.panel import Panel
from rich.table import Table

console = Console()


def _usage_bar(percent, width=20):
    if percent > 100:
        percent = 100

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
    return bar


def render_top_pods(pods):
    if not pods:
        console.print("[dim]No metrics available (is metrics-server running?)[/dim]")
        return

    # Find max values for relative bars
    max_cpu = max(p["cpu_millicores"] for p in pods) or 1
    max_mem = max(p["memory_mb"] for p in pods) or 1

    summary = (
        f"[bold]{len(pods)}[/bold] pods  │  "
        f"Top CPU: [cyan]{pods[0]['cpu']}[/cyan]  │  "
        f"Top Mem: [cyan]{pods[0]['memory']}[/cyan]"
    )

    console.print(
        Panel.fit(summary, border_style="cyan")
    )

    table = Table(
        show_header=True,
        header_style="bold cyan",
        border_style="dim",
        expand=True,
        show_lines=False
    )

    table.add_column("Pod", no_wrap=True, ratio=3)
    table.add_column("CPU", justify="right", width=8)
    table.add_column("CPU Usage", width=22)
    table.add_column("Memory", justify="right", width=10)
    table.add_column("Mem Usage", width=22)

    for pod in pods:
        cpu_pct = int(
            (pod["cpu_millicores"] / max_cpu) * 100
        )
        mem_pct = int(
            (pod["memory_mb"] / max_mem) * 100
        )

        table.add_row(
            pod["name"],
            pod["cpu"],
            _usage_bar(cpu_pct),
            pod["memory"],
            _usage_bar(mem_pct),
        )

    console.print(table)


def render_top_nodes(nodes):
    if not nodes:
        console.print("[dim]No metrics available (is metrics-server running?)[/dim]")
        return

    # Summary
    avg_cpu = sum(
        n["cpu_pct_val"] for n in nodes
    ) // len(nodes)
    avg_mem = sum(
        n["mem_pct_val"] for n in nodes
    ) // len(nodes)

    hot_nodes = sum(
        1 for n in nodes if n["cpu_pct_val"] >= 80
    )

    summary = (
        f"[bold]{len(nodes)}[/bold] nodes  │  "
        f"Avg CPU: [cyan]{avg_cpu}%[/cyan]  │  "
        f"Avg Mem: [cyan]{avg_mem}%[/cyan]"
    )

    if hot_nodes:
        summary += (
            f"  │  [red]● {hot_nodes} hot[/red]"
        )

    console.print(
        Panel.fit(summary, border_style="cyan")
    )

    table = Table(
        show_header=True,
        header_style="bold cyan",
        border_style="dim",
        expand=True,
        show_lines=False
    )

    table.add_column("Node", no_wrap=True, ratio=3)
    table.add_column("CPU", justify="right", width=8)
    table.add_column("CPU Usage", width=22)
    table.add_column("Memory", justify="right", width=8)
    table.add_column("Mem Usage", width=22)

    for node in nodes:
        table.add_row(
            node["name"],
            node["cpu_percent"],
            _usage_bar(node["cpu_pct_val"]),
            node["memory_percent"],
            _usage_bar(node["mem_pct_val"]),
        )

    console.print(table)
