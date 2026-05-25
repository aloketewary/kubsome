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

def _print_banner(host: str, port: int):
    from core.version import __version__
    url = f"http://localhost:{port}" if host == "0.0.0.0" else f"http://{host}:{port}"
    content = (
        f"[bold cyan]◆[/bold cyan] [bold]Kubsome Server[/bold] "
        f"[dim]v{__version__}[/dim]\n"
        f"\n"
        f"  [dim]API:[/dim]  [cyan]{url}/api[/cyan]\n"
        f"  [dim]UI:[/dim]   [cyan]{url}/app[/cyan]\n"
        f"  [dim]Docs:[/dim] [cyan]{url}/docs[/cyan]"
    )
    console.print()
    console.print(Panel.fit(content, border_style="cyan"))
    console.print()


def _release_port(port: int):
    """Kill any process occupying the given port."""
    import subprocess
    result = subprocess.run(
        ["lsof", "-ti", f":{port}"],
        capture_output=True, text=True
    )
    pids = result.stdout.strip().split()
    if pids:
        console.print(f"[yellow]⚠ Port {port} in use — releasing...[/yellow]")
        subprocess.run(["kill", "-9"] + pids, capture_output=True)


def start(
    host: str = "0.0.0.0",
    port: int = 8000,
    no_browser: bool = False,
):
    import os
    import signal

    # Only print banner in the main process (not the reloader child)
    if os.environ.get("WATCHFILES_FORCE_POLLING") is None and "UVICORN_STARTED" not in os.environ:
        os.environ["UVICORN_STARTED"] = "1"
        _release_port(port)
        _print_banner(host, port)

    if not no_browser:
        import webbrowser
        import threading

        def open_browser():
            webbrowser.open(f"http://localhost:{port}/app")

        threading.Timer(1.5, open_browser).start()

    # Ensure Ctrl+C works reliably
    signal.signal(signal.SIGINT, signal.SIG_DFL)

    uvicorn.run(
        "api.app:app", host=host, port=port, reload=True,
        reload_excludes=["*.pyc", "kubsome-*", "dist/*", "build/*", "*.egg-info"],
    )


if __name__ == "__main__":
    start()
