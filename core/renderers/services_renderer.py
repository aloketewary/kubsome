from rich.console import Console
from rich.panel import Panel
from rich.table import Table
from rich.tree import Tree

console = Console()


def render_mesh(data):
    if not data["mesh"]:
        console.print(
            Panel(
                "[dim]No service mesh detected "
                "(no Istio/Linkerd sidecars found)[/dim]",
                title="[bold]🕸️  Service Mesh[/bold]",
                border_style="dim"
            )
        )
        return

    coverage_color = (
        "green" if data["coverage_pct"] > 90
        else "yellow" if data["coverage_pct"] > 50
        else "red"
    )

    content = (
        f"[bold cyan]Mesh:[/bold cyan]      "
        f"{data['mesh'].capitalize()}\n"
        f"[bold cyan]Coverage:[/bold cyan]   "
        f"[{coverage_color}]{data['coverage_pct']}%[/{coverage_color}] "
        f"({data['injected']}/{data['total_pods']} pods)\n"
    )

    # Show non-injected pods
    if data["injected"] < data["total_pods"]:
        content += (
            f"\n[yellow]⚠ {data['total_pods'] - data['injected']} "
            f"pods without sidecar[/yellow]"
        )

    console.print(
        Panel(
            content,
            title="[bold]🕸️  Service Mesh[/bold]",
            border_style="cyan"
        )
    )


def render_ingresses(ingresses):
    if not ingresses:
        console.print("[dim]No ingress resources found[/dim]")
        return

    table = Table(
        show_header=True,
        header_style="bold cyan",
        border_style="dim",
        expand=True
    )

    table.add_column("Host", ratio=3)
    table.add_column("Path", ratio=2)
    table.add_column("Service", ratio=2)
    table.add_column("Port", width=6, justify="right")

    for ing in ingresses:
        table.add_row(
            ing["host"],
            ing["path"],
            ing["service"],
            str(ing["port"])
        )

    console.print(
        Panel(
            table,
            title="[bold]🌐 Ingress Routes[/bold]",
            border_style="cyan"
        )
    )


def render_dependencies(deps):
    if not deps:
        console.print("[red]Deployment not found[/red]")
        return

    tree = Tree(
        f"[bold cyan]🔗 {deps['name']}[/bold cyan]"
    )

    # Upstream (depends on)
    if deps["upstream"]:
        up_node = tree.add(
            "[bold]⬆ Depends On[/bold]"
        )
        for u in deps["upstream"]:
            up_node.add(
                f"[green]{u['service']}[/green] "
                f"[dim]({u['via']})[/dim]"
            )

    # Downstream (depended by)
    if deps["downstream"]:
        down_node = tree.add(
            "[bold]⬇ Exposed Via[/bold]"
        )
        for d in deps["downstream"]:
            ports = ", ".join(d["ports"])
            down_node.add(
                f"[blue]{d['service']}[/blue] "
                f"[dim]({ports})[/dim]"
            )

    # Env references
    if deps["env_refs"]:
        env_node = tree.add(
            "[bold]🔧 External Refs[/bold]"
        )
        for ref in deps["env_refs"][:5]:
            env_node.add(
                f"[dim]{ref['var']}[/dim] = "
                f"{ref['value']}"
            )

    if not deps["upstream"] and not deps["downstream"]:
        tree.add("[dim]No dependencies detected[/dim]")

    console.print(
        Panel(
            tree,
            title="[bold]🗺️  Dependencies[/bold]",
            border_style="cyan"
        )
    )


def render_dns(data):
    if not data:
        console.print("[red]Service not found[/red]")
        return

    status = (
        "[green]✓ Resolvable[/green]"
        if data["resolvable"]
        else "[red]✗ Not found[/red]"
    )

    lines = [
        f"[bold cyan]Service:[/bold cyan]    {data['service']}",
        f"[bold cyan]Namespace:[/bold cyan]  {data['namespace']}",
        f"[bold cyan]ClusterIP:[/bold cyan]  {data['cluster_ip'] or 'None'}",
        f"[bold cyan]Status:[/bold cyan]     {status}",
        f"",
        f"[bold]DNS Names:[/bold]",
    ]

    for name in data["dns_names"]:
        lines.append(f"  [dim]•[/dim] {name}")

    console.print(
        Panel(
            "\n".join(lines),
            title="[bold]🔍 DNS[/bold]",
            border_style="cyan"
        )
    )
