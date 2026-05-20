"""
Guided Mode — context-aware interactive menu for new users.
Shows categorized actions based on current cluster state.
"""

from rich.console import Console
from rich.panel import Panel

console = Console()

CATEGORIES = [
    {
        "name": "Observe",
        "icon": "👁",
        "items": [
            {"label": "Cluster overview", "cmd": "overview"},
            {"label": "List pods", "cmd": "pods"},
            {"label": "Recent events", "cmd": "events"},
            {"label": "CPU/memory usage", "cmd": "top pods"},
            {"label": "Health scorecard", "cmd": "scorecard"},
            {"label": "Cluster uptime", "cmd": "uptime"},
        ],
    },
    {
        "name": "Diagnose",
        "icon": "🔍",
        "items": [
            {"label": "Inspect a pod", "cmd": "inspect"},
            {"label": "Diagnose a pod", "cmd": "diagnose"},
            {"label": "View pod logs", "cmd": "logs"},
            {"label": "Trace dependencies", "cmd": "trace"},
            {"label": "Anomaly scan", "cmd": "alerts"},
            {"label": "What caused this failure?", "cmd": "why-broken"},
            {"label": "Blast radius analysis", "cmd": "blast-radius"},
            {"label": "Predictive alerts", "cmd": "predict"},
        ],
    },
    {
        "name": "Operate",
        "icon": "⚙️",
        "items": [
            {"label": "Restart deployment", "cmd": "restart"},
            {"label": "Scale deployment", "cmd": "scale"},
            {"label": "Rollout status", "cmd": "rollout"},
            {"label": "Rollback preview", "cmd": "rollback-preview"},
            {"label": "Port forward", "cmd": "pf"},
            {"label": "Shell into pod", "cmd": "shell"},
            {"label": "Helm releases", "cmd": "helm-list"},
            {"label": "Helm rollback", "cmd": "helm-rollback"},
        ],
    },
    {
        "name": "Cost & Security",
        "icon": "💰",
        "items": [
            {"label": "Cost estimate", "cmd": "cost-estimate"},
            {"label": "Cost trend", "cmd": "cost-trend"},
            {"label": "Right-sizing", "cmd": "rightsizing"},
            {"label": "Cost query (DuckDB)", "cmd": "cost-query"},
            {"label": "Capacity forecast", "cmd": "capacity-plan"},
            {"label": "Security scan", "cmd": "security"},
            {"label": "Optimize resources", "cmd": "optimize"},
        ],
    },
    {
        "name": "Setup",
        "icon": "🔌",
        "items": [
            {"label": "Connect integrations", "cmd": "connect"},
            {"label": "Switch context", "cmd": "contexts"},
            {"label": "Switch namespace", "cmd": "ns"},
            {"label": "View profiles", "cmd": "profiles"},
            {"label": "Analytics engine", "cmd": "analytics"},
            {"label": "Run doctor", "cmd": "doctor"},
        ],
    },
]


def run_guided_mode():
    """
    Show interactive guided menu.
    Returns the selected command string or None.
    """
    console.print(
        Panel(
            "[bold]What would you like to do?[/bold]\n"
            "[dim]Select a category, then an action. "
            "Type 'q' to exit guided mode.[/dim]",
            title="[bold]🧭 Guided Mode[/bold]",
            border_style="cyan",
        )
    )

    # Show categories
    while True:
        console.print()
        for i, cat in enumerate(CATEGORIES, 1):
            console.print(
                f"  [cyan]{i}[/cyan] "
                f"{cat['icon']} {cat['name']}"
            )
        console.print(f"  [dim]q[/dim] Exit guided mode")
        console.print()

        choice = _input("Category [1-5]: ")
        if choice in ("q", "quit", "exit"):
            return None

        try:
            idx = int(choice) - 1
            if 0 <= idx < len(CATEGORIES):
                result = _show_category(CATEGORIES[idx])
                if result:
                    return result
        except ValueError:
            console.print("[dim]Enter a number 1-5[/dim]")


def _show_category(category):
    """Show items in a category, return selected command."""
    console.print(
        f"\n[bold]{category['icon']} "
        f"{category['name']}[/bold]"
    )

    items = category["items"]
    for i, item in enumerate(items, 1):
        console.print(
            f"  [cyan]{i}[/cyan] {item['label']}  "
            f"[dim]({item['cmd']})[/dim]"
        )
    console.print(f"  [dim]b[/dim] Back")
    console.print()

    choice = _input("Action: ")
    if choice in ("b", "back", ""):
        return None

    try:
        idx = int(choice) - 1
        if 0 <= idx < len(items):
            cmd = items[idx]["cmd"]
            # Commands that need a target
            needs_target = {
                "inspect", "diagnose", "logs", "trace",
                "restart", "scale", "rollout",
                "rollback-preview", "forward", "shell",
                "dep-health",
            }
            if cmd in needs_target:
                target = _input(
                    f"  Target (pod/deployment name): "
                )
                if target:
                    cmd = f"{cmd} {target}"
                else:
                    console.print(
                        "[dim]  Cancelled[/dim]"
                    )
                    return None
            elif cmd == "scale":
                target = _input("  Deployment name: ")
                replicas = _input("  Replicas: ")
                if target and replicas:
                    cmd = f"scale {target} {replicas}"
                else:
                    return None

            return cmd
    except ValueError:
        pass

    return None


def show_contextual_hint():
    """
    Show a contextual hint based on cluster state.
    Called on startup if issues are detected.
    Returns a suggested command or None.
    """
    try:
        from core.collectors.pods import collect_pods
        pods = collect_pods()
        if not pods:
            return None

        crashing = [
            p for p in pods
            if p.get("status") in (
                "CrashLoopBackOff", "Error", "Failed"
            )
        ]
        high_restarts = [
            p for p in pods if p.get("restarts", 0) > 10
        ]

        if crashing:
            pod = crashing[0]["name"]
            console.print(
                f"\n[yellow]⚠ {len(crashing)} pod(s) "
                f"crashing.[/yellow] "
                f"[dim]Try: diagnose {pod}[/dim]"
            )
            return f"diagnose {pod}"

        if high_restarts:
            pod = high_restarts[0]["name"]
            console.print(
                f"\n[yellow]⚠ {len(high_restarts)} pod(s) "
                f"with high restarts.[/yellow] "
                f"[dim]Try: inspect {pod}[/dim]"
            )
            return f"inspect {pod}"

    except Exception:
        pass

    return None


def _input(label):
    """Safe input with KeyboardInterrupt handling."""
    try:
        return input(label).strip()
    except (EOFError, KeyboardInterrupt):
        return ""
