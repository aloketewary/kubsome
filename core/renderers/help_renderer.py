from rich.console import Console
from rich.panel import Panel
from rich.table import Table

console = Console()


def render_help():
    table = Table(
        show_header=True,
        header_style="bold cyan",
        border_style="dim",
        expand=True,
        show_lines=False,
        pad_edge=True
    )

    table.add_column("Command", style="cyan", width=34)
    table.add_column("Description")

    # Workspace
    table.add_row("[bold]— Workspace —[/bold]", "")
    table.add_row("switch <query>", "Fuzzy switch context")
    table.add_row("use <namespace>", "Switch namespace")
    table.add_row("contexts", "List all contexts")

    # Observability
    table.add_row("", "")
    table.add_row("[bold]— Observability —[/bold]", "")
    table.add_row("overview", "Cluster health dashboard + alerts")
    table.add_row("pods", "Pod list with health indicators")
    table.add_row("pods watch", "Live pod monitoring")
    table.add_row("events", "Namespace events")
    table.add_row("events watch", "Live event stream")
    table.add_row("timeline", "Visual event timeline (last 60m)")
    table.add_row("top pods", "Pod CPU/memory usage")
    table.add_row("top nodes", "Node resource pressure")
    table.add_row("ns", "Namespace resource summary")
    table.add_row("uptime", "Cluster uptime & availability")

    # Operations
    table.add_row("", "")
    table.add_row("[bold]— Operations —[/bold]", "")
    table.add_row("logs <pod> [--follow|--errors]", "Pod logs (fuzzy match)")
    table.add_row("shell <pod>", "Exec into pod")
    table.add_row("rollout <deployment>", "Rollout status + progress")
    table.add_row("rollback <deployment>", "Undo last rollout")
    table.add_row("restart <deployment>", "Rolling restart")
    table.add_row("scale <deployment> <n>", "Scale replicas")
    table.add_row("forward <pod> <port>", "Port forward")
    table.add_row("apply <file.yaml>", "Apply manifest")

    # Inspect
    table.add_row("", "")
    table.add_row("[bold]— Inspect —[/bold]", "")
    table.add_row("inspect <pod>", "Deep pod inspection")
    table.add_row("diagnose <pod>", "Root cause analysis + playbook")
    table.add_row("trace <resource>", "Resource relationship map")
    table.add_row("diff <deployment>", "Show last rollout changes")
    table.add_row("history <resource>", "Resource event history")
    table.add_row("labels <type> [name]", "View labels/annotations")
    table.add_row("config <configmap>", "View ConfigMap data")
    table.add_row("secret <secret>", "View Secret keys (masked)")

    # Network
    table.add_row("", "")
    table.add_row("[bold]— Network —[/bold]", "")
    table.add_row("netcheck <pod>", "DNS + endpoint diagnostics")
    table.add_row("mesh", "Service mesh status (Istio/Linkerd)")
    table.add_row("ingress", "List ingress routes")
    table.add_row("deps <deployment>", "Dependency map")
    table.add_row("dns <service>", "DNS resolution debug")

    # Scaling
    table.add_row("", "")
    table.add_row("[bold]— Scaling —[/bold]", "")
    table.add_row("hpa", "HorizontalPodAutoscaler status")
    table.add_row("pdb", "PodDisruptionBudget status")
    table.add_row("capacity", "Cluster headroom (CPU/memory)")
    table.add_row("quota", "Namespace resource quota usage")
    table.add_row("drain-check <node>", "Preview drain impact")

    # Intelligence
    table.add_row("", "")
    table.add_row("[bold]— Intelligence —[/bold]", "")
    table.add_row("why is <pod> failing", "AI root cause analysis")
    table.add_row("summarize", "Cluster health summary")
    table.add_row("what changed", "Recent activity analysis")
    table.add_row("which pods are unhealthy", "Degraded pod list")
    table.add_row("is <resource> healthy", "Quick health check")
    table.add_row("explain <concept>", "Explain K8s concept")
    table.add_row("alerts", "Anomaly detection scan")
    table.add_row("correlate [pod]", "Cause-effect chains")
    table.add_row("playbook <issue>", "Remediation guide")

    # Security & Cost
    table.add_row("", "")
    table.add_row("[bold]— Security & Cost —[/bold]", "")
    table.add_row("security / scan", "Security misconfiguration scan")
    table.add_row("rbac", "RBAC role bindings viewer")
    table.add_row("optimize / cost", "Resource right-sizing")
    table.add_row("unused / cleanup", "Find orphaned resources")

    # Jobs
    table.add_row("", "")
    table.add_row("[bold]— Jobs —[/bold]", "")
    table.add_row("cronjobs", "List CronJobs")
    table.add_row("jobs", "List recent Jobs")
    table.add_row("trigger <cronjob>", "Manually trigger CronJob")

    # Multi-cluster
    table.add_row("", "")
    table.add_row("[bold]— Multi-cluster —[/bold]", "")
    table.add_row("compare <ctx-a> <ctx-b>", "Environment drift detection")

    # Incident
    table.add_row("", "")
    table.add_row("[bold]— Incident Mode —[/bold]", "")
    table.add_row("incident start [title]", "Start tracking")
    table.add_row("note <text>", "Add observation")
    table.add_row("snapshot / snap", "Capture cluster state")
    table.add_row("snap-diff", "Compare vs last snapshot")
    table.add_row("incident stop", "Close & export report")

    # Reporting
    table.add_row("", "")
    table.add_row("[bold]— Reporting —[/bold]", "")
    table.add_row("check", "Health check with A-F score")
    table.add_row("export [json]", "Export report (MD/JSON)")
    table.add_row("changelog", "Today's change summary")
    table.add_row("audit", "Destructive action log")

    # Automation
    table.add_row("", "")
    table.add_row("[bold]— Automation —[/bold]", "")
    table.add_row("bookmark add <name> <cmd>", "Save a command")
    table.add_row("bookmarks", "List bookmarks")
    table.add_row("run <bookmark>", "Execute bookmark")
    table.add_row("workflow <name>", "Run multi-step workflow")
    table.add_row("workflows", "List workflows")
    table.add_row("watch <command>", "Live-refresh any command")
    table.add_row("!", "Repeat last command")
    table.add_row("<cmd> && <cmd>", "Chain commands")

    # Search & Generate
    table.add_row("", "")
    table.add_row("[bold]— Search & Generate —[/bold]", "")
    table.add_row("find <query>", "Fuzzy search all resources")
    table.add_row("generate <kind> <name>", "Generate YAML manifest")

    # kubectl
    table.add_row("", "")
    table.add_row("[bold]— kubectl (fuzzy) —[/bold]", "")
    table.add_row("describe pod <name>", "Describe pod (pretty)")
    table.add_row("describe deploy <name>", "Describe deployment")
    table.add_row("get pods", "List pods (table)")
    table.add_row("get deploy [name]", "List/get deployments")
    table.add_row("get svc", "List services")
    table.add_row("get nodes", "List nodes")
    table.add_row("get ingress", "List ingress")
    table.add_row("get pvc", "List persistent volumes")
    table.add_row("delete pod <name>", "Delete pod (fuzzy)")
    table.add_row("edit deploy <name>", "Edit resource in $EDITOR")
    table.add_row("port-forward <pod> <port>", "Port forward (fuzzy)")
    table.add_row("exec <pod>", "Shell into pod (fuzzy)")
    table.add_row("cp <pod>:<path> <local>", "Copy files from/to pod")
    table.add_row("kubectl <anything>", "Raw kubectl passthrough")

    # System
    table.add_row("", "")
    table.add_row("[bold]— System —[/bold]", "")
    table.add_row("plugins / plugin <name>", "Plugin system")
    table.add_row("tui / dashboard", "Full-screen TUI")
    table.add_row("help", "Show this help")
    table.add_row("exit", "Quit Kubsome")

    console.print(
        Panel(
            table,
            title="[bold]🚀 Kubsome Commands[/bold]",
            border_style="cyan",
            padding=(1, 1)
        )
    )
