"""
Resource Operations Renderer — patch, annotate, set-image.
"""

from rich.console import Console

console = Console()


def render_patch(result):
    icon = "✓" if result["success"] else "✗"
    color = "green" if result["success"] else "red"
    console.print(
        f"[{color}]{icon}[/{color}] "
        f"[bold]patch[/bold] {result['resource']}/{result['name']} "
        f"[dim]({result['patch_type']})[/dim]: "
        f"{result['message']}"
    )


def render_annotate(result):
    icon = "✓" if result["success"] else "✗"
    color = "green" if result["success"] else "red"
    action = "removed" if result["removed"] else "set"
    console.print(
        f"[{color}]{icon}[/{color}] "
        f"[bold]annotate[/bold] {result['resource']}/{result['name']} "
        f"[dim]({action})[/dim]: "
        f"{result['message']}"
    )


def render_set_image(result):
    icon = "✓" if result["success"] else "✗"
    color = "green" if result["success"] else "red"
    console.print(
        f"[{color}]{icon}[/{color}] "
        f"[bold]set image[/bold] {result['deployment']} "
        f"{result['container']}=[cyan]{result['image']}[/cyan]: "
        f"{result['message']}"
    )
