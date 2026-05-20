"""
Services Renderer — mesh status, ingress routes,
dependency maps, and DNS resolution display.
"""

from rich.console import Console
from rich.panel import Panel
from rich.table import Table
from rich.tree import Tree

console = Console()

from core.theme import t


def render_mesh(data):
    if not data["mesh"]:
        console.print(
            Panel(
                "[dim]  No service mesh detected\n"
                "  (no Istio/Linkerd sidecars found)[/dim]",
                title="[bold]🕸️  Service Mesh[/bold]",
                border_style=t()["border"],
            )
        )
        return

    pct = data["coverage_pct"]
    if pct > 90:
        color = "green"
    elif pct > 50:
        color = "yellow"
    else:
        color = "red"

    # Coverage bar
    bar_width = 20
    filled = int((pct / 100) * bar_width)
    bar = (
        f"[{color}]" + "█" * filled + f"[/{color}]"
        + "[dim]" + "░" * (bar_width - filled) + "[/dim]"
    )

    injected = data["injected"]
    total = data["total_pods"]
    missing = total - injected

    content = (
        f"[bold cyan]Mesh:[/bold cyan]      "
        f"{data['mesh'].capitalize()}\n"
        f"[bold cyan]Coverage:[/bold cyan]   "
        f"{bar}  [{color}]{pct}%[/{color}]  "
        f"[dim]({injected}/{total} pods)[/dim]"
    )

    if missing > 0:
        content += (
            f"\n\n[yellow]  ⚠ {missing} pods without sidecar[/yellow]"
        )

    console.print(
        Panel(
            content,
            title="[bold]🕸️  Service Mesh[/bold]",
            border_style=t()["primary"],
        )
    )


def render_ingresses(ingresses):
    if not ingresses:
        console.print("[dim]No ingress resources found[/dim]")
        return

    console.print(
        Panel.fit(
            f"[bold]{len(ingresses)}[/bold] ingress routes",
            border_style=t()["primary"],
        )
    )

    table = Table(
        show_header=True,
        header_style=t()["header"],
        border_style=t()["border"],
        expand=True,
        show_lines=False,
    )

    table.add_column("", width=2)
    table.add_column("Host", ratio=3)
    table.add_column("Path", ratio=2)
    table.add_column("Service", ratio=2)
    table.add_column("Port", width=6, justify="right")

    for ing in ingresses:
        icon = "[green]●[/green]"
        table.add_row(
            icon,
            ing["host"],
            ing["path"],
            f"[cyan]{ing['service']}[/cyan]",
            str(ing["port"]),
        )

    console.print(table)
    console.print(
        f"[dim]{'─' * 3} {len(ingresses)} routes {'─' * 3}[/dim]"
    )


def render_dependencies(deps):
    if not deps:
        console.print("[red]Deployment not found[/red]")
        return

    tree = Tree(
        f"[bold cyan]🔗 {deps['name']}[/bold cyan]"
    )

    # Upstream (depends on)
    if deps.get("upstream"):
        up_node = tree.add(
            "[bold]⬆ Depends On[/bold]"
        )
        for u in deps["upstream"]:
            up_node.add(
                f"[green]●[/green] {u['service']}  "
                f"[dim]via {u['via']}[/dim]"
            )

    # Downstream (depended by)
    if deps.get("downstream"):
        down_node = tree.add(
            "[bold]⬇ Exposed Via[/bold]"
        )
        for d in deps["downstream"]:
            ports = ", ".join(d["ports"])
            down_node.add(
                f"[blue]●[/blue] {d['service']}  "
                f"[dim]({ports})[/dim]"
            )

    # Env references
    if deps.get("env_refs"):
        env_node = tree.add(
            "[bold]🔧 External Refs[/bold]"
        )
        for ref in deps["env_refs"][:5]:
            env_node.add(
                f"[dim]{ref['var']}[/dim] = {ref['value']}"
            )
        if len(deps["env_refs"]) > 5:
            env_node.add(
                f"[dim]... +{len(deps['env_refs']) - 5} more[/dim]"
            )

    if not deps.get("upstream") and not deps.get("downstream"):
        tree.add("[dim]No dependencies detected[/dim]")

    console.print(
        Panel(
            tree,
            title="[bold]🗺️  Dependencies[/bold]",
            border_style=t()["primary"],
        )
    )


def render_dns(data):
    if not data:
        console.print("[red]Service not found[/red]")
        return

    resolvable = data.get("resolvable", False)
    status = (
        "[green]✓ Resolvable[/green]"
        if resolvable
        else "[red]✗ Not resolvable[/red]"
    )

    border = "green" if resolvable else "red"

    lines = [
        f"[bold cyan]Service:[/bold cyan]    {data['service']}",
        f"[bold cyan]Namespace:[/bold cyan]  {data['namespace']}",
        f"[bold cyan]ClusterIP:[/bold cyan]  {data.get('cluster_ip') or '[dim]None[/dim]'}",
        f"[bold cyan]Status:[/bold cyan]     {status}",
        "",
        "[bold]DNS Names:[/bold]",
    ]

    for name in data.get("dns_names", []):
        lines.append(f"  [dim]•[/dim] [cyan]{name}[/cyan]")

    if not resolvable:
        lines.append("")
        lines.append(
            "[yellow]  ⚠ Check that the service exists "
            "and has endpoints[/yellow]"
        )

    console.print(
        Panel(
            "\n".join(lines),
            title="[bold]🔍 DNS Resolution[/bold]",
            border_style=border,
        )
    )
