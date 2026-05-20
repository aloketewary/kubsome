"""
GitOps Renderer — ArgoCD/Flux sync status, health,
drift detection, and app detail display.
"""

from rich.console import Console
from rich.panel import Panel
from rich.table import Table

console = Console()

from core.theme import t


def render_gitops(data):
    """Render GitOps overview (all apps)."""
    if not data.get("provider"):
        console.print(
            Panel(
                "[dim]No GitOps tool detected.\n"
                "  (ArgoCD or Flux not found in cluster)[/dim]\n\n"
                "[dim]Install ArgoCD:[/dim]\n"
                "  kubectl create namespace argocd\n"
                "  kubectl apply -n argocd -f "
                "https://raw.githubusercontent.com/"
                "argoproj/argo-cd/stable/manifests/install.yaml\n\n"
                "[dim]Install Flux:[/dim]\n"
                "  flux install",
                title="[bold]🔄 GitOps Status[/bold]",
                border_style=t()["border"],
            )
        )
        return

    provider = data["provider"]
    total = data["total"]
    synced = data["synced"]
    out_of_sync = data["out_of_sync"]
    degraded = data["degraded"]

    # Summary
    if out_of_sync == 0 and degraded == 0:
        border = "green"
    elif degraded > 0:
        border = "red"
    else:
        border = "yellow"

    header = (
        f"[bold cyan]Provider:[/bold cyan]  "
        f"{provider.capitalize()} "
        f"[dim]{data.get('version', '')}[/dim]\n"
        f"[bold cyan]Namespace:[/bold cyan] "
        f"{data.get('namespace', '')}\n"
        f"[bold cyan]Apps:[/bold cyan]      "
        f"{total} total  "
        f"[green]{synced} synced[/green]  "
    )
    if out_of_sync > 0:
        header += f"[yellow]{out_of_sync} drifted[/yellow]  "
    if degraded > 0:
        header += f"[red]{degraded} degraded[/red]"

    # App table
    table = Table(
        show_header=True,
        header_style=t()["header"],
        border_style=t()["border"],
        expand=True,
        show_lines=False,
    )
    table.add_column("", width=2)
    table.add_column("App", ratio=2)
    table.add_column("Sync", width=12)
    table.add_column("Health", width=12)
    table.add_column("Revision", width=10)
    table.add_column("Last Synced", width=18, style="dim")

    for app in data["apps"]:
        # Sync icon
        sync = app["sync_status"]
        if sync in ("Synced", "Ready"):
            icon = "[green]✓[/green]"
            sync_display = f"[green]{sync}[/green]"
        elif sync == "OutOfSync":
            icon = "[yellow]⚠[/yellow]"
            sync_display = f"[yellow]{sync}[/yellow]"
        else:
            icon = "[red]●[/red]"
            sync_display = f"[red]{sync}[/red]"

        # Health
        health = app["health"]
        if health in ("Healthy", "True"):
            health_display = f"[green]{health}[/green]"
        elif health in ("Degraded", "False"):
            health_display = f"[red]{health}[/red]"
        elif health == "Progressing":
            health_display = f"[cyan]{health}[/cyan]"
        else:
            health_display = f"[dim]{health}[/dim]"

        last = app.get("last_synced", "")[:16]

        table.add_row(
            icon,
            app["name"],
            sync_display,
            health_display,
            app.get("revision", "")[:8] or "—",
            last or "—",
        )

    console.print(
        Panel(
            header,
            title="[bold]🔄 GitOps Status[/bold]",
            border_style=border,
        )
    )
    console.print(table)


def render_gitops_detail(data):
    """Render detailed view of a single GitOps app."""
    if not data:
        console.print("[red]App not found[/red]")
        return

    sync = data["sync_status"]
    health = data["health"]

    if sync in ("Synced", "Ready") and health in ("Healthy", "True"):
        border = "green"
    elif health in ("Degraded", "False"):
        border = "red"
    else:
        border = "yellow"

    # Sync status styling
    if sync in ("Synced", "Ready"):
        sync_display = f"[green]✓ {sync}[/green]"
    elif sync == "OutOfSync":
        sync_display = f"[yellow]⚠ {sync}[/yellow]"
    else:
        sync_display = f"[red]✗ {sync}[/red]"

    # Health styling
    if health in ("Healthy", "True"):
        health_display = f"[green]{health}[/green]"
    elif health in ("Degraded", "False"):
        health_display = f"[red]{health}[/red]"
    else:
        health_display = f"[yellow]{health}[/yellow]"

    lines = [
        f"[bold cyan]App:[/bold cyan]       "
        f"{data['name']}",
        f"[bold cyan]Provider:[/bold cyan]  "
        f"{data['provider'].capitalize()}",
        f"[bold cyan]Sync:[/bold cyan]      "
        f"{sync_display}",
        f"[bold cyan]Health:[/bold cyan]    "
        f"{health_display}",
        f"[bold cyan]Revision:[/bold cyan]  "
        f"{data.get('revision', '')[:12] or '—'}",
        f"[bold cyan]Repo:[/bold cyan]      "
        f"[dim]{data.get('repo', '')}[/dim]",
        f"[bold cyan]Path:[/bold cyan]      "
        f"[dim]{data.get('path', '') or '/'}[/dim]",
        f"[bold cyan]Target:[/bold cyan]    "
        f"{data.get('target_revision', 'HEAD')}",
        f"[bold cyan]Last Sync:[/bold cyan] "
        f"{data.get('last_synced', '')[:19] or '—'}",
    ]

    if data.get("sync_result"):
        lines.append(
            f"\n[bold]Result:[/bold] "
            f"[dim]{data['sync_result'][:100]}[/dim]"
        )

    console.print(
        Panel(
            "\n".join(lines),
            title=f"[bold]🔄 {data['name']}[/bold]",
            border_style=border,
        )
    )

    # Resources table
    resources = data.get("resources", [])
    if resources:
        table = Table(
            show_header=True,
            header_style=t()["header"],
            border_style=t()["border"],
            expand=True,
        )
        table.add_column("", width=2)
        table.add_column("Kind", width=16)
        table.add_column("Name", ratio=2)
        table.add_column("Status", width=12)
        table.add_column("Health", width=12)

        for res in resources:
            status = res.get("status", "")
            health = res.get("health", "")

            if status == "Synced":
                icon = "[green]✓[/green]"
                status_d = f"[green]{status}[/green]"
            elif status == "OutOfSync":
                icon = "[yellow]⚠[/yellow]"
                status_d = f"[yellow]{status}[/yellow]"
            else:
                icon = "[dim]●[/dim]"
                status_d = f"[dim]{status}[/dim]"

            if health == "Healthy":
                health_d = f"[green]{health}[/green]"
            elif health == "Degraded":
                health_d = f"[red]{health}[/red]"
            else:
                health_d = f"[dim]{health or '—'}[/dim]"

            table.add_row(
                icon,
                res.get("kind", ""),
                res.get("name", ""),
                status_d,
                health_d,
            )

        console.print(table)

    # Conditions
    conditions = data.get("conditions", [])
    if conditions:
        console.print("\n[bold]Conditions:[/bold]")
        for c in conditions[:5]:
            ctype = c.get("type", "")
            msg = c.get("message", "")[:80]
            status = c.get("status", "")
            icon = (
                "[green]✓[/green]" if status == "True"
                else "[red]✗[/red]"
            )
            console.print(
                f"  {icon} {ctype}: [dim]{msg}[/dim]"
            )
