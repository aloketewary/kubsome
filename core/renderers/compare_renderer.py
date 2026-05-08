from rich.console import Console
from rich.panel import Panel
from rich.table import Table

console = Console()


def render_comparison(data):
    if data["in_sync"]:
        console.print(
            Panel(
                (
                    f"[green]✓ Environments are in sync[/green]\n\n"
                    f"  A: {data['ctx_a']} ({data.get('ns_a', '')})\n"
                    f"  B: {data['ctx_b']} ({data.get('ns_b', '')})"
                ),
                title="[bold]🔄 Compare[/bold]",
                border_style="green"
            )
        )
        return

    # Header
    header = (
        f"[bold cyan]A:[/bold cyan] {data['ctx_a']} "
        f"[dim]({data.get('ns_a', '')})[/dim]\n"
        f"[bold cyan]B:[/bold cyan] {data['ctx_b']} "
        f"[dim]({data.get('ns_b', '')})[/dim]"
    )

    console.print(
        Panel(header, title="[bold]🔄 Compare[/bold]", border_style="cyan")
    )

    # Only in A
    if data["only_a"]:
        console.print(
            Panel(
                "\n".join(
                    f"  [red]- {n}[/red]"
                    for n in data["only_a"]
                ),
                title="[bold]Only in A[/bold]",
                border_style="red"
            )
        )

    # Only in B
    if data["only_b"]:
        console.print(
            Panel(
                "\n".join(
                    f"  [yellow]+ {n}[/yellow]"
                    for n in data["only_b"]
                ),
                title="[bold]Only in B[/bold]",
                border_style="yellow"
            )
        )

    # Diffs
    if data["diffs"]:
        table = Table(
            show_header=True,
            header_style="bold cyan",
            border_style="dim",
            expand=True,
            show_lines=True
        )

        table.add_column("Deployment")
        table.add_column("Field")
        table.add_column("A", style="red")
        table.add_column("B", style="green")

        for diff in data["diffs"]:
            for i, change in enumerate(diff["changes"]):
                table.add_row(
                    diff["name"] if i == 0 else "",
                    change["field"],
                    change["a"][-40:],
                    change["b"][-40:],
                )

        console.print(
            Panel(
                table,
                title="[bold]⚡ Drift Detected[/bold]",
                border_style="yellow"
            )
        )
