"""
Scaling Renderer — HPA, PDB, capacity, quota, and drain-check
displays with usage bars and safety indicators.
"""

from rich.console import Console
from rich.panel import Panel
from rich.table import Table

console = Console()

from core.theme import t


def _usage_bar(pct, width=15):
    pct = min(100, max(0, pct))
    filled = int((pct / 100) * width)
    color = "green" if pct < 60 else "yellow" if pct < 80 else "red"
    bar = (
        f"[{color}]" + "█" * filled + f"[/{color}]"
        + "[dim]" + "░" * (width - filled) + "[/dim]"
    )
    return f"{bar} [{color}]{pct}%[/{color}]"


def render_hpa(hpas):
    if not hpas:
        console.print("[dim]No HPA found[/dim]")
        return

    at_max = sum(1 for h in hpas if h["current"] >= h["max"])

    parts = [f"[bold]{len(hpas)}[/bold] autoscalers"]
    if at_max:
        parts.append(f"[red]● {at_max} at max[/red]")

    console.print(Panel.fit("  │  ".join(parts), border_style=t()["primary"]))

    table = Table(
        show_header=True,
        header_style=t()["header"],
        border_style=t()["border"],
        expand=True,
        show_lines=False,
    )

    table.add_column("", width=2)
    table.add_column("HPA")
    table.add_column("Target")
    table.add_column("Min", justify="right", width=4)
    table.add_column("Max", justify="right", width=4)
    table.add_column("Current", justify="right", width=7)
    table.add_column("Metrics")

    for hpa in hpas:
        is_max = hpa["current"] >= hpa["max"]
        icon = "[red]●[/red]" if is_max else "[green]●[/green]"

        current_display = (
            f"[bold red]{hpa['current']}[/bold red]"
            if is_max else str(hpa["current"])
        )

        metrics_str = ", ".join(
            f"{m['name']}:{m['current']}%"
            for m in hpa["metrics"]
        ) or "[dim]-[/dim]"

        table.add_row(
            icon,
            hpa["name"],
            hpa["target"],
            str(hpa["min"]),
            str(hpa["max"]),
            current_display,
            metrics_str,
        )

    console.print(table)

    if at_max:
        console.print(
            "\n[dim]  ⚠ HPAs at max cannot scale further — "
            "consider increasing maxReplicas[/dim]"
        )


def render_pdb(pdbs):
    if not pdbs:
        console.print("[dim]No PDB found[/dim]")
        return

    unsafe = sum(1 for p in pdbs if p["disruptions_allowed"] == 0)

    parts = [f"[bold]{len(pdbs)}[/bold] disruption budgets"]
    if unsafe:
        parts.append(f"[red]● {unsafe} blocking[/red]")
    else:
        parts.append("[green]● all allow disruptions[/green]")

    console.print(Panel.fit("  │  ".join(parts), border_style=t()["primary"]))

    table = Table(
        show_header=True,
        header_style=t()["header"],
        border_style=t()["border"],
        expand=True,
        show_lines=False,
    )

    table.add_column("", width=2)
    table.add_column("PDB")
    table.add_column("Min Avail", justify="center")
    table.add_column("Max Unavail", justify="center")
    table.add_column("Healthy", justify="right")
    table.add_column("Disruptions OK", justify="right")

    for pdb in pdbs:
        safe = pdb["disruptions_allowed"] > 0
        icon = "[green]✓[/green]" if safe else "[red]✗[/red]"

        disruptions = (
            f"[green]{pdb['disruptions_allowed']}[/green]"
            if safe
            else "[bold red]0[/bold red]"
        )

        table.add_row(
            icon,
            pdb["name"],
            str(pdb["min_available"]),
            str(pdb["max_unavailable"]),
            f"{pdb['current_healthy']}/{pdb['expected_pods']}",
            disruptions,
        )

    console.print(table)


def render_capacity(data):
    if not data:
        console.print("[red]Could not fetch capacity[/red]")
        return

    cpu_pct = data["cpu_used_pct"]
    mem_pct = data["mem_used_pct"]

    border = (
        "red" if cpu_pct > 85 or mem_pct > 85
        else "yellow" if cpu_pct > 70 or mem_pct > 70
        else "green"
    )

    content = (
        f"[bold]{data['nodes']}[/bold] nodes\n"
        f"\n"
        f"  [bold cyan]CPU[/bold cyan]\n"
        f"    Allocatable:  {data['allocatable_cpu_m']}m\n"
        f"    Requested:    {data['requested_cpu_m']}m\n"
        f"    Free:         [green]{data['free_cpu_m']}m[/green]\n"
        f"    Usage:        {_usage_bar(cpu_pct)}\n"
        f"\n"
        f"  [bold cyan]Memory[/bold cyan]\n"
        f"    Allocatable:  {data['allocatable_mem_mb']}Mi\n"
        f"    Requested:    {data['requested_mem_mb']}Mi\n"
        f"    Free:         [green]{data['free_mem_mb']}Mi[/green]\n"
        f"    Usage:        {_usage_bar(mem_pct)}"
    )

    console.print(
        Panel(
            content,
            title="[bold]📊 Cluster Capacity[/bold]",
            border_style=border,
        )
    )

    # Warning
    if cpu_pct > 85 or mem_pct > 85:
        resource = "CPU" if cpu_pct > mem_pct else "Memory"
        console.print(
            f"\n[yellow]  ⚠ {resource} pressure — "
            f"consider adding nodes or optimizing workloads[/yellow]"
        )


def render_quota(quotas):
    if not quotas:
        console.print("[dim]No resource quotas found[/dim]")
        return

    for quota in quotas:
        table = Table(
            show_header=True,
            header_style=t()["header"],
            border_style=t()["border"],
            expand=True,
            show_lines=False,
        )

        table.add_column("Resource")
        table.add_column("Used", justify="right")
        table.add_column("Limit", justify="right")
        table.add_column("Usage", width=24)

        for res in quota["resources"]:
            try:
                used_val = int(res["used"])
                limit_val = int(res["limit"])
                pct = (
                    int((used_val / limit_val) * 100)
                    if limit_val > 0 else 0
                )
                bar = _usage_bar(pct)
            except (ValueError, TypeError):
                bar = "[dim]-[/dim]"

            table.add_row(
                res["resource"],
                res["used"],
                res["limit"],
                bar,
            )

        console.print(
            Panel(
                table,
                title=f"[bold]📋 Quota: {quota['name']}[/bold]",
                border_style=t()["primary"],
            )
        )


def render_drain_check(data):
    if not data:
        console.print("[red]Node not found[/red]")
        return

    unsafe_count = data["unsafe"]
    is_safe = unsafe_count == 0

    safe_display = (
        "[green]✓ SAFE TO DRAIN[/green]"
        if is_safe
        else f"[bold red]⚠ {unsafe_count} UNSAFE PODS[/bold red]"
    )

    border = "green" if is_safe else "red"

    header = (
        f"[bold]{data['node']}[/bold]\n"
        f"\n"
        f"  Total pods:     {data['total_pods']}\n"
        f"  Safe to evict:  [green]{data['safe_to_evict']}[/green]\n"
        f"  Unsafe:         "
        f"{'[dim]0[/dim]' if is_safe else f'[red]{unsafe_count}[/red]'}\n"
        f"\n"
        f"  Verdict: {safe_display}"
    )

    console.print(
        Panel(
            header,
            title="[bold]🔧 Drain Check[/bold]",
            border_style=border,
        )
    )

    # Unsafe pods detail
    unsafe_pods = [p for p in data["pods"] if not p["safe"]]

    if unsafe_pods:
        table = Table(
            show_header=True,
            header_style=t()["header"],
            border_style=t()["border"],
            expand=True,
            show_lines=False,
        )
        table.add_column("", width=2)
        table.add_column("Pod")
        table.add_column("Namespace")
        table.add_column("Owner")
        table.add_column("Reason", style="dim")

        for p in unsafe_pods:
            table.add_row(
                "[red]●[/red]",
                f"[red]{p['name']}[/red]",
                p["namespace"],
                p["owner_kind"],
                p.get("reason", "no PDB / standalone pod"),
            )

        console.print(
            Panel(
                table,
                title="[bold]⚠ Unsafe to Evict[/bold]",
                border_style=t()["error"],
            )
        )

        console.print(
            "\n[dim]  These pods have no PDB or are not "
            "managed by a controller[/dim]"
        )
