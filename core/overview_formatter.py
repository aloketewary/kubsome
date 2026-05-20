from rich.console import Console
from rich.panel import Panel
from rich.table import Table
from rich.align import Align

console = Console()

from core.theme import t


def health_bar(healthy, warning, critical, width=20):
    total = healthy + warning + critical
    if total == 0:
        return "[dim]No resources[/dim]"

    h = int((healthy / total) * width)
    w = int((warning / total) * width)
    c = width - h - w

    bar = (
        "[green]" + "█" * h + "[/green]"
        + "[yellow]" + "█" * w + "[/yellow]"
        + "[red]" + "█" * c + "[/red]"
    )
    return bar


def make_table(rows, bar):
    table = Table.grid(padding=(0, 1))
    table.add_column(justify="left", width=18, no_wrap=True)
    table.add_column(justify="right", width=20, no_wrap=True)

    for label, value in rows:
        table.add_row(label, str(value))

    table.add_row("Health", bar)
    return table


def render_overview(
    pod_health,
    node_health,
    deployment_health,
    context
):
    env_info = (
        f"[bold cyan]Context:[/bold cyan]   "
        f"{context.current_context}\n"
        f"[bold cyan]Namespace:[/bold cyan] "
        f"{context.namespace}"
    )

    console.print(
        Align.center(
            Panel.fit(
                env_info,
                title="[bold]🌐 Cluster Overview[/bold]",
                border_style=t()["primary"]
            )
        )
    )

    # Pods
    pod_total = (
        pod_health["healthy"]
        + pod_health["warning"]
        + pod_health["critical"]
    )

    pod_style = "green"
    if pod_health["critical"] > 0:
        pod_style = "red"
    elif pod_health["warning"] > 0:
        pod_style = "yellow"

    pod_table = make_table(
        [
            ("Total", pod_total),
            ("[green]● Ready[/green]", pod_health["healthy"]),
            ("[yellow]● Warning[/yellow]", pod_health["warning"]),
            ("[red]● Critical[/red]", pod_health["critical"]),
        ],
        health_bar(
            pod_health["healthy"],
            pod_health["warning"],
            pod_health["critical"]
        )
    )

    console.print(
        Align.center(
            Panel.fit(
                pod_table,
                title="[bold]📦 Pods[/bold]",
                border_style=pod_style
            )
        )
    )

    # Nodes
    node_total = (
        node_health["healthy"]
        + node_health["warning"]
    )

    node_style = "green"
    if node_health["warning"] > 0:
        node_style = "yellow"

    node_table = make_table(
        [
            ("Total", node_total),
            ("[green]● Ready[/green]", node_health["healthy"]),
            ("[yellow]● NotReady[/yellow]", node_health["warning"]),
        ],
        health_bar(
            node_health["healthy"],
            node_health["warning"],
            0
        )
    )

    console.print(
        Align.center(
            Panel.fit(
                node_table,
                title="[bold]🖥️  Nodes[/bold]",
                border_style=node_style
            )
        )
    )

    # Deployments
    dep_total = (
        deployment_health["healthy"]
        + deployment_health["unavailable"]
    )

    dep_style = "green"
    if deployment_health["unavailable"] > 0:
        dep_style = "red"

    dep_table = make_table(
        [
            ("Total", dep_total),
            ("[green]● Available[/green]", deployment_health["healthy"]),
            ("[red]● Unavailable[/red]", deployment_health["unavailable"]),
        ],
        health_bar(
            deployment_health["healthy"],
            0,
            deployment_health["unavailable"]
        )
    )

    console.print(
        Align.center(
            Panel.fit(
                dep_table,
                title="[bold]🚀 Deployments[/bold]",
                border_style=dep_style
            )
        )
    )

    # Trend context from analytics
    from core.analytics.enrichment import enrich_overview
    trends = enrich_overview()
    if trends:
        trend_parts = []
        rt = trends.get("restart_trend", "stable")
        ct = trends.get("cpu_trend", "stable")
        if rt == "worsening":
            trend_parts.append("[red]↑ Restarts worsening[/red]")
        elif rt == "improving":
            trend_parts.append("[green]↓ Restarts improving[/green]")
        if ct == "growing":
            trend_parts.append("[yellow]↑ CPU growing[/yellow]")
        elif ct == "shrinking":
            trend_parts.append("[green]↓ CPU shrinking[/green]")

        if trend_parts:
            console.print(
                Align.center(
                    Panel.fit(
                        "  │  ".join(trend_parts),
                        title="[dim]24h Trend[/dim]",
                        border_style=t()["border"]
                    )
                )
            )
