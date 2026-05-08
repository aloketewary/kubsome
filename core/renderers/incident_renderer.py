from rich.console import Console
from rich.panel import Panel
from rich.table import Table

console = Console()


def render_incident_started(incident):
    console.print(
        Panel(
            (
                f"[bold red]🚨 INCIDENT MODE ACTIVE[/bold red]\n\n"
                f"  ID:        {incident['id']}\n"
                f"  Title:     {incident['title']}\n"
                f"  Context:   {incident['context']}\n"
                f"  Namespace: {incident['namespace']}\n"
                f"  Started:   {incident['started'][:19]}\n\n"
                f"[dim]Commands:[/dim]\n"
                f"  [cyan]note <text>[/cyan]     — add observation\n"
                f"  [cyan]snapshot[/cyan]        — capture state\n"
                f"  [cyan]incident stop[/cyan]   — close & export"
            ),
            title="[bold]🚨 Incident[/bold]",
            border_style="red"
        )
    )


def render_incident_stopped(incident, export_path):
    duration = ""
    if incident.get("ended") and incident.get("started"):
        from datetime import datetime
        start = datetime.fromisoformat(
            incident["started"]
        )
        end = datetime.fromisoformat(
            incident["ended"]
        )
        mins = int((end - start).total_seconds() / 60)
        duration = f"{mins} minutes"

    console.print(
        Panel(
            (
                f"[green]✓ Incident closed[/green]\n\n"
                f"  Title:     {incident['title']}\n"
                f"  Duration:  {duration}\n"
                f"  Notes:     {len(incident['notes'])}\n"
                f"  Snapshots: {len(incident['snapshots'])}\n"
                f"  Timeline:  {len(incident['timeline'])} events\n\n"
                f"  [dim]Exported to:[/dim]\n"
                f"  {export_path}"
            ),
            title="[bold]📋 Incident Report[/bold]",
            border_style="green"
        )
    )


def render_incident_status(incident):
    if not incident:
        console.print(
            "[dim]No active incident[/dim]"
        )
        return

    table = Table(
        show_header=True,
        header_style="bold cyan",
        border_style="dim",
        expand=True
    )
    table.add_column("Time", width=20)
    table.add_column("Event")
    table.add_column("Detail")

    for entry in incident["timeline"]:
        table.add_row(
            entry["time"][11:19],
            entry["event"],
            entry["detail"][:50]
        )

    console.print(
        Panel(
            table,
            title=(
                f"[bold]🚨 {incident['title']}[/bold]"
            ),
            border_style="red"
        )
    )
