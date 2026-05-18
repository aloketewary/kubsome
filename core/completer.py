from prompt_toolkit.completion import Completer, Completion

from core.kubeconfig import get_contexts
from core.config import load_config

_config = load_config()
_aliases = _config.get("aliases", {})

COMMANDS = [
    # Observe
    "pods",
    "pods watch",
    "services",
    "nodes",
    "logs",
    "logcat",
    "overview",
    "inspect",
    "events",
    "events watch",
    "top pods",
    "top nodes",
    "uptime",
    "scorecard",
    "alerts",
    "anomalies",
    # Operate
    "rollout",
    "rollback",
    "rollback-preview",
    "restart",
    "scale",
    "apply",
    # Diagnose
    "diagnose",
    "trace",
    "dep-health",
    "correlate",
    "correlate-logs",
    "find",
    "doctor",
    # AI
    "why",
    "summarize",
    "what changed",
    "which pods are unhealthy",
    "explain",
    # kubectl
    "describe",
    "get",
    "delete",
    # Cost & Security
    "cost",
    "cost-estimate",
    "cost-trend",
    "security",
    "optimize",
    "unused",
    # Monitoring
    "watch",
    "watch-alert",
    "watch-status",
    "diff-timeline",
    "pin",
    "pins",
    # Incident
    "incident start",
    "incident stop",
    "incident status",
    "incident share",
    "incident history",
    "note",
    "snapshot",
    # Growth
    "doctor",
    "policy",
    "stats",
    "schedule add",
    "schedule list",
    "schedule rm",
    # Resources
    "cronjobs",
    "jobs",
    "trigger",
    "config",
    "secret",
    "hpa",
    "pdb",
    "ingress",
    "rbac",
    "labels",
    "ns",
    # Network
    "netcheck",
    "dns",
    "mesh",
    "forward",
    # Cluster
    "capacity",
    "quota",
    "drain-check",
    "compare",
    "diff",
    "yaml-diff",
    # Generate
    "generate deployment",
    "generate service",
    "generate cronjob",
    "generate configmap",
    "generate ingress",
    # Plugins
    "plugin",
    "plugin install",
    "plugin uninstall",
    "plugins",
    # Bookmarks & Workflows
    "bookmark",
    "bookmark add",
    "bookmark rm",
    "bookmarks",
    "run",
    "workflow",
    "workflows",
    # Export & Audit
    "export",
    "export json",
    "audit",
    "changelog",
    # Navigation
    "tui",
    "dashboard",
    "shell",
    "timeline",
    "history",
    "deps",
    "snap",
    "snap-diff",
    "use",
    "switch",
    "contexts",
    "playbook",
    "scan",
    "check",
    "cleanup",
    "help",
    "exit",
] + list(_aliases.keys())


# Commands that take a pod name as argument
POD_COMMANDS = {
    "logs", "inspect", "diagnose", "netcheck",
    "shell", "forward", "history"
}


def get_context_names():
    try:
        contexts = get_contexts()
        return [ctx["name"] for ctx in contexts]
    except Exception:
        return []


def get_namespace_names():
    try:
        contexts = get_contexts()
        namespaces = set(
            ctx["namespace"] for ctx in contexts
        )
        return sorted(namespaces)
    except Exception:
        return []


def get_pod_names():
    try:
        from core.k8s import get_pod_names as _get_names
        return _get_names()
    except Exception:
        return []


class KubeasyCompleter(Completer):
    def get_completions(self, document, complete_event):
        text = document.text_before_cursor
        words = text.split()

        # Suggest subcommands/arguments after first word
        if len(words) >= 2 or (
            len(words) == 1 and text.endswith(" ")
        ):
            cmd = words[0]

            if cmd == "switch":
                query = words[1] if len(words) > 1 else ""
                for name in get_context_names():
                    if name.startswith(query) or query in name:
                        yield Completion(
                            name,
                            start_position=-len(query)
                        )
                return

            if cmd == "use":
                query = words[1] if len(words) > 1 else ""
                for ns in get_namespace_names():
                    if ns.startswith(query) or query in ns:
                        yield Completion(
                            ns,
                            start_position=-len(query)
                        )
                return

            if cmd == "pods":
                if len(words) == 1 or (
                    len(words) == 2 and not text.endswith(" ")
                ):
                    query = words[1] if len(words) > 1 else ""
                    if "watch".startswith(query):
                        yield Completion(
                            "watch",
                            start_position=-len(query)
                        )
                elif len(words) >= 2 and words[1] == "watch":
                    # Complete pod names after "pods watch"
                    query = words[2] if len(words) > 2 else ""
                    for name in get_pod_names():
                        if query in name:
                            yield Completion(
                                name,
                                start_position=-len(query)
                            )
                return

            # Pod name completion for relevant commands
            if cmd in POD_COMMANDS:
                query = words[1] if len(words) > 1 else ""
                for name in get_pod_names():
                    if query in name:
                        yield Completion(
                            name,
                            start_position=-len(query)
                        )
                return

            # Playbook completion
            if cmd == "playbook":
                query = words[1] if len(words) > 1 else ""
                from core.ai.playbooks import PLAYBOOKS
                for key in PLAYBOOKS:
                    if key.lower().startswith(query.lower()):
                        yield Completion(
                            key,
                            start_position=-len(query)
                        )
                return

            # Workflow completion
            if cmd == "workflow":
                query = words[1] if len(words) > 1 else ""
                from core.workflows import list_workflows
                for wf in list_workflows():
                    if wf["name"].startswith(query):
                        yield Completion(
                            wf["name"],
                            start_position=-len(query)
                        )
                return

            # Bookmark run completion
            if cmd == "run":
                query = words[1] if len(words) > 1 else ""
                from core.bookmarks import list_bookmarks
                for bm in list_bookmarks():
                    if bm["name"].startswith(query):
                        yield Completion(
                            bm["name"],
                            start_position=-len(query)
                        )
                return

            return

        # Suggest top-level commands
        query = words[0] if words else ""
        for cmd in COMMANDS:
            if cmd.startswith(query):
                yield Completion(
                    cmd,
                    start_position=-len(query)
                )


command_completer = KubeasyCompleter()
