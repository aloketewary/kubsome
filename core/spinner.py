from rich.console import Console
from rich.spinner import Spinner
from rich.live import Live
from contextlib import contextmanager

console = Console()


@contextmanager
def loading(message="Loading..."):
    """Show a spinner while work is being done."""
    with Live(
        Spinner("dots", text=f" {message}"),
        console=console,
        transient=True
    ):
        yield
