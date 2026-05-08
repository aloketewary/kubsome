from rich.console import Console
from rich.panel import Panel
from rich.table import Table

console = Console()


def _usage_bar(pct, width=20):
    pct = min(100, max(0, pct))
    filled = int((pct / 100) * width)
    color = "green" if pct < 60 else "yellow" if pct < 80 else "red"
    return (
        f"[{color}]" + "█" * filled + f"[/{color}]"
        + "[dim]" + "░" * (width - filled) + "[/dim]"
    )


def render_hpa(hpas):
    if not hpas:
        console.print("[dim]No HPA found[/dim]")
        return

    table = Table(
        show_header=True,
        header_style="bold cyan",
        border_style="dim",
        expand=True
    )

    table.add_column("HPA")
    table.add_column("Target")
    table.add_column("Min", justify="right", width=4)
    table.add_column("Max", justify="right", width=4)
    table.add_column("Current", justify="right", width=7)
    table.add_column("Desired", justify="right", width=7)
    table.add_column("Metrics")

    for hpa in hpas:
        metrics_str = ", ".join(
            f"{m['name']}:{m['current']}%"
            for m in hpa["metrics"]
        ) or "-"

        at_max = hpa["current"] >= hpa["max"]
        style = "red" if at_max else ""

        table.add_row(
            hpa["name"],
            hpa["target"],
            str(hpa["min"]),
            str(hpa["max"]),
            f"[{style}]{hpa['current']}[/{style}]" if style else str(hpa["current"]),
            str(hpa["desired"]),
            metrics_str
        )

    console.print(
        Panel(table, title="[bold]📈 HPA[/bold]", border_style="cyan")
    )


def render_pdb(pdbs):
    if not pdbs:
        console.print("[dim]No PDB found[/dim]")
        return

    table = Table(
        show_header=True,
        header_style="bold cyan",
        border_style="dim",
        expand=True
    )

    table.add_column("PDB")
    table.add_column("Min Available", justify="center")
    table.add_column("Max Unavailable", justify="center")
    table.add_column("Healthy", justify="right")
    table.add_column("Disruptions OK", justify="right")

    for pdb in pdbs:
        safe = pdb["disruptions_allowed"] > 0
        icon = "[green]✓[/green]" if safe else "[red]✗[/red]"

        table.add_row(
            f"{icon} {pdb['name']}",
            str(pdb["min_available"]),
            str(pdb["max_unavailable"]),
            f"{pdb['current_healthy']}/{pdb['expected_pods']}",
            str(pdb["disruptions_allowed"])
        )

    console.print(
        Panel(table, title="[bold]🛡️ PDB[/bold]", border_style="cyan")
    )


def render_capacity(data):
    if not data:
        console.print("[red]Could not fetch capacity[/red]")
        return

    cpu_bar = _usage_bar(data["cpu_used_pct"])
    mem_bar = _usage_bar(data["mem_used_pct"])

    content = (
        f"[bold cyan]Nodes:[/bold cyan]  {data['nodes']}\n\n"
        f"[bold cyan]CPU:[/bold cyan]\n"
        f"  Allocatable: {data['allocatable_cpu_m']}m\n"
        f"  Requested:   {data['requested_cpu_m']}m\n"
        f"  Free:        [green]{data['free_cpu_m']}m[/green]\n"
        f"  Usage:       {cpu_bar}  {data['cpu_used_pct']}%\n\n"
        f"[bold cyan]Memory:[/bold cyan]\n"
        f"  Allocatable: {data['allocatable_mem_mb']}Mi\n"
        f"  Requested:   {data['requested_mem_mb']}Mi\n"
        f"  Free:        [green]{data['free_mem_mb']}Mi[/green]\n"
        f"  Usage:       {mem_bar}  {data['mem_used_pct']}%"
    )

    border = (
        "red" if data["cpu_used_pct"] > 85 or data["mem_used_pct"] > 85
        else "yellow" if data["cpu_used_pct"] > 70 or data["mem_used_pct"] > 70
        else "green"
    )

    console.print(
        Panel(
            content,
            title="[bold]📊 Cluster Capacity[/bold]",
            border_style=border
        )
    )


def render_quota(quotas):
    if not quotas:
        console.print("[dim]No resource quotas found[/dim]")
        return

    for quota in quotas:
        table = Table(
            show_header=True,
            header_style="bold cyan",
            border_style="dim",
            expand=True
        )

        table.add_column("Resource")
        table.add_column("Used", justify="right")
        table.add_column("Limit", justify="right")
        table.add_column("Usage", width=22)

        for res in quota["resources"]:
            # Try to calculate percentage
            try:
                used_val = int(res["used"])
                limit_val = int(res["limit"])
                pct = int((used_val / limit_val) * 100) if limit_val > 0 else 0
                bar = _usage_bar(pct, 15)
            except ValueError:
                bar = ""

            table.add_row(
                res["resource"],
                res["used"],
                res["limit"],
                bar
            )

        console.print(
            Panel(
                table,
                title=f"[bold]📋 Quota: {quota['name']}[/bold]",
                border_style="cyan"
            )
        )


def render_drain_check(data):
    if not data:
        console.print("[red]Node not found[/red]")
        return

    safe_icon = (
        "[green]✓ SAFE[/green]"
        if data["unsafe"] == 0
        else f"[red]⚠ {data['unsafe']} UNSAFE PODS[/red]"
    )

    header = (
        f"[bold cyan]Node:[/bold cyan]  {data['node']}\n"
        f"[bold cyan]Pods:[/bold cyan]   {data['total_pods']}\n"
        f"[bold cyan]Safe:[/bold cyan]   {data['safe_to_evict']}\n"
        f"[bold cyan]Unsafe:[/bold cyan] {data['unsafe']}\n\n"
        f"  Status: {safe_icon}"
    )

    border = "green" if data["unsafe"] == 0 else "red"

    console.print(
        Panel(
            header,
            title="[bold]🔧 Drain Check[/bold]",
            border_style=border
        )
    )

    # Show unsafe pods
    unsafe_pods = [
        p for p in data["pods"] if not p["safe"]
    ]

    if unsafe_pods:
        table = Table(
            show_header=True,
            header_style="bold cyan",
            border_style="dim",
            expand=True
        )
        table.add_column("Pod")
        table.add_column("Namespace")
        table.add_column("Owner")

        for p in unsafe_pods:
            table.add_row(
                f"[red]{p['name']}[/red]",
                p["namespace"],
                p["owner_kind"]
            )

        console.print(
            Panel(
                table,
                title="[bold]⚠ Unsafe to Evict[/bold]",
                border_style="red"
            )
        )
