"""
Mesh Renderer — detailed service mesh visualization including
traffic routing, mTLS status, circuit breakers, and injection coverage.
"""

from rich.console import Console
from rich.panel import Panel
from rich.table import Table
from rich.tree import Tree

console = Console()

from core.theme import t


def render_mesh_detail(data):
    """Render full mesh status overview."""
    if not data.get("mesh"):
        console.print(
            Panel(
                "[dim]No service mesh detected.\n"
                "  (Istio or Linkerd namespace not found)[/dim]",
                title="[bold]🕸️  Service Mesh[/bold]",
                border_style=t()["border"],
            )
        )
        return

    mesh = data["mesh"]
    inj = data["injection"]
    mtls = data["mtls"]

    # Coverage bar
    pct = inj["coverage_pct"]
    bar_width = 20
    filled = int((pct / 100) * bar_width)
    color = "green" if pct > 90 else "yellow" if pct > 50 else "red"
    bar = (
        f"[{color}]" + "█" * filled + f"[/{color}]"
        + "[dim]" + "░" * (bar_width - filled) + "[/dim]"
    )

    # mTLS status
    mtls_mode = mtls.get("effective_mode", "PERMISSIVE")
    if mtls_mode == "STRICT":
        mtls_display = "[green]🔒 STRICT[/green]"
    elif mtls_mode == "PERMISSIVE":
        mtls_display = "[yellow]🔓 PERMISSIVE[/yellow]"
    else:
        mtls_display = f"[dim]{mtls_mode}[/dim]"

    lines = [
        f"[bold cyan]Mesh:[/bold cyan]       "
        f"{mesh.capitalize()}",
        f"[bold cyan]mTLS:[/bold cyan]       "
        f"{mtls_display}",
        f"[bold cyan]Injection:[/bold cyan]  "
        f"{bar}  [{color}]{pct}%[/{color}]  "
        f"[dim]({inj['injected']}/{inj['total']} pods)[/dim]",
    ]

    vs_count = len(data.get("virtual_services", []))
    dr_count = len(data.get("destination_rules", []))
    if vs_count or dr_count:
        lines.append(
            f"[bold cyan]Routing:[/bold cyan]    "
            f"{vs_count} VirtualServices, "
            f"{dr_count} DestinationRules"
        )

    # Pods without sidecar
    not_injected = inj.get("not_injected", [])
    if not_injected:
        lines.append(
            f"\n[yellow]⚠ Pods without sidecar "
            f"({len(not_injected)}):[/yellow]"
        )
        for pod in not_injected[:5]:
            lines.append(f"  [dim]• {pod}[/dim]")
        if len(not_injected) > 5:
            lines.append(
                f"  [dim]... +{len(not_injected) - 5} more[/dim]"
            )

    border = "green" if pct > 90 and mtls.get("strict") else "yellow"
    console.print(
        Panel(
            "\n".join(lines),
            title="[bold]🕸️  Service Mesh[/bold]",
            border_style=border,
        )
    )


def render_virtual_services(vs_list):
    """Render VirtualService routing rules."""
    if not vs_list:
        console.print(
            "[dim]No VirtualServices found in namespace[/dim]"
        )
        return

    for vs in vs_list:
        tree = Tree(
            f"[bold cyan]🔀 {vs['name']}[/bold cyan]  "
            f"[dim]hosts: {', '.join(vs['hosts'])}[/dim]"
        )

        if vs.get("gateways"):
            tree.add(
                f"[dim]gateways: "
                f"{', '.join(vs['gateways'])}[/dim]"
            )

        for i, route in enumerate(vs["routes"]):
            # Match conditions
            match_str = ""
            if route.get("match"):
                match_str = (
                    f" [dim]match: "
                    f"{', '.join(route['match'])}[/dim]"
                )

            route_node = tree.add(
                f"[bold]Route {i + 1}[/bold]{match_str}"
            )

            # Destinations with weights (canary)
            for dest in route["destinations"]:
                weight = dest.get("weight", 100)
                host = dest["host"]
                subset = dest.get("subset", "")
                port = dest.get("port", "")

                weight_bar = ""
                if len(route["destinations"]) > 1:
                    w_filled = int(weight / 10)
                    weight_bar = (
                        f" [cyan]{'█' * w_filled}"
                        f"{'░' * (10 - w_filled)}[/cyan] "
                        f"{weight}%"
                    )

                dest_str = f"[green]→[/green] {host}"
                if subset:
                    dest_str += f" [dim]({subset})[/dim]"
                if port:
                    dest_str += f" [dim]:{port}[/dim]"
                dest_str += weight_bar

                route_node.add(dest_str)

            # Timeout/retries
            if route.get("timeout"):
                route_node.add(
                    f"[dim]timeout: {route['timeout']}[/dim]"
                )
            if route.get("retries"):
                retries = route["retries"]
                route_node.add(
                    f"[dim]retries: "
                    f"{retries.get('attempts', '')} attempts, "
                    f"timeout {retries.get('perTryTimeout', '')}[/dim]"
                )
            if route.get("fault"):
                fault = route["fault"]
                if fault.get("delay"):
                    route_node.add(
                        f"[yellow]⚡ fault delay: "
                        f"{fault['delay'].get('fixedDelay', '')} "
                        f"({fault['delay'].get('percentage', {}).get('value', '')}%)"
                        f"[/yellow]"
                    )

        console.print(
            Panel(
                tree,
                title="[bold]🔀 VirtualService[/bold]",
                border_style=t()["primary"],
            )
        )


def render_destination_rules(dr_list):
    """Render DestinationRules — circuit breakers, subsets."""
    if not dr_list:
        console.print(
            "[dim]No DestinationRules found in namespace[/dim]"
        )
        return

    table = Table(
        show_header=True,
        header_style=t()["header"],
        border_style=t()["border"],
        expand=True,
    )
    table.add_column("Name", ratio=2)
    table.add_column("Host", ratio=2)
    table.add_column("TLS", width=12)
    table.add_column("LB", width=12)
    table.add_column("Circuit Breaker", ratio=2)
    table.add_column("Subsets", width=15)

    for dr in dr_list:
        # TLS
        tls = dr.get("tls_mode", "")
        if tls == "ISTIO_MUTUAL":
            tls_d = "[green]🔒 mTLS[/green]"
        elif tls:
            tls_d = f"[dim]{tls}[/dim]"
        else:
            tls_d = "[dim]—[/dim]"

        # Circuit breaker summary
        cb = dr.get("circuit_breaker", {})
        outlier = dr.get("outlier_detection", {})
        cb_parts = []
        if outlier.get("consecutive_errors"):
            cb_parts.append(
                f"{outlier['consecutive_errors']} errors"
            )
        if outlier.get("base_ejection_time"):
            cb_parts.append(
                f"eject {outlier['base_ejection_time']}"
            )
        cb_str = ", ".join(cb_parts) if cb_parts else "—"

        # Subsets
        subsets = dr.get("subsets", [])
        subset_str = (
            ", ".join(s["name"] for s in subsets)
            if subsets else "—"
        )

        table.add_row(
            dr["name"],
            dr["host"],
            tls_d,
            dr.get("load_balancer", "") or "—",
            cb_str,
            subset_str,
        )

    console.print(
        Panel(
            table,
            title="[bold]⚡ Destination Rules[/bold]",
            border_style=t()["primary"],
        )
    )


def render_mtls_status(mtls):
    """Render mTLS enforcement status."""
    if not mtls:
        console.print("[dim]No mTLS info available[/dim]")
        return

    effective = mtls.get("effective_mode", "PERMISSIVE")
    strict = mtls.get("strict", False)

    if strict:
        icon = "[green]🔒[/green]"
        border = "green"
        status = "[green]STRICT — All traffic encrypted[/green]"
    elif effective == "PERMISSIVE":
        icon = "[yellow]🔓[/yellow]"
        border = "yellow"
        status = (
            "[yellow]PERMISSIVE — Accepts both "
            "plaintext and mTLS[/yellow]"
        )
    else:
        icon = "[red]🔓[/red]"
        border = "red"
        status = f"[red]{effective}[/red]"

    lines = [
        f"{icon} [bold]Effective Mode:[/bold] {status}\n",
    ]

    policies = mtls.get("all_policies", [])
    if policies:
        lines.append("[bold]PeerAuthentication Policies:[/bold]")
        for p in policies:
            scope = (
                "[cyan]mesh-wide[/cyan]"
                if p["scope"] == "mesh-wide"
                else f"[dim]{p['namespace']}[/dim]"
            )
            mode = p["mode"]
            if mode == "STRICT":
                mode_d = f"[green]{mode}[/green]"
            elif mode == "PERMISSIVE":
                mode_d = f"[yellow]{mode}[/yellow]"
            else:
                mode_d = f"[dim]{mode}[/dim]"
            lines.append(
                f"  • {p['name']} ({scope}) → {mode_d}"
            )
    else:
        lines.append(
            "[dim]No PeerAuthentication policies found. "
            "Default: PERMISSIVE[/dim]"
        )

    if not strict:
        lines.append(
            "\n[dim]💡 To enforce mTLS cluster-wide:[/dim]\n"
            "[dim]  kubectl apply -f - <<EOF\n"
            "  apiVersion: security.istio.io/v1beta1\n"
            "  kind: PeerAuthentication\n"
            "  metadata:\n"
            "    name: default\n"
            "    namespace: istio-system\n"
            "  spec:\n"
            "    mtls:\n"
            "      mode: STRICT\n"
            "  EOF[/dim]"
        )

    console.print(
        Panel(
            "\n".join(lines),
            title="[bold]🔐 mTLS Status[/bold]",
            border_style=border,
        )
    )
