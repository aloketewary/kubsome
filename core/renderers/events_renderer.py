from rich.console import Console
from rich.panel import Panel
from rich.table import Table
from rich.console import Group
from datetime import datetime

console = Console()


def render_events(events):
    if not events:
        console.print("[dim]No events found[/dim]")
        return

    warnings = sum(
        1 for e in events if e["type"] == "Warning"
    )

    summary = (
        f"[bold]{len(events)}[/bold] events  │  "
        f"[yellow]● {warnings} warnings[/yellow]  │  "
        f"[dim]{events[-1].get('last_seen', '')[:19]}[/dim]"
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

    table.add_column("Type", width=8)
    table.add_column("Kind", width=12)
    table.add_column("Object", width=30, no_wrap=True)
    table.add_column("Reason", width=22)
    table.add_column("Message")
    table.add_column("×", justify="right", width=3)

    for ev in events:
        type_style = (
            "yellow" if ev["type"] == "Warning"
            else "dim"
        )

        table.add_row(
            f"[{type_style}]{ev['type']}[/{type_style}]",
            ev["kind"],
            ev["object"],
            ev["reason"],
            ev["message"][:60],
            str(ev["count"])
        )

    console.print(table)


def build_events_watch_view(events, namespace):
    """Returns a renderable for Live updates."""

    warnings = sum(
        1 for e in events if e["type"] == "Warning"
    )

    now = datetime.now().strftime("%H:%M:%S")

    header = (
        f"[bold cyan]⟳ EVENTS[/bold cyan]  "
        f"[dim]{namespace}[/dim]  │  "
        f"[bold]{len(events)}[/bold] events  │  "
        f"[yellow]● {warnings} warnings[/yellow]  │  "
        f"[dim]Updated {now}[/dim]  │  "
        f"[dim italic]Ctrl+C to exit[/dim italic]"
    )

    header_panel = Panel.fit(
        header, border_style="cyan"
    )

    table = Table(
        show_header=True,
        header_style="bold cyan",
        border_style="dim",
        expand=True,
        show_lines=False
    )

    table.add_column("Type", width=8)
    table.add_column("Kind", width=12)
    table.add_column("Object", width=30, no_wrap=True)
    table.add_column("Reason", width=22)
    table.add_column("Message")
    table.add_column("×", justify="right", width=3)

    for ev in events[-30:]:
        type_style = (
            "yellow" if ev["type"] == "Warning"
            else "dim"
        )

        reason_style = ""
        if ev["reason"] in [
            "BackOff", "Failed", "FailedScheduling",
            "OOMKilling", "Unhealthy"
        ]:
            reason_style = "red"

        reason_display = (
            f"[{reason_style}]{ev['reason']}[/{reason_style}]"
            if reason_style
            else ev["reason"]
        )

        table.add_row(
            f"[{type_style}]{ev['type']}[/{type_style}]",
            ev["kind"],
            ev["object"],
            reason_display,
            ev["message"][:60],
            str(ev["count"])
        )

    return Group(header_panel, table)
