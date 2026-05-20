from rich.console import Console
from rich.panel import Panel
from rich.table import Table

console = Console()

from core.theme import t


def render_bookmarks(bookmarks):
    if not bookmarks:
        console.print(
            "[dim]No bookmarks. "
            "Add with: bookmark add <name> <command>[/dim]"
        )
        return

    table = Table.grid(padding=(0, 3))
    table.add_column(style="cyan", width=16)
    table.add_column()

    for b in bookmarks:
        table.add_row(b["name"], f"[dim]{b['command']}[/dim]")

    console.print(
        Panel(
            table,
            title="[bold]⭐ Bookmarks[/bold]",
            border_style=t()["primary"]
        )
    )


def render_workflows(workflows):
    if not workflows:
        console.print(
            "[dim]No workflows. "
            "Add .yaml files to ~/.kubsome/workflows/[/dim]"
        )
        return

    table = Table.grid(padding=(0, 3))
    table.add_column(style="cyan", width=16)
    table.add_column()
    table.add_column(style="dim")

    for wf in workflows:
        steps = " → ".join(wf["steps"][:4])
        if len(wf["steps"]) > 4:
            steps += " → ..."
        table.add_row(
            wf["name"],
            wf["description"],
            steps
        )

    console.print(
        Panel(
            table,
            title="[bold]🔄 Workflows[/bold]",
            border_style=t()["primary"]
        )
    )


def render_workflow_step(step_num, total, command):
    console.print(
        f"  [dim][{step_num}/{total}][/dim] "
        f"[cyan]{command}[/cyan]"
    )
