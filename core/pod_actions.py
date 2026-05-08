import questionary
from questionary import Choice

from config.settings import SETTINGS
from core.insights import pod_suggestion
from core.context import context


POD_ACTIONS = [
    "logs",
    "logs --previous",
    "describe",
    "exec (shell)",
    "delete",
    "events",
    "← back"
]


def get_severity(pod):
    status = pod["status"]
    restarts = pod["restarts"]

    if status in ["CrashLoopBackOff", "Error"]:
        return "critical"
    if status == "Pending":
        return "warning"
    if restarts >= SETTINGS["restart_critical_threshold"]:
        return "critical"
    if restarts >= SETTINGS["restart_warning_threshold"]:
        return "warning"
    return "healthy"


def severity_icon(severity):
    if severity == "critical":
        return "❌"
    if severity == "warning":
        return "⚠️ "
    return "✓ "


def format_pod_row(pod):
    severity = get_severity(pod)
    icon = severity_icon(severity)
    name = pod["name"][:48]

    return (
        f"{icon} {name:<50} "
        f"{pod['status']:<20} "
        f"R:{pod['restarts']:<4} "
        f"{pod['age']}"
    )


def interactive_pods(pods):
    pods = sorted(
        pods,
        key=lambda x: (
            {"critical": 0, "warning": 1, "healthy": 2}[get_severity(x)],
            -x["restarts"],
            x["name"]
        )
    )

    choices = [
        Choice(
            title=format_pod_row(pod),
            value=pod["name"]
        )
        for pod in pods
    ]

    choices.append(
        Choice(title="← exit", value=None)
    )

    selected = questionary.select(
        "Navigate pods (↑↓) → Enter to select:",
        choices=choices
    ).ask()

    return selected


def choose_pod_action():
    action = questionary.select(
        "Action:",
        choices=POD_ACTIONS
    ).ask()

    return action


def build_pod_command(pod_name, action):
    ns = context.namespace
    ctx = context.current_context

    if action == "logs":
        return (
            f"kubectl --context {ctx} logs {pod_name} "
            f"-n {ns} --tail=100"
        )

    if action == "logs --previous":
        return (
            f"kubectl --context {ctx} logs {pod_name} "
            f"-n {ns} --previous --tail=100"
        )

    if action == "describe":
        return (
            f"kubectl --context {ctx} describe pod "
            f"{pod_name} -n {ns}"
        )

    if action == "exec (shell)":
        return (
            f"kubectl --context {ctx} exec -it "
            f"{pod_name} -n {ns} -- /bin/sh"
        )

    if action == "delete":
        return (
            f"kubectl --context {ctx} delete pod "
            f"{pod_name} -n {ns}"
        )

    if action == "events":
        return (
            f"kubectl --context {ctx} get events "
            f"-n {ns} "
            f"--field-selector involvedObject.name={pod_name}"
        )

    return None
