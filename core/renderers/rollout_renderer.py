from rich.console import Console
from rich.panel import Panel
from rich.table import Table

console = Console()


def render_rollout(status, history):
    if not status:
        console.print("[red]Deployment not found[/red]")
        return

    # Progress bar
    desired = status["desired"]
    ready = status["ready"]

    if desired > 0:
        progress = int((ready / desired) * 20)
        remaining = 20 - progress
    else:
        progress = 0
        remaining = 20

    bar = (
        "[green]" + "█" * progress + "[/green]"
        + "[dim]" + "░" * remaining + "[/dim]"
    )

    # Status determination
    if status["stuck"]:
        health = "[bold red]⚠ STUCK[/bold red]"
        border = "red"
    elif ready == desired:
        health = "[green]✓ HEALTHY[/green]"
        border = "green"
    else:
        health = "[yellow]⟳ ROLLING[/yellow]"
        border = "yellow"

    info = (
        f"[bold cyan]Deployment:[/bold cyan]  {status['name']}\n"
        f"[bold cyan]Image:[/bold cyan]       {status['image']}\n"
        f"[bold cyan]Strategy:[/bold cyan]    {status['strategy']}\n"
        f"[bold cyan]Status:[/bold cyan]      {health}\n"
        f"\n"
        f"[bold cyan]Progress:[/bold cyan]    {bar}  "
        f"{ready}/{desired}\n"
        f"\n"
        f"  [green]● Ready:[/green]       {status['ready']}\n"
        f"  [green]● Available:[/green]   {status['available']}\n"
        f"  [cyan]● Updated:[/cyan]     {status['updated']}\n"
        f"  [red]● Unavailable:[/red] {status['unavailable']}"
    )

    console.print(
        Panel(
            info,
            title="[bold]🚀 Rollout Status[/bold]",
            border_style=border
        )
    )

    # Conditions
    if status["conditions"]:
        ct = Table(
            show_header=True,
            header_style="bold cyan",
            border_style="dim",
            expand=True
        )
        ct.add_column("Type", width=15)
        ct.add_column("Status", width=8)
        ct.add_column("Reason", width=25)
        ct.add_column("Message")

        for cond in status["conditions"]:
            status_style = (
                "green" if cond["status"] == "True"
                else "red"
            )
            ct.add_row(
                cond["type"],
                f"[{status_style}]{cond['status']}[/{status_style}]",
                cond.get("reason", ""),
                cond.get("message", "")[:60]
            )

        console.print(
            Panel(
                ct,
                title="[bold]📋 Conditions[/bold]",
                border_style="dim"
            )
        )

    # History
    if history:
        console.print(
            Panel(
                history.strip(),
                title="[bold]📜 Rollout History[/bold]",
                border_style="dim"
            )
        )

    # Warning if stuck
    if status["stuck"]:
        console.print(
            Panel(
                (
                    "[bold red]Deployment is stuck![/bold red]\n\n"
                    "Possible causes:\n"
                    "  • Image pull failure\n"
                    "  • Readiness probe failing\n"
                    "  • Insufficient resources\n"
                    "  • CrashLoopBackOff\n\n"
                    "[dim]Run:[/dim] [bold]rollback "
                    f"{status['name']}[/bold] to undo"
                ),
                title="[bold]⚠ Stuck Rollout[/bold]",
                border_style="red"
            )
        )
