from rich.console import Console
from rich.panel import Panel
from rich.table import Table

console = Console()


def render_netcheck(data):
    # Pod info
    pod_ip = data["pod_ip"]
    header = (
        f"[bold cyan]Pod:[/bold cyan]     {data['pod']}\n"
        f"[bold cyan]Pod IP:[/bold cyan]  {pod_ip['pod_ip']}\n"
        f"[bold cyan]Host IP:[/bold cyan] {pod_ip['host_ip']}"
    )

    console.print(
        Panel(header, title="[bold]🌐 Network Check[/bold]", border_style="cyan")
    )

    # DNS checks
    dns_table = Table.grid(padding=(0, 2))
    dns_table.add_column(width=3)
    dns_table.add_column(width=40)
    dns_table.add_column(width=12)

    for test in data["dns"]:
        icon = "[green]✓[/green]" if test["success"] else "[red]✗[/red]"
        dns_table.add_row(
            icon, test["host"], test["label"]
        )

    console.print(
        Panel(dns_table, title="[bold]🔍 DNS[/bold]", border_style="dim")
    )

    # Service endpoints
    if data["services"]:
        svc_table = Table(
            show_header=True,
            header_style="bold cyan",
            border_style="dim",
            expand=True
        )
        svc_table.add_column("", width=3)
        svc_table.add_column("Service")
        svc_table.add_column("Ready", justify="right")
        svc_table.add_column("Not Ready", justify="right")

        for svc in data["services"]:
            icon = "[green]●[/green]" if svc["healthy"] else "[red]●[/red]"
            svc_table.add_row(
                icon, svc["name"],
                str(svc["ready"]),
                str(svc["not_ready"])
            )

        console.print(
            Panel(svc_table, title="[bold]🔌 Endpoints[/bold]", border_style="dim")
        )

    # Network policies
    np = data["network_policy"]
    if np["exists"]:
        console.print(
            f"  [cyan]🛡️  {np['count']} NetworkPolicies active[/cyan]"
        )
    else:
        console.print(
            "  [yellow]⚠ No NetworkPolicies — all traffic allowed[/yellow]"
        )


def render_cronjobs(cronjobs):
    if not cronjobs:
        console.print("[dim]No cronjobs found[/dim]")
        return

    table = Table(
        show_header=True,
        header_style="bold cyan",
        border_style="dim",
        expand=True
    )

    table.add_column("", width=3)
    table.add_column("CronJob")
    table.add_column("Schedule")
    table.add_column("Last Run", width=20)
    table.add_column("Active", justify="right", width=6)

    for cj in cronjobs:
        if cj["suspended"]:
            icon = "[yellow]⏸[/yellow]"
        elif cj["active"] > 0:
            icon = "[green]▶[/green]"
        else:
            icon = "[dim]●[/dim]"

        table.add_row(
            icon,
            cj["name"],
            cj["schedule"],
            cj["last_schedule"][:19] if cj["last_schedule"] != "Never" else "Never",
            str(cj["active"])
        )

    console.print(
        Panel(table, title="[bold]🕐 CronJobs[/bold]", border_style="cyan")
    )


def render_jobs(jobs):
    if not jobs:
        console.print("[dim]No jobs found[/dim]")
        return

    table = Table(
        show_header=True,
        header_style="bold cyan",
        border_style="dim",
        expand=True
    )

    table.add_column("", width=3)
    table.add_column("Job")
    table.add_column("State", width=12)
    table.add_column("Succeeded", justify="right", width=9)
    table.add_column("Failed", justify="right", width=6)

    for job in jobs:
        if job["state"] == "Succeeded":
            icon = "[green]✓[/green]"
            style = "green"
        elif job["state"] == "Failed":
            icon = "[red]✗[/red]"
            style = "red"
        elif job["state"] == "Running":
            icon = "[cyan]▶[/cyan]"
            style = "cyan"
        else:
            icon = "[dim]●[/dim]"
            style = "dim"

        table.add_row(
            icon, job["name"],
            f"[{style}]{job['state']}[/{style}]",
            str(job["succeeded"]),
            str(job["failed"])
        )

    console.print(
        Panel(table, title="[bold]⚡ Jobs[/bold]", border_style="cyan")
    )


def render_config(data):
    if not data:
        console.print("[red]Resource not found[/red]")
        return

    lines = []
    for key, value in data["data"].items():
        # Truncate long values
        display = value[:80]
        if len(value) > 80:
            display += "..."
        lines.append(f"  [cyan]{key}[/cyan] = {display}")

    content = "\n".join(lines) if lines else "[dim]Empty[/dim]"

    console.print(
        Panel(
            content,
            title=(
                f"[bold]📄 {data['type']}: "
                f"{data['name']}[/bold]"
            ),
            border_style="cyan"
        )
    )


def render_diff(data):
    if not data:
        console.print("[red]Deployment not found[/red]")
        return

    if not data["changes"]:
        msg = data.get("message", "No changes detected")
        console.print(
            Panel(
                f"[dim]{msg}[/dim]",
                title=f"[bold]📝 {data['name']}[/bold]",
                border_style="dim"
            )
        )
        return

    header = (
        f"[bold cyan]Deployment:[/bold cyan] {data['name']}\n"
        f"[bold cyan]Revision:[/bold cyan]   "
        f"{data.get('previous_revision', '?')} → "
        f"{data.get('current_revision', '?')}"
    )

    console.print(
        Panel(header, title="[bold]📝 Diff[/bold]", border_style="cyan")
    )

    table = Table(
        show_header=True,
        header_style="bold cyan",
        border_style="dim",
        expand=True,
        show_lines=True
    )

    table.add_column("Field")
    table.add_column("Previous", style="red")
    table.add_column("Current", style="green")

    for change in data["changes"]:
        table.add_row(
            change["field"],
            change["old"][-50:],
            change["new"][-50:]
        )

    console.print(table)
