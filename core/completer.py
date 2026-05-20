"""
CLI Completer — contextual tab-completion for Kubsome commands.
"""

from prompt_toolkit.completion import Completer, Completion

from core.kubeconfig import get_contexts
from core.config import load_config

_config = load_config()
_aliases = _config.get("aliases", {})

# Top-level commands only (no multi-word entries)
COMMANDS = {
    # Observe
    "pods": "pod list & watch",
    "services": "list services",
    "nodes": "list nodes",
    "logs": "pod logs",
    "logcat": "multi-pod logs",
    "overview": "cluster overview",
    "inspect": "deep pod inspect",
    "events": "cluster events",
    "top": "resource usage",
    "uptime": "cluster uptime",
    "scorecard": "health grade",
    "alerts": "anomaly alerts",
    "anomalies": "anomaly detection",
    # Operate
    "rollout": "rollout status",
    "rollback": "rollback deployment",
    "rollback-preview": "diff before rollback",
    "restart": "rolling restart",
    "scale": "scale replicas",
    "apply": "apply manifest",
    # Diagnose
    "diagnose": "root cause analysis",
    "trace": "resource relationships",
    "dep-health": "dependency health",
    "correlate": "signal correlation",
    "correlate-logs": "multi-pod timeline",
    "find": "global search",
    "doctor": "pre-flight checks",
    # AI
    "why": "AI root cause",
    "summarize": "AI summary",
    "explain": "concept explainer",
    # kubectl
    "describe": "kubectl describe",
    "get": "kubectl get",
    "delete": "kubectl delete",
    # Cost & Security
    "cost": "cost analysis",
    "cost-estimate": "$/month estimate",
    "cost-trend": "cost forecast",
    "security": "security scan",
    "optimize": "right-sizing",
    "unused": "unused resources",
    # Monitoring
    "watch": "watch any command",
    "watch-alert": "background monitor",
    "watch-status": "active watches",
    "diff-timeline": "recent changes",
    "pin": "save query",
    "pins": "list saved queries",
    # Incident
    "incident": "incident management",
    "note": "add observation",
    "snapshot": "capture state",
    # Growth
    "policy": "cluster guardrails",
    "stats": "usage analytics",
    "schedule": "scheduled commands",
    # Resources
    "cronjobs": "list cronjobs",
    "jobs": "list jobs",
    "trigger": "trigger cronjob",
    "config": "configmaps",
    "secret": "secrets",
    "hpa": "autoscalers",
    "pdb": "pod disruption budgets",
    "ingress": "ingress rules",
    "rbac": "RBAC audit",
    "labels": "label management",
    "ns": "namespace overview",
    # Network
    "netcheck": "network diagnostics",
    "dns": "DNS check",
    "mesh": "service mesh",
    "forward": "port forward",
    # Cluster
    "capacity": "cluster capacity",
    "quota": "resource quotas",
    "drain-check": "drain safety",
    "compare": "multi-cluster diff",
    "diff": "resource diff",
    "yaml-diff": "YAML revision diff",
    # Generate
    "generate": "generate manifest",
    # Plugins
    "plugin": "plugin management",
    "plugins": "list plugins",
    # Bookmarks & Workflows
    "bookmark": "bookmark management",
    "bookmarks": "list bookmarks",
    "run": "run bookmark",
    "workflow": "run workflow",
    "workflows": "list workflows",
    # Export & Audit
    "export": "export report",
    "audit": "audit log",
    "changelog": "change history",
    # GitOps
    "gitops": "ArgoCD/Flux sync status",
    "argocd": "ArgoCD status",
    "flux": "Flux status",
    # Service Mesh
    "mesh-detail": "full mesh overview",
    "mesh-status": "mesh overview",
    "vs": "VirtualServices",
    "virtualservices": "Istio VirtualServices",
    "dr": "DestinationRules",
    "destinationrules": "Istio DestinationRules",
    "mtls": "mTLS enforcement",
    # Connect & Config
    "connect": "integration setup",
    "disconnect": "remove integration",
    "integrations": "list integrations",
    "profile": "config profiles",
    "profiles": "list profiles",
    "env": "environment info",
    "guide": "guided mode",
    "menu": "interactive menu",
    # Analytics
    "analytics": "analytics engine stats",
    "collect": "collect metrics now",
    "rightsizing": "right-size recommendations",
    "rightsize": "right-size recommendations",
    "cost-query": "cost by deployment",
    "analytics-export": "export analytics data",
    "sql": "run SQL on analytics",
    # Navigation
    "tui": "terminal UI",
    "dashboard": "web dashboard",
    "shell": "exec into pod",
    "timeline": "event timeline",
    "history": "resource history",
    "deps": "dependencies",
    "snap": "state snapshot",
    "snap-diff": "snapshot diff",
    "use": "switch namespace",
    "switch": "switch context",
    "contexts": "list contexts",
    "playbook": "run playbook",
    "scan": "security scan",
    "check": "health check",
    "cleanup": "cleanup unused",
    "help": "show help",
    "exit": "quit",
}

# Add aliases
for alias, target in _aliases.items():
    COMMANDS[alias] = f"alias → {target}"

# Subcommands for multi-word commands
SUBCOMMANDS = {
    "pods": {"watch": "live pod monitoring"},
    "watch-alert": {
        "crash": "alert on CrashLoopBackOff",
        "restart": "alert on high restarts",
        "oom": "alert on OOMKilled",
        "pending": "alert if stuck Pending",
        "count": "alert if pod count drops",
        "ready": "alert if not enough ready",
        "rm": "remove a watch",
        "mute": "silence notifications",
        "unmute": "re-enable notifications",
        "history": "view alert history",
        "clear": "remove all watches",
    },
    "events": {"watch": "live event stream"},
    "top": {"pods": "pod CPU/memory", "nodes": "node CPU/memory"},
    "incident": {
        "start": "begin tracking",
        "stop": "close incident",
        "status": "current state",
        "share": "export to Slack/Teams",
        "history": "past incidents",
    },
    "schedule": {
        "add": "create schedule",
        "list": "show schedules",
        "rm": "remove schedule",
    },
    "bookmark": {"add": "save command", "rm": "remove bookmark"},
    "plugin": {
        "install": "install plugin",
        "uninstall": "remove plugin",
    },
    "generate": {
        "deployment": "deployment YAML",
        "service": "service YAML",
        "cronjob": "cronjob YAML",
        "configmap": "configmap YAML",
        "ingress": "ingress YAML",
    },
    "export": {"json": "JSON format", "markdown": "Markdown format"},
}

# Flags per command (shown AFTER the required positional arg)
COMMAND_FLAGS = {
    "logs": [
        ("--follow", "stream live"),
        ("-f", "stream live"),
        ("--errors", "errors only"),
        ("--previous", "previous container"),
        ("--since", "time window"),
        ("--regex", "filter pattern"),
        ("-c", "container name"),
        ("--container", "container name"),
    ],
    "logcat": [
        ("--follow", "stream live"),
        ("-f", "stream live"),
        ("--errors", "errors only"),
        ("--watch", "live refresh"),
    ],
    "pods watch": [("--pod", "filter by pod name")],
}

# Commands that take a pod/resource name as first argument
POD_COMMANDS = {
    "logs", "inspect", "diagnose", "netcheck",
    "shell", "forward", "history", "trace",
    "dep-health", "rollout", "rollback", "restart",
    "correlate", "describe",
}


def get_context_names():
    try:
        return [ctx["name"] for ctx in get_contexts()]
    except Exception:
        return []


def get_namespace_names():
    try:
        return sorted(set(
            ctx["namespace"] for ctx in get_contexts()
        ))
    except Exception:
        return []


def _get_pod_names():
    """Return pod names from cache. Background refresh handled by @cached decorator."""
    try:
        from core.k8s import get_pod_names as _names
        return _names()
    except Exception:
        return []


class KubeasyCompleter(Completer):
    def get_completions(self, document, complete_event):
        text = document.text_before_cursor
        words = text.split()

        # Empty or first word — suggest top-level commands
        if not words or (len(words) == 1 and not text.endswith(" ")):
            query = words[0] if words else ""
            for cmd, meta in COMMANDS.items():
                if cmd.startswith(query):
                    yield Completion(
                        cmd,
                        start_position=-len(query),
                        display_meta=meta,
                    )
            return

        cmd = words[0]

        # --- Context-specific completions ---

        # switch <context>
        if cmd == "switch":
            query = words[-1] if not text.endswith(" ") else ""
            for name in get_context_names():
                if not query or query in name:
                    yield Completion(
                        name,
                        start_position=-len(query),
                        display_meta="context",
                    )
            return

        # use <namespace>
        if cmd == "use":
            query = words[-1] if not text.endswith(" ") else ""
            for ns in get_namespace_names():
                if not query or query in ns:
                    yield Completion(
                        ns,
                        start_position=-len(query),
                        display_meta="namespace",
                    )
            return

        # Commands with subcommands (incident, generate, etc.)
        if cmd in SUBCOMMANDS:
            # First arg position — suggest subcommands
            if len(words) == 1 or (
                len(words) == 2 and not text.endswith(" ")
            ):
                query = words[1] if len(words) > 1 else ""
                for sub, meta in SUBCOMMANDS[cmd].items():
                    if sub.startswith(query):
                        yield Completion(
                            sub,
                            start_position=-len(query),
                            display_meta=meta,
                        )
                # For "pods" also suggest pod names after subcommand
                return

            # After subcommand — contextual completions
            sub = words[1] if len(words) > 1 else ""
            compound = f"{cmd} {sub}"

            # pods watch [--pod | <name>]
            if compound == "pods watch":
                query = "" if text.endswith(" ") else words[-1]
                flags = COMMAND_FLAGS.get("pods watch", [])
                already = set(words)
                for flag, meta in flags:
                    if flag not in already and flag.startswith(query):
                        yield Completion(
                            flag,
                            start_position=-len(query),
                            display_meta=meta,
                        )
                for name in _get_pod_names():
                    if query in name:
                        yield Completion(
                            name,
                            start_position=-len(query),
                            display_meta="pod",
                        )
                return

            return

        # Pod-targeting commands: <cmd> <pod> [flags...]
        if cmd in POD_COMMANDS:
            has_pod_arg = len(words) > 2 or (
                len(words) == 2 and text.endswith(" ")
            )
            query = "" if text.endswith(" ") else words[-1]

            if has_pod_arg:
                # Pod already specified — suggest flags
                flags = COMMAND_FLAGS.get(cmd, [])
                already = set(words)
                for flag, meta in flags:
                    if flag not in already and flag.startswith(query):
                        yield Completion(
                            flag,
                            start_position=-len(query),
                            display_meta=meta,
                        )
            else:
                # First arg — suggest pod names
                for name in _get_pod_names():
                    if query in name:
                        yield Completion(
                            name,
                            start_position=-len(query),
                            display_meta="pod",
                        )
            return

        # playbook <name>
        if cmd == "playbook":
            query = "" if text.endswith(" ") else (
                words[1] if len(words) > 1 else ""
            )
            try:
                from core.ai.playbooks import PLAYBOOKS
                for key in PLAYBOOKS:
                    if key.lower().startswith(query.lower()):
                        yield Completion(
                            key,
                            start_position=-len(query),
                            display_meta="playbook",
                        )
            except Exception:
                pass
            return

        # workflow <name>
        if cmd == "workflow":
            query = "" if text.endswith(" ") else (
                words[1] if len(words) > 1 else ""
            )
            try:
                from core.workflows import list_workflows
                for wf in list_workflows():
                    if wf["name"].startswith(query):
                        yield Completion(
                            wf["name"],
                            start_position=-len(query),
                            display_meta="workflow",
                        )
            except Exception:
                pass
            return

        # run <bookmark>
        if cmd == "run":
            query = "" if text.endswith(" ") else (
                words[1] if len(words) > 1 else ""
            )
            try:
                from core.bookmarks import list_bookmarks
                for bm in list_bookmarks():
                    if bm["name"].startswith(query):
                        yield Completion(
                            bm["name"],
                            start_position=-len(query),
                            display_meta="bookmark",
                        )
            except Exception:
                pass
            return

        # scale <deployment> <replicas> — suggest deployment names
        if cmd == "scale":
            if len(words) == 1 or (
                len(words) == 2 and not text.endswith(" ")
            ):
                query = words[1] if len(words) > 1 else ""
                try:
                    from core.k8s import get_deployment_names
                    for name in get_deployment_names():
                        if query in name:
                            yield Completion(
                                name,
                                start_position=-len(query),
                                display_meta="deployment",
                            )
                except Exception:
                    pass
            return


command_completer = KubeasyCompleter()
