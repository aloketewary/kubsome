"""
Cost Renderer — resource optimization, security scan,
and unused resource displays with actionable output.
"""

from rich.console import Console
from rich.panel import Panel
from rich.table import Table

console = Console()

from core.theme import t

SEVERITY_STYLES = {
    "critical": ("red", "●"),
    "high": ("red", "●"),
    "medium": ("yellow", "●"),
    "low": ("dim", "○"),
    "warning": ("yellow", "●"),
    "info": ("cyan", "○"),
}


def render_cost_recommendations(recommendations):
    if not recommendations:
        console.print(
            Panel(
                "[green]  ✓ Resources are well-sized — "
                "no optimization needed[/green]",
                title="[bold]💰 Resource Optimization[/bold]",
                border_style=t()["success"],
            )
        )
        return

    over = sum(1 for r in recommendations if "over" in r.get("type", ""))
    under = sum(1 for r in recommendations if "under" in r.get("type", ""))

    # Summary
    parts = [
        f"[bold]{len(recommendations)}[/bold] recommendations",
    ]
    if over:
        parts.append(f"[cyan]↓ {over} over-provisioned[/cyan]")
    if under:
        parts.append(f"[yellow]↑ {under} under-provisioned[/yellow]")

    console.print(
        Panel.fit("  │  ".join(parts), border_style=t()["primary"])
    )

    table = Table(
        show_header=True,
        header_style=t()["header"],
        border_style=t()["border"],
        expand=True,
        show_lines=False,
    )

    table.add_column("", width=2)
    table.add_column("Pod", no_wrap=True, ratio=2)
    table.add_column("Issue", ratio=2)
    table.add_column("Detail", ratio=3)
    table.add_column("Suggestion", style="dim italic", ratio=3)

    # Sort by severity
    severity_order = {"critical": 0, "high": 1, "medium": 2, "low": 3}
    sorted_recs = sorted(
        recommendations,
        key=lambda r: severity_order.get(r.get("severity", "low"), 4)
    )

    for r in sorted_recs:
        sev = r.get("severity", "low")
        color, icon = SEVERITY_STYLES.get(sev, ("dim", "○"))

        table.add_row(
            f"[{color}]{icon}[/{color}]",
            r.get("pod", ""),
            f"[{color}]{r.get('title', '')}[/{color}]",
            r.get("detail", ""),
            r.get("suggestion", ""),
        )

    console.print(table)
    console.print(
        f"[dim]{'─' * 3} {len(recommendations)} "
        f"recommendations {'─' * 3}[/dim]"
    )


def render_security_scan(findings):
    if not findings:
        console.print(
            Panel(
                "[green]  ✓ No security issues found — "
                "cluster passes all checks[/green]",
                title="[bold]🔒 Security Scan[/bold]",
                border_style=t()["success"],
            )
        )
        return

    critical = sum(1 for f in findings if f["severity"] == "critical")
    high = sum(1 for f in findings if f["severity"] == "high")
    medium = sum(1 for f in findings if f["severity"] == "medium")
    low = len(findings) - critical - high - medium

    border = (
        "red" if critical or high
        else "yellow" if medium
        else "dim"
    )

    # Summary
    parts = [f"[bold]{len(findings)}[/bold] findings"]
    if critical:
        parts.append(f"[red]● {critical} critical[/red]")
    if high:
        parts.append(f"[red]● {high} high[/red]")
    if medium:
        parts.append(f"[yellow]● {medium} medium[/yellow]")
    if low:
        parts.append(f"[dim]○ {low} low[/dim]")

    console.print(
        Panel.fit("  │  ".join(parts), border_style=border)
    )

    table = Table(
        show_header=True,
        header_style=t()["header"],
        border_style=t()["border"],
        expand=True,
        show_lines=False,
    )

    table.add_column("", width=2)
    table.add_column("Severity", width=9)
    table.add_column("Pod", no_wrap=True, ratio=2)
    table.add_column("Issue", ratio=2)
    table.add_column("Fix", style="dim italic", ratio=3)

    # Sort by severity
    severity_order = {"critical": 0, "high": 1, "medium": 2, "low": 3}
    sorted_findings = sorted(
        findings,
        key=lambda f: severity_order.get(f.get("severity", "low"), 4)
    )

    for f in sorted_findings:
        sev = f.get("severity", "low")
        color, icon = SEVERITY_STYLES.get(sev, ("dim", "○"))

        table.add_row(
            f"[{color}]{icon}[/{color}]",
            f"[{color}]{sev.upper()}[/{color}]",
            f.get("pod", ""),
            f.get("issue", ""),
            f.get("fix", ""),
        )

    console.print(table)
    console.print(
        f"[dim]{'─' * 3} {len(findings)} findings {'─' * 3}[/dim]"
    )

    # Suggested action
    if critical or high:
        console.print(
            "\n[dim]  Run [cyan]security --fix[/cyan] "
            "to auto-remediate where safe[/dim]"
        )


def render_unused_resources(unused):
    if not unused:
        console.print(
            Panel(
                "[green]  ✓ No unused resources — "
                "cluster is clean[/green]",
                title="[bold]🗑️  Unused Resources[/bold]",
                border_style=t()["success"],
            )
        )
        return

    # Group by kind
    by_kind = {}
    for item in unused:
        kind = item.get("kind", "Unknown")
        by_kind.setdefault(kind, []).append(item)

    # Summary
    kind_parts = [
        f"[dim]{kind}:[/dim] {len(items)}"
        for kind, items in by_kind.items()
    ]
    summary = (
        f"[bold]{len(unused)}[/bold] unused  │  "
        + "  ".join(kind_parts)
    )

    console.print(
        Panel.fit(summary, border_style=t()["warning"])
    )

    table = Table(
        show_header=True,
        header_style=t()["header"],
        border_style=t()["border"],
        expand=True,
        show_lines=False,
    )

    table.add_column("", width=2)
    table.add_column("Kind", width=12)
    table.add_column("Name", ratio=3)
    table.add_column("Reason", style="dim", ratio=2)

    for item in unused:
        kind = item.get("kind", "")
        icon = _kind_icon(kind)

        table.add_row(
            icon,
            f"[dim]{kind}[/dim]",
            item.get("name", ""),
            item.get("reason", "not referenced by any pod"),
        )

    console.print(table)
    console.print(
        f"[dim]{'─' * 3} {len(unused)} unused resources {'─' * 3}[/dim]"
    )

    # Cleanup hint
    console.print(
        "\n[dim]  Run [cyan]cleanup --dry-run[/cyan] "
        "to preview safe deletions[/dim]"
    )


def _kind_icon(kind):
    icons = {
        "ConfigMap": "[cyan]⚙[/cyan]",
        "Secret": "[red]🔑[/red]",
        "PVC": "[blue]💾[/blue]",
        "Service": "[green]🌐[/green]",
    }
    return icons.get(kind, "[dim]•[/dim]")
