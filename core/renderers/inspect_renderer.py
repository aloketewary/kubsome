from rich.console import Console
from rich.panel import Panel
from rich.table import Table
from rich.align import Align
from rich.console import Group

console = Console()


def render_inspect(details, events, logs, recommendation):
    # Pod Info Panel
    info_content = (
        f"[bold cyan]Name:[/bold cyan]       {details['name']}\n"
        f"[bold cyan]Namespace:[/bold cyan]  {details['namespace']}\n"
        f"[bold cyan]Node:[/bold cyan]       {details['node']}\n"
        f"[bold cyan]Pod IP:[/bold cyan]     {details['pod_ip']}\n"
        f"[bold cyan]Host IP:[/bold cyan]    {details['host_ip']}\n"
        f"[bold cyan]Phase:[/bold cyan]      {_styled_phase(details['phase'])}\n"
        f"[bold cyan]Age:[/bold cyan]        {details['age']}\n"
        f"[bold cyan]Restart:[/bold cyan]    {details['restart_policy']}\n"
        f"[bold cyan]SA:[/bold cyan]         {details['service_account']}"
    )

    console.print(
        Panel(
            info_content,
            title="[bold]🔍 Pod Info[/bold]",
            border_style="cyan"
        )
    )

    # Containers Table
    ct = Table(
        show_header=True,
        header_style="bold cyan",
        border_style="dim",
        expand=True
    )
    ct.add_column("Container")
    ct.add_column("Image", no_wrap=True)
    ct.add_column("State", justify="center")
    ct.add_column("Ready", justify="center")
    ct.add_column("Restarts", justify="right")
    ct.add_column("Ports")

    for c in details["containers"]:
        state_style = "green" if c["state"] == "running" else "red"
        ready_icon = "[green]✓[/green]" if c["ready"] else "[red]✗[/red]"

        ct.add_row(
            c["name"],
            c["image"],
            f"[{state_style}]{c['state']}[/{state_style}]",
            ready_icon,
            str(c["restarts"]),
            ", ".join(c["ports"]) if c["ports"] else "-"
        )

    console.print(
        Panel(
            ct,
            title="[bold]📦 Containers[/bold]",
            border_style="blue"
        )
    )

    # Probes Panel
    probe_table = Table.grid(padding=(0, 2))
    probe_table.add_column(width=16)
    probe_table.add_column(width=12)
    probe_table.add_column(width=12)
    probe_table.add_column(width=12)

    probe_table.add_row(
        "[bold]Container[/bold]",
        "[bold]Liveness[/bold]",
        "[bold]Readiness[/bold]",
        "[bold]Startup[/bold]"
    )

    for c in details["containers"]:
        probe_table.add_row(
            c["name"],
            _probe_display(c["liveness"]),
            _probe_display(c["readiness"]),
            _probe_display(c["startup"]),
        )

    console.print(
        Panel(
            probe_table,
            title="[bold]🩺 Probes[/bold]",
            border_style="magenta"
        )
    )

    # Resources Panel
    res_table = Table.grid(padding=(0, 2))
    res_table.add_column(width=16)
    res_table.add_column(width=20)
    res_table.add_column(width=20)

    res_table.add_row(
        "[bold]Container[/bold]",
        "[bold]Requests[/bold]",
        "[bold]Limits[/bold]"
    )

    for c in details["containers"]:
        requests = c["resources"].get("requests", {})
        limits = c["resources"].get("limits", {})

        req_str = (
            f"cpu:{requests.get('cpu', '-')} "
            f"mem:{requests.get('memory', '-')}"
        )
        lim_str = (
            f"cpu:{limits.get('cpu', '-')} "
            f"mem:{limits.get('memory', '-')}"
        )

        res_table.add_row(c["name"], req_str, lim_str)

    console.print(
        Panel(
            res_table,
            title="[bold]📊 Resources[/bold]",
            border_style="green"
        )
    )

    # Volumes
    if details["volumes"]:
        vol_list = "  ".join(
            f"[dim]•[/dim] {v}" for v in details["volumes"]
        )
        console.print(
            Panel(
                vol_list,
                title="[bold]💾 Volumes[/bold]",
                border_style="dim"
            )
        )

    # Events
    if events:
        ev_table = Table(
            show_header=True,
            header_style="bold cyan",
            border_style="dim",
            expand=True
        )
        ev_table.add_column("Type", width=8)
        ev_table.add_column("Reason", width=20)
        ev_table.add_column("Message")
        ev_table.add_column("Count", justify="right", width=5)

        for ev in events[-10:]:
            type_style = (
                "yellow" if ev["type"] == "Warning"
                else "dim"
            )
            ev_table.add_row(
                f"[{type_style}]{ev['type']}[/{type_style}]",
                ev["reason"],
                ev["message"][:80],
                str(ev["count"])
            )

        console.print(
            Panel(
                ev_table,
                title="[bold]⚡ Events[/bold]",
                border_style="yellow"
            )
        )

    # Logs
    if logs:
        log_lines = logs.strip().split("\n")[-20:]
        colored_logs = "\n".join(
            _color_log_line(line) for line in log_lines
        )
        console.print(
            Panel(
                colored_logs,
                title="[bold]📜 Recent Logs[/bold]",
                border_style="dim"
            )
        )

    # Recommendation
    if recommendation and recommendation != "Healthy":
        console.print(
            Panel(
                f"[bold yellow]💡 {recommendation}[/bold yellow]",
                title="[bold]🧠 Recommendation[/bold]",
                border_style="yellow"
            )
        )


def _styled_phase(phase):
    styles = {
        "Running": "[green]Running[/green]",
        "Pending": "[yellow]Pending[/yellow]",
        "Failed": "[red]Failed[/red]",
        "Succeeded": "[dim]Succeeded[/dim]",
    }
    return styles.get(phase, phase)


def _probe_display(probe):
    if not probe:
        return "[dim]none[/dim]"
    return f"[green]{probe}[/green]"


def _color_log_line(line):
    lower = line.lower()
    if "error" in lower or "fatal" in lower:
        return f"[red]{line}[/red]"
    if "warn" in lower:
        return f"[yellow]{line}[/yellow]"
    if "info" in lower:
        return f"[dim]{line}[/dim]"
    return line
