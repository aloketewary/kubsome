from rich.console import Console
from rich.panel import Panel
from rich.table import Table

console = Console()


def render_snapshot_diff(diff_data):
    if not diff_data:
        console.print(
            "[dim]No previous snapshot to compare[/dim]"
        )
        return

    console.print(
        Panel.fit(
            f"[dim]Comparing against: "
            f"{diff_data['timestamp'][:19]}[/dim]",
            border_style="cyan"
        )
    )

    for resource_type in ("pods", "deployments"):
        data = diff_data.get(resource_type, {})
        added = data.get("added", [])
        removed = data.get("removed", [])
        changed = data.get("changed", [])

        if not added and not removed and not changed:
            continue

        lines = []

        if added:
            for name in added:
                lines.append(f"  [green]+ {name}[/green]")

        if removed:
            for name in removed:
                lines.append(f"  [red]- {name}[/red]")

        if changed:
            for item in changed:
                changes_str = ", ".join(item["changes"])
                lines.append(
                    f"  [yellow]~ {item['name']}[/yellow] "
                    f"[dim]({changes_str})[/dim]"
                )

        console.print(
            Panel(
                "\n".join(lines),
                title=(
                    f"[bold]{resource_type.capitalize()} "
                    f"Changes[/bold]"
                ),
                border_style="yellow"
            )
        )


def render_changelog(changelog):
    if not changelog:
        console.print(
            "[green]✓ No significant changes[/green]"
        )
        return

    lines = []
    for entry in changelog:
        if entry["type"] == "scaling":
            icon = "📈"
        elif entry["type"] == "lifecycle":
            icon = "🔄"
        elif entry["type"] == "failures":
            icon = "❌"
        elif entry["type"] == "deployments":
            icon = "🚀"
        else:
            icon = "•"

        lines.append(
            f"  {icon} [bold]{entry['summary']}[/bold]"
        )
        for detail in entry.get("details", [])[:3]:
            lines.append(f"     [dim]{detail}[/dim]")

    console.print(
        Panel(
            "\n".join(lines),
            title="[bold]📋 Changelog[/bold]",
            border_style="cyan"
        )
    )


def render_resource_history(events, name):
    if not events:
        console.print(
            f"[dim]No events found for '{name}'[/dim]"
        )
        return

    table = Table(
        show_header=True,
        header_style="bold cyan",
        border_style="dim",
        expand=True
    )

    table.add_column("Time", width=20)
    table.add_column("Type", width=8)
    table.add_column("Reason", width=20)
    table.add_column("Message")

    for ev in events:
        type_style = (
            "yellow" if ev["type"] == "Warning"
            else "dim"
        )

        table.add_row(
            ev.get("last_seen", "")[:19],
            f"[{type_style}]{ev['type']}[/{type_style}]",
            ev["reason"],
            ev["message"][:50]
        )

    console.print(
        Panel(
            table,
            title=f"[bold]📜 History: {name}[/bold]",
            border_style="cyan"
        )
    )
