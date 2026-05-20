"""
Compare Renderer — multi-cluster drift detection with
side-by-side diffs and sync status.
"""

from rich.console import Console
from rich.panel import Panel
from rich.table import Table

console = Console()

from core.theme import t


def render_comparison(data):
    if data.get("in_sync"):
        console.print(
            Panel(
                (
                    "[green]  ✓ Environments are in sync[/green]\n"
                    "\n"
                    f"  A: {data['ctx_a']} [dim]({data.get('ns_a', '')})[/dim]\n"
                    f"  B: {data['ctx_b']} [dim]({data.get('ns_b', '')})[/dim]"
                ),
                title="[bold]🔄 Compare[/bold]",
                border_style=t()["success"],
            )
        )
        return

    # Summary
    only_a = len(data.get("only_a", []))
    only_b = len(data.get("only_b", []))
    diffs = len(data.get("diffs", []))
    total_drift = only_a + only_b + diffs

    parts = [f"[bold]{total_drift}[/bold] differences"]
    if only_a:
        parts.append(f"[red]{only_a} only in A[/red]")
    if only_b:
        parts.append(f"[yellow]{only_b} only in B[/yellow]")
    if diffs:
        parts.append(f"[cyan]{diffs} changed[/cyan]")

    console.print(Panel.fit("  │  ".join(parts), border_style=t()["warning"]))

    # Header
    console.print(
        f"  [bold cyan]A:[/bold cyan] {data['ctx_a']} "
        f"[dim]({data.get('ns_a', '')})[/dim]"
    )
    console.print(
        f"  [bold cyan]B:[/bold cyan] {data['ctx_b']} "
        f"[dim]({data.get('ns_b', '')})[/dim]\n"
    )

    # Only in A
    if data.get("only_a"):
        lines = [f"  [red]- {n}[/red]" for n in data["only_a"]]
        console.print(
            Panel(
                "\n".join(lines),
                title="[bold]Only in A[/bold]",
                border_style=t()["error"],
            )
        )

    # Only in B
    if data.get("only_b"):
        lines = [f"  [green]+ {n}[/green]" for n in data["only_b"]]
        console.print(
            Panel(
                "\n".join(lines),
                title="[bold]Only in B[/bold]",
                border_style=t()["success"],
            )
        )

    # Diffs
    if data.get("diffs"):
        table = Table(
            show_header=True,
            header_style=t()["header"],
            border_style=t()["border"],
            expand=True,
            show_lines=False,
        )

        table.add_column("Deployment", width=25)
        table.add_column("Field", width=20)
        table.add_column("A", style="red", ratio=1)
        table.add_column("B", style="green", ratio=1)

        for diff in data["diffs"]:
            for i, change in enumerate(diff.get("changes", [])):
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
                border_style=t()["warning"],
            )
        )

    console.print(
        f"\n[dim]{'─' * 3} {total_drift} differences {'─' * 3}[/dim]"
    )
