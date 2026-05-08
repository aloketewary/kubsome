from rich.console import Console
from rich.panel import Panel
from rich.table import Table

console = Console()


def render_rbac(bindings):
    if not bindings:
        console.print("[dim]No role bindings found[/dim]")
        return

    table = Table(
        show_header=True,
        header_style="bold cyan",
        border_style="dim",
        expand=True
    )

    table.add_column("Subject", ratio=2)
    table.add_column("Kind", width=15)
    table.add_column("Role", ratio=2)
    table.add_column("Scope", width=10)

    for b in bindings:
        scope_style = (
            "yellow" if b["scope"] == "Cluster"
            else "dim"
        )

        table.add_row(
            b["subject"],
            b["subject_kind"],
            f"{b['role_kind']}/{b['role']}",
            f"[{scope_style}]{b['scope']}[/{scope_style}]"
        )

    console.print(
        Panel(
            table,
            title="[bold]🔐 RBAC[/bold]",
            border_style="cyan"
        )
    )


def render_timeline(events):
    if not events:
        console.print("[dim]No events in timeline[/dim]")
        return

    # Group by time buckets (every 5 min)
    lines = []
    last_time = ""

    for ev in events:
        time_str = ev["time"][11:16]  # HH:MM

        if time_str != last_time:
            lines.append(
                f"\n  [bold cyan]{time_str}[/bold cyan]"
            )
            last_time = time_str

        # Style by type
        if ev["type"] == "Warning":
            icon = "[yellow]⚠[/yellow]"
        else:
            icon = "[dim]●[/dim]"

        reason_style = ""
        if ev["reason"] in (
            "BackOff", "Failed", "FailedScheduling",
            "OOMKilling", "Unhealthy", "Killing"
        ):
            reason_style = "red"
        elif ev["reason"] in (
            "Pulled", "Created", "Started",
            "ScalingReplicaSet"
        ):
            reason_style = "green"

        reason_display = (
            f"[{reason_style}]{ev['reason']}[/{reason_style}]"
            if reason_style else ev["reason"]
        )

        count_str = (
            f" [dim]×{ev['count']}[/dim]"
            if ev["count"] > 1 else ""
        )

        lines.append(
            f"    {icon} {reason_display} "
            f"[dim]{ev['kind']}/{ev['object']}[/dim]"
            f"{count_str}"
        )

    content = "\n".join(lines)

    console.print(
        Panel(
            content,
            title="[bold]📅 Timeline[/bold]",
            border_style="cyan"
        )
    )


def render_labels(resources):
    if not resources:
        console.print("[dim]No resources found[/dim]")
        return

    for res in resources:
        lines = []

        if res["labels"]:
            lines.append("[bold cyan]Labels:[/bold cyan]")
            for k, v in res["labels"].items():
                lines.append(f"  [cyan]{k}[/cyan] = {v}")

        if res["annotations"]:
            lines.append("\n[bold cyan]Annotations:[/bold cyan]")
            for k, v in list(res["annotations"].items())[:10]:
                val = v[:60] + "..." if len(v) > 60 else v
                lines.append(f"  [dim]{k}[/dim] = {val}")

        console.print(
            Panel(
                "\n".join(lines) if lines else "[dim]No labels[/dim]",
                title=f"[bold]🏷️  {res['name']}[/bold]",
                border_style="dim"
            )
        )
