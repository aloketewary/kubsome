"""
Incident Renderer — incident lifecycle display with
timeline, duration, and export status.
"""

from rich.console import Console
from rich.panel import Panel
from rich.table import Table

console = Console()


def render_incident_started(incident):
    console.print(
        Panel(
            (
                "[bold red]🚨 INCIDENT MODE ACTIVE[/bold red]\n"
                "\n"
                f"  ID:        [dim]{incident['id']}[/dim]\n"
                f"  Title:     [bold]{incident['title']}[/bold]\n"
                f"  Context:   {incident['context']}\n"
                f"  Namespace: {incident['namespace']}\n"
                f"  Started:   {incident['started'][:19]}\n"
                "\n"
                "[dim]Commands:[/dim]\n"
                "  [cyan]note <text>[/cyan]       — add observation\n"
                "  [cyan]snapshot[/cyan]          — capture cluster state\n"
                "  [cyan]incident status[/cyan]   — view timeline\n"
                "  [cyan]incident share[/cyan]    — export to Slack/Teams\n"
                "  [cyan]incident stop[/cyan]     — close & export report"
            ),
            title="[bold]🚨 Incident[/bold]",
            border_style="red",
        )
    )


def render_incident_stopped(incident, export_path):
    duration = ""
    if incident.get("ended") and incident.get("started"):
        from datetime import datetime
        start = datetime.fromisoformat(incident["started"])
        end = datetime.fromisoformat(incident["ended"])
        total_sec = int((end - start).total_seconds())
        if total_sec < 3600:
            duration = f"{total_sec // 60}m {total_sec % 60}s"
        else:
            duration = f"{total_sec // 3600}h {(total_sec % 3600) // 60}m"

    notes = len(incident.get("notes", []))
    snapshots = len(incident.get("snapshots", []))
    timeline = len(incident.get("timeline", []))

    console.print(
        Panel(
            (
                "[green]✓ Incident closed[/green]\n"
                "\n"
                f"  Title:     [bold]{incident['title']}[/bold]\n"
                f"  Duration:  {duration}\n"
                f"  Notes:     {notes}\n"
                f"  Snapshots: {snapshots}\n"
                f"  Timeline:  {timeline} events\n"
                "\n"
                f"  [dim]Exported to:[/dim]\n"
                f"  [cyan]{export_path}[/cyan]"
            ),
            title="[bold]📋 Incident Report[/bold]",
            border_style="green",
        )
    )


def render_incident_status(incident):
    if not incident:
        console.print("[dim]No active incident[/dim]")
        return

    # Duration so far
    from datetime import datetime, timezone
    start = datetime.fromisoformat(
        incident["started"].replace("Z", "+00:00")
    )
    now = datetime.now(timezone.utc)
    elapsed_sec = int((now - start).total_seconds())
    if elapsed_sec < 3600:
        elapsed = f"{elapsed_sec // 60}m"
    else:
        elapsed = f"{elapsed_sec // 3600}h {(elapsed_sec % 3600) // 60}m"

    header = (
        f"[bold red]🚨 {incident['title']}[/bold red]  "
        f"[dim]({elapsed} elapsed)[/dim]"
    )

    console.print(Panel.fit(header, border_style="red"))

    # Timeline
    table = Table(
        show_header=True,
        header_style="bold cyan",
        border_style="dim",
        expand=True,
        show_lines=False,
    )

    table.add_column("", width=2)
    table.add_column("Time", width=8)
    table.add_column("Event", width=12)
    table.add_column("Detail", ratio=1)

    for entry in incident.get("timeline", []):
        event_type = entry.get("event", "")
        if event_type == "note":
            icon = "[cyan]●[/cyan]"
        elif event_type == "snapshot":
            icon = "[green]●[/green]"
        elif event_type == "start":
            icon = "[red]●[/red]"
        else:
            icon = "[dim]○[/dim]"

        table.add_row(
            icon,
            entry.get("time", "")[11:19],
            event_type,
            entry.get("detail", "")[:50],
        )

    console.print(table)
    console.print(
        f"[dim]{'─' * 3} {len(incident.get('timeline', []))} "
        f"events {'─' * 3}[/dim]"
    )
