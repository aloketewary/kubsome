"""
Rollout Renderer — deployment rollout status with progress bar,
conditions, history, and stuck-state remediation hints.
"""

from rich.console import Console
from rich.panel import Panel
from rich.table import Table

console = Console()

from core.theme import t


def render_rollout(status, history):
    if not status:
        console.print("[red]Deployment not found[/red]")
        return

    desired = status["desired"]
    ready = status["ready"]
    pct = int((ready / desired) * 100) if desired > 0 else 0

    # Progress bar
    bar_width = 25
    filled = int((pct / 100) * bar_width)
    if status["stuck"]:
        bar_color = "red"
    elif pct == 100:
        bar_color = "green"
    else:
        bar_color = "yellow"

    bar = (
        f"[{bar_color}]" + "█" * filled + f"[/{bar_color}]"
        + "[dim]" + "░" * (bar_width - filled) + "[/dim]"
    )

    # Status
    if status["stuck"]:
        health = "[bold red]⚠ STUCK[/bold red]"
        border = "red"
    elif ready == desired:
        health = "[green]✓ COMPLETE[/green]"
        border = "green"
    else:
        health = "[yellow]⟳ ROLLING[/yellow]"
        border = "yellow"

    # Header
    info = (
        f"[bold]{status['name']}[/bold]\n"
        f"\n"
        f"  Image:     [dim]{status['image']}[/dim]\n"
        f"  Strategy:  [dim]{status['strategy']}[/dim]\n"
        f"  Status:    {health}\n"
        f"\n"
        f"  Progress:  {bar}  [{bar_color}]{pct}%[/{bar_color}]\n"
        f"\n"
        f"  [green]● Ready:[/green]       {status['ready']}/{desired}    "
        f"[green]● Available:[/green]   {status['available']}\n"
        f"  [cyan]● Updated:[/cyan]     {status['updated']}        "
        f"[red]● Unavailable:[/red] {status['unavailable']}"
    )

    console.print(
        Panel(
            info,
            title="[bold]🚀 Rollout Status[/bold]",
            border_style=border,
        )
    )

    # Conditions
    if status.get("conditions"):
        ct = Table(
            show_header=True,
            header_style=t()["header"],
            border_style=t()["border"],
            expand=True,
            show_lines=False,
        )
        ct.add_column("", width=2)
        ct.add_column("Type", width=18)
        ct.add_column("Status", width=6, justify="center")
        ct.add_column("Reason", width=25)
        ct.add_column("Message", ratio=1)

        for cond in status["conditions"]:
            is_true = cond["status"] == "True"
            icon = "[green]✓[/green]" if is_true else "[red]✗[/red]"
            status_color = "green" if is_true else "red"

            ct.add_row(
                icon,
                cond["type"],
                f"[{status_color}]{cond['status']}[/{status_color}]",
                cond.get("reason", ""),
                cond.get("message", "")[:60],
            )

        console.print(
            Panel(ct, title="[bold]📋 Conditions[/bold]", border_style=t()["border"])
        )

    # History
    if history:
        console.print(
            Panel(
                history.strip(),
                title="[bold]📜 Rollout History[/bold]",
                border_style=t()["border"],
            )
        )

    # Stuck warning with remediation
    if status["stuck"]:
        console.print(
            Panel(
                "[bold red]Deployment is stuck![/bold red]\n"
                "\n"
                "Possible causes:\n"
                "  [dim]•[/dim] Image pull failure\n"
                "  [dim]•[/dim] Readiness probe failing\n"
                "  [dim]•[/dim] Insufficient resources\n"
                "  [dim]•[/dim] CrashLoopBackOff\n"
                "\n"
                "[dim]Next steps:[/dim]\n"
                f"  [cyan]logs {status['name']}[/cyan]"
                "        — check container errors\n"
                f"  [cyan]events[/cyan]"
                "                — review cluster events\n"
                f"  [cyan]rollback {status['name']}[/cyan]"
                "   — undo this rollout",
                title="[bold]⚠ Stuck Rollout[/bold]",
                border_style=t()["error"],
            )
        )
