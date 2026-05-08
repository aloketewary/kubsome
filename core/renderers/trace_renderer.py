from rich.console import Console
from rich.panel import Panel
from rich.tree import Tree

console = Console()


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

    # Ingress
    if data["ingress"]:
        ing = data["ingress"]
        ing_node = tree.add(
            f"[magenta]🌐 Ingress:[/magenta] "
            f"{ing['name']}"
        )
        ing_node.add(
            f"[dim]Host:[/dim] {ing['host']}"
        )
        ing_node.add(
            f"[dim]Path:[/dim] {ing['path']}"
        )

    # Service
    if data["service"]:
        svc = data["service"]
        svc_node = tree.add(
            f"[blue]🔌 Service:[/blue] "
            f"{svc['name']} ({svc['type']})"
        )
        svc_node.add(
            f"[dim]ClusterIP:[/dim] {svc['cluster_ip']}"
        )
        svc_node.add(
            f"[dim]Ports:[/dim] "
            f"{', '.join(svc['ports'])}"
        )

    # Deployment
    if data["deployment"]:
        dep = data["deployment"]
        dep_node = tree.add(
            f"[green]🚀 Deployment:[/green] "
            f"{dep['name']} "
            f"(replicas: {dep['replicas']})"
        )
        dep_node.add(
            f"[dim]Image:[/dim] {dep['image']}"
        )

        # ReplicaSets
        for rs in data["replicasets"]:
            rs_node = dep_node.add(
                f"[yellow]📋 ReplicaSet:[/yellow] "
                f"{rs['name']} "
                f"({rs['ready']}/{rs['replicas']})"
            )

        # Pods
        if data["pods"]:
            pods_node = dep_node.add(
                f"[cyan]📦 Pods ({len(data['pods'])})[/cyan]"
            )
            for pod in data["pods"]:
                status_style = (
                    "green" if pod["status"] == "Running"
                    else "red"
                )
                pods_node.add(
                    f"[{status_style}]● {pod['name']}[/{status_style}]"
                    f"  [dim]{pod['ip']}[/dim]"
                )

    # ConfigMaps & Secrets
    if data["configmaps"]:
        cm_node = tree.add(
            f"[dim]📄 ConfigMaps[/dim]"
        )
        for cm in data["configmaps"]:
            cm_node.add(f"[dim]{cm}[/dim]")

    if data["secrets"]:
        sec_node = tree.add(
            f"[dim]🔒 Secrets[/dim]"
        )
        for s in data["secrets"]:
            sec_node.add(f"[dim]{s}[/dim]")

    console.print(
        Panel(
            tree,
            title="[bold]🗺️  Resource Map[/bold]",
            border_style="cyan"
        )
    )
