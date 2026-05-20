"""
Trace Renderer — resource relationship map with health
indicators, connection types, and dependency visualization.
"""

from rich.console import Console
from rich.panel import Panel
from rich.tree import Tree

console = Console()

from core.theme import t


def render_trace(data):
    if not data["deployment"] and not data["service"]:
        console.print(
            f"[red]No resources found for "
            f"'{data['name']}'[/red]"
        )
        return

    tree = Tree(
        f"[bold cyan]🔗 {data['name']}[/bold cyan]"
    )

    # Ingress → Service → Deployment → Pods
    # Show the full request path

    # Ingress
    if data["ingress"]:
        ing = data["ingress"]
        ing_node = tree.add(
            f"[magenta]🌐 Ingress[/magenta] "
            f"[bold]{ing['name']}[/bold]"
        )
        ing_node.add(
            f"[dim]host:[/dim] {ing['host']}  "
            f"[dim]path:[/dim] {ing['path']}"
        )

    # Service
    if data["service"]:
        svc = data["service"]
        svc_node = tree.add(
            f"[blue]🔌 Service[/blue] "
            f"[bold]{svc['name']}[/bold] "
            f"[dim]({svc['type']})[/dim]"
        )
        svc_node.add(
            f"[dim]cluster-ip:[/dim] {svc['cluster_ip']}  "
            f"[dim]ports:[/dim] {', '.join(svc['ports'])}"
        )

    # Deployment
    if data["deployment"]:
        dep = data["deployment"]
        dep_node = tree.add(
            f"[green]🚀 Deployment[/green] "
            f"[bold]{dep['name']}[/bold] "
            f"[dim]({dep['replicas']} replicas)[/dim]"
        )
        dep_node.add(
            f"[dim]image:[/dim] {dep['image']}"
        )

        # ReplicaSets
        for rs in data.get("replicasets", []):
            ready = rs.get("ready", 0)
            desired = rs.get("replicas", 0)
            health = (
                "[green]✓[/green]" if ready >= desired
                else f"[yellow]⚠ {ready}/{desired}[/yellow]"
            )
            dep_node.add(
                f"[yellow]📋 RS[/yellow] {rs['name']} "
                f"{health}"
            )

        # Pods
        if data.get("pods"):
            pods_node = dep_node.add(
                f"[cyan]📦 Pods[/cyan] "
                f"[dim]({len(data['pods'])})[/dim]"
            )
            for pod in data["pods"]:
                status = pod.get("status", "Unknown")
                if status == "Running":
                    icon = "[green]●[/green]"
                elif status == "Pending":
                    icon = "[yellow]●[/yellow]"
                else:
                    icon = "[red]●[/red]"

                ip = pod.get("ip", "")
                pods_node.add(
                    f"{icon} {pod['name']}  "
                    f"[dim]{ip}[/dim]"
                )

    # ConfigMaps
    if data.get("configmaps"):
        cm_node = tree.add(
            f"[dim]⚙ ConfigMaps[/dim] "
            f"[dim]({len(data['configmaps'])})[/dim]"
        )
        for cm in data["configmaps"]:
            cm_node.add(f"[dim]{cm}[/dim]")

    # Secrets
    if data.get("secrets"):
        sec_node = tree.add(
            f"[dim]🔑 Secrets[/dim] "
            f"[dim]({len(data['secrets'])})[/dim]"
        )
        for s in data["secrets"]:
            sec_node.add(f"[dim]{s}[/dim]")

    # HPA
    if data.get("hpa"):
        hpa = data["hpa"]
        tree.add(
            f"[cyan]📈 HPA[/cyan] "
            f"{hpa.get('name', '')} "
            f"[dim]({hpa.get('min', '?')}-{hpa.get('max', '?')} replicas)[/dim]"
        )

    console.print(
        Panel(
            tree,
            title="[bold]🗺️  Resource Map[/bold]",
            border_style=t()["primary"],
        )
    )

    # Summary line
    parts = []
    if data.get("ingress"):
        parts.append("ingress")
    if data.get("service"):
        parts.append("service")
    if data.get("deployment"):
        parts.append("deployment")
    if data.get("pods"):
        parts.append(f"{len(data['pods'])} pods")

    if parts:
        console.print(
            f"[dim]  Path: {' → '.join(parts)}[/dim]"
        )
