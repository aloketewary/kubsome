import subprocess
from rich.console import Console

from core.context import context
from core.resolver import resolve_pod_name
from core.selector import choose_pod

console = Console()

# kubectl subcommands that take a resource name
_RESOURCE_CMDS = {
    "describe", "delete", "edit", "get",
    "logs", "exec", "port-forward",
}

_POD_RESOURCES = {
    "pod", "pods", "po",
}


def execute(command):
    command = _fuzzy_resolve(command)
    try:
        result = subprocess.run(
            command,
            shell=True,
            capture_output=True,
            text=True
        )

        if result.stdout:
            console.print(result.stdout)
        if result.stderr:
            console.print(f"[red]{result.stderr}[/red]")

    except Exception as e:
        console.print(f"[red]Error:[/red] {e}")


def _fuzzy_resolve(command: str) -> str:
    """Fuzzy-resolve resource names in kubectl commands."""
    tokens = command.split()
    if len(tokens) < 3:
        return command
    if tokens[0] != "kubectl":
        return command

    # Find the subcommand (skip flags)
    sub_idx = None
    for i, t in enumerate(tokens[1:], 1):
        if not t.startswith("-"):
            sub_idx = i
            break

    if sub_idx is None:
        return command

    sub = tokens[sub_idx]
    if sub not in _RESOURCE_CMDS:
        return command

    # kubectl logs <name> / kubectl exec <name>
    if sub in ("logs", "exec", "port-forward"):
        name_idx = _next_non_flag(tokens, sub_idx + 1)
        if name_idx is None or name_idx >= len(tokens):
            return command
        query = tokens[name_idx]
        matches = resolve_pod_name(query)
        if not matches:
            return command
        pod = choose_pod(matches)
        if not pod:
            return command
        if pod != query:
            console.print(
                f"[dim]→ resolved:[/dim] [cyan]{pod}[/cyan]"
            )
        tokens[name_idx] = pod
        return " ".join(tokens)

    # kubectl describe/get/delete/edit <resource> <name>
    res_idx = _next_non_flag(tokens, sub_idx + 1)
    if res_idx is None:
        return command

    resource = tokens[res_idx]

    # If resource looks like a name (not a known type),
    # assume it's a pod name: kubectl describe customer
    if resource not in _KNOWN_RESOURCES:
        query = resource
        matches = resolve_pod_name(query)
        if not matches:
            return command
        pod = choose_pod(matches)
        if not pod:
            return command
        if pod != query:
            console.print(
                f"[dim]→ resolved:[/dim] "
                f"[cyan]pod/{pod}[/cyan]"
            )
        tokens[res_idx] = "pod"
        tokens.insert(res_idx + 1, pod)
        return " ".join(tokens)

    # Normal: kubectl describe pod <name>
    if resource not in _POD_RESOURCES:
        return command

    name_idx = _next_non_flag(tokens, res_idx + 1)
    if name_idx is None or name_idx >= len(tokens):
        return command

    query = tokens[name_idx]
    matches = resolve_pod_name(query)
    if not matches:
        return command

    pod = choose_pod(matches)
    if not pod:
        return command

    if pod != query:
        console.print(
            f"[dim]→ resolved:[/dim] [cyan]{pod}[/cyan]"
        )

    tokens[name_idx] = pod
    return " ".join(tokens)


_KNOWN_RESOURCES = {
    "pod", "pods", "po",
    "deployment", "deployments", "deploy",
    "service", "services", "svc",
    "node", "nodes", "no",
    "namespace", "namespaces", "ns",
    "configmap", "configmaps", "cm",
    "secret", "secrets",
    "ingress", "ingresses", "ing",
    "job", "jobs",
    "cronjob", "cronjobs", "cj",
    "replicaset", "replicasets", "rs",
    "statefulset", "statefulsets", "sts",
    "daemonset", "daemonsets", "ds",
    "pvc", "persistentvolumeclaim",
    "pv", "persistentvolume",
    "hpa", "horizontalpodautoscaler",
    "sa", "serviceaccount",
    "role", "roles",
    "rolebinding", "rolebindings",
    "clusterrole", "clusterroles",
    "clusterrolebinding", "clusterrolebindings",
    "endpoints", "ep",
    "event", "events", "ev",
    "networkpolicy", "netpol",
    "pdb", "poddisruptionbudget",
}


def _next_non_flag(tokens, start):
    for i in range(start, len(tokens)):
        if not tokens[i].startswith("-"):
            return i
    return None