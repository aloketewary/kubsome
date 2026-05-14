"""
Start the Kubsome API server.

Usage:
    python -m api.serve
    kubsome serve
"""

import uvicorn
from rich.console import Console
from rich.panel import Panel

console = Console()

VERSION = "1.10.4"


def _print_banner(host: str, port: int):
    url = f"http://localhost:{port}" if host == "0.0.0.0" else f"http://{host}:{port}"
    content = (
        f"[bold cyan]◆[/bold cyan] [bold]Kubsome Server[/bold] "
        f"[dim]v{VERSION}[/dim]\n"
        f"\n"
        f"  [dim]API:[/dim]  [cyan]{url}/api[/cyan]\n"
        f"  [dim]UI:[/dim]   [cyan]{url}/app[/cyan]\n"
        f"  [dim]Docs:[/dim] [cyan]{url}/docs[/cyan]"
    )
    console.print()
    console.print(Panel.fit(content, border_style="cyan"))
    console.print()


def start(
    host: str = "0.0.0.0",
    port: int = 8000,
    no_browser: bool = False,
):
    _print_banner(host, port)

    if not no_browser:
        import webbrowser
        import threading

        def open_browser():
            webbrowser.open(f"http://localhost:{port}/app")

        threading.Timer(1.5, open_browser).start()

    uvicorn.run(
        "api.app:app", host=host, port=port, reload=True
    )


if __name__ == "__main__":
    start()
