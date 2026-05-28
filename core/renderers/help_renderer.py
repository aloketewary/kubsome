"""
Help Renderer — categorized command reference with
quick-start tips and keyboard shortcuts.
"""

from rich.console import Console
from rich.panel import Panel
from rich.table import Table
from rich.columns import Columns

from core.config import load_config

console = Console()

from core.theme import t

_config = load_config()
_aliases = _config.get("aliases", {})


def render_help():
    # Quick start tips
    tips = (
        "[dim]Tips:[/dim]  "
        "[cyan]Tab[/cyan] autocomplete  │  "
        "[cyan]![/cyan] repeat last  │  "
        "[cyan]&&[/cyan] chain commands  │  "
        "Natural language works: [dim]show me logs for payment[/dim]"
    )
    console.print(Panel.fit(tips, border_style=t()["border"]))

    # Command sections
    _section("Observe", [
        ("overview", "Cluster dashboard + alerts"),
        ("pods / pods watch", "Pod list / live monitoring"),
        ("events / events watch", "Events / live stream"),
        ("top pods / top nodes", "CPU/memory usage"),
        ("uptime", "Cluster availability"),
        ("scorecard", "A-F health grade"),
        ("diff-timeline [hours]", "What changed (24h)"),
    ])

    _section("Operate", [
        ("logs <pod> [--follow|--errors]", "Pod logs (fuzzy)"),
        ("shell <pod>", "Exec into pod"),
        ("rollout <deployment>", "Rollout status"),
        ("restart <deployment>", "Rolling restart"),
        ("scale <deployment> <n>", "Scale replicas"),
        ("rollback <deployment>", "Undo last rollout"),
        ("forward <pod> <port>", "Port forward"),
        ("apply <file.yaml>", "Apply manifest"),
        ("taints", "List all node taints"),
        ("taint <node> key=val:Effect", "Apply taint"),
        ("untaint <node> key:Effect", "Remove taint"),
    ])

    _section("Diagnose", [
        ("inspect <pod>", "Deep pod inspection"),
        ("diagnose <pod>", "Root cause + playbook"),
        ("trace <resource>", "Resource relationship map"),
        ("dep-health <deployment>", "Dependency health"),
        ("correlate <pod1> <pod2>", "Multi-pod log timeline"),
        ("netcheck <pod>", "Network diagnostics"),
        ("doctor", "Pre-flight checks"),
    ])

    _section("AI (natural language)", [
        ("why is <pod> failing", "Root cause explanation"),
        ("summarize", "Cluster health summary"),
        ("what changed", "Recent activity analysis"),
        ("explain <concept>", "K8s concept explainer"),
        ("alerts / anomalies", "Anomaly detection"),
        ("playbook <issue>", "Step-by-step remediation"),
    ])

    _section("Cost & Security", [
        ("cost / optimize", "Resource right-sizing"),
        ("security / scan", "Misconfiguration scan"),
        ("unused / cleanup", "Orphaned resources"),
        ("cost-trend", "Cost forecast"),
        ("cost-query", "Cost by deployment (DuckDB)"),
        ("rightsizing", "Right-size from analytics"),
        ("rbac", "RBAC audit"),
    ])

    _section("Incident", [
        ("incident start [title]", "Begin tracking"),
        ("note <text>", "Add observation"),
        ("snapshot / snap", "Capture state"),
        ("snap-diff", "Compare vs last snapshot"),
        ("incident stop", "Close & export"),
        ("incident share", "Export to Slack/Teams"),
    ])

    _section("Automation", [
        ("bookmark add <name> <cmd>", "Save command"),
        ("run <bookmark>", "Execute bookmark"),
        ("workflow <name>", "Run workflow"),
        ("watch <command>", "Live-refresh any command"),
        ("schedule add <name> <cron> <cmds>", "Cron schedule"),
        ("generate <kind> <name>", "Generate YAML"),
        ("plugin install <name>", "Install plugin"),
    ])

    _section("GitOps & Mesh", [
        ("gitops", "ArgoCD/Flux sync status"),
        ("gitops <app>", "App detail + resources"),
        ("mesh-detail", "Mesh overview (mTLS, injection)"),
        ("vs [name]", "VirtualServices + routing"),
        ("dr [name]", "DestinationRules + circuit breakers"),
        ("mtls", "mTLS enforcement status"),
    ])

    _section("Analytics (DuckDB)", [
        ("analytics", "Engine stats (rows, size)"),
        ("collect", "Collect metrics now"),
        ("rightsizing", "Right-size recommendations"),
        ("cost-query", "Cost attribution per deploy"),
        ("predict / forecast", "Predictive alerts (OOM in ~Xh)"),
        ("capacity-plan", "Days until cluster full"),
        ("why-broken <pod>", "Correlate failure with changes"),
        ("blast-radius <deploy> [action]", "Impact analysis"),
        ("analytics-export <query> [parquet]", "Export CSV/Parquet"),
        ("sql <SELECT ...>", "Custom SQL query"),
    ])

    _section("Helm", [
        ("helm-list", "All releases with status"),
        ("helm-status <release>", "Release detail"),
        ("helm-history <release>", "Revision history"),
        ("helm-values <release>", "Computed values"),
        ("helm-diff <release>", "What changed vs previous"),
        ("helm-rollback <release> [rev]", "Rollback (with safety)"),
    ])

    _section("Port Forwards", [
        ("pf", "List active forwards"),
        ("pf <pod/svc> <port>", "Start forward (background)"),
        ("pf <pod> <local>:<remote>", "Custom port mapping"),
        ("pf stop <target>", "Stop one forward"),
        ("pf stop-all", "Stop all forwards"),
    ])

    _section("Setup", [
        ("connect [name] [url]", "Integration setup"),
        ("connect --discover", "Auto-discover integrations"),
        ("disconnect <name>", "Remove integration"),
        ("profile / profile use <name>", "Config profiles"),
        ("env", "Current environment info"),
        ("guide / menu", "Interactive guided mode"),
    ])

    _section("kubectl (fuzzy)", [
        ("describe pod <name>", "Pretty describe"),
        ("get pods / deploy / svc", "List resources"),
        ("delete pod <name>", "Delete (with confirm)"),
        ("kubectl <anything>", "Raw passthrough"),
    ])

    _section("Navigation", [
        ("switch <context>", "Fuzzy switch context"),
        ("use <namespace>", "Switch namespace"),
        ("find <query>", "Search all resources"),
        ("tui / dashboard", "Full-screen UI"),
        ("help", "This help"),
        ("exit", "Quit"),
    ])

    # Aliases
    if _aliases:
        alias_str = "  ".join(
            f"[cyan]{k}[/cyan]→{v}"
            for k, v in _aliases.items()
        )
        console.print(
            f"\n[dim]Aliases:[/dim]  {alias_str}"
        )

    console.print()


def _section(title, commands):
    """Render a help section as a compact table."""
    table = Table(
        show_header=False,
        border_style=t()["border"],
        expand=True,
        show_lines=False,
        pad_edge=True,
        show_edge=False,
        padding=(0, 1),
    )

    table.add_column("Command", style="cyan", width=36, no_wrap=True)
    table.add_column("Description", style="dim")

    for cmd, desc in commands:
        table.add_row(cmd, desc)

    console.print(
        Panel(
            table,
            title=f"[bold]{title}[/bold]",
            border_style=t()["primary"],
            padding=(0, 0),
        )
    )
