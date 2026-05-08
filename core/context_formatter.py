from rich.table import Table
from rich.console import Console

console = Console()


def render_contexts(contexts):
    table = Table(
        title="Kubernetes Contexts",
        header_style="bold cyan"
    )

    table.add_column("Context")
    table.add_column("Environment")
    table.add_column("Namespace")
    table.add_column("Risk")

    for ctx in contexts:

        env = ctx["environment"]
        risk = ctx["risk"]

        risk_style = "green"

        if risk == "MEDIUM":
            risk_style = "yellow"

        if risk == "HIGH":
            risk_style = "bold red"

        table.add_row(
            ctx["name"],
            env,
            ctx["namespace"],
            f"[{risk_style}]{risk}[/{risk_style}]"
        )

    console.print(table)