from prompt_toolkit.completion import Completer, Completion

from core.kubeconfig import get_contexts
from core.config import load_config

_config = load_config()
_aliases = _config.get("aliases", {})

COMMANDS = [
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
    "rollout",
    "rollback",
    "restart",
    "scale",
    "top pods",
    "top nodes",
    "diagnose",
    "trace",
    "find",
    "ns",
    "tui",
    "dashboard",
    "why",
    "summarize",
    "what changed",
    "which pods are unhealthy",
    "compare",
    "plugin",
    "plugins",
    "incident start",
    "incident stop",
    "incident status",
    "note",
    "snapshot",
    "help",
    "alerts",
    "anomalies",
    "playbook",
    "correlate",
    "optimize",
    "cost",
    "security",
    "scan",
    "unused",
    "cleanup",
    "check",
    "export",
    "export json",
    "audit",
    "netcheck",
    "cronjobs",
    "jobs",
    "trigger",
    "config",
    "secret",
    "diff",
    "forward",
    "explain",
    "generate deployment",
    "generate service",
    "generate cronjob",
    "generate configmap",
    "generate ingress",
    "hpa",
    "pdb",
    "capacity",
    "quota",
    "drain-check",
    "bookmark",
    "bookmark add",
    "bookmark rm",
    "bookmarks",
    "run",
    "workflow",
    "workflows",
    "watch",
    "rbac",
    "shell",
    "timeline",
    "labels",
    "apply",
    "snap",
    "snap-diff",
    "changelog",
    "history",
    "mesh",
    "ingress",
    "deps",
    "dns",
    "use",
    "switch",
    "contexts",
    "exit"
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
                query = words[1] if len(words) > 1 else ""
                if "watch".startswith(query):
                    yield Completion(
                        "watch",
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
