import subprocess
import json

from core.context import context


def rollout_status(deployment_name):
    command = (
        f"kubectl "
        f"--context {context.current_context} "
        f"get deployment {deployment_name} "
        f"-n {context.namespace} "
        f"-o json"
    )

    result = subprocess.run(
        command,
        shell=True,
        capture_output=True,
        text=True
    )

    if result.returncode != 0:
        return None

    data = json.loads(result.stdout)
    spec = data["spec"]
    status = data["status"]

    desired = spec.get("replicas", 0)
    ready = status.get("readyReplicas", 0)
    available = status.get("availableReplicas", 0)
    updated = status.get("updatedReplicas", 0)
    unavailable = status.get(
        "unavailableReplicas", 0
    )

    conditions = status.get("conditions", [])
    progressing = None
    for cond in conditions:
        if cond["type"] == "Progressing":
            progressing = cond

    stuck = False
    if progressing:
        if (
            progressing.get("reason")
            == "ProgressDeadlineExceeded"
        ):
            stuck = True

    strategy = spec.get("strategy", {}).get(
        "type", "RollingUpdate"
    )

    return {
        "name": deployment_name,
        "desired": desired,
        "ready": ready,
        "available": available,
        "updated": updated,
        "unavailable": unavailable,
        "stuck": stuck,
        "strategy": strategy,
        "conditions": conditions,
        "image": _get_image(spec),
    }


def rollout_history(deployment_name):
    command = (
        f"kubectl "
        f"--context {context.current_context} "
        f"rollout history deployment/{deployment_name} "
        f"-n {context.namespace}"
    )

    result = subprocess.run(
        command,
        shell=True,
        capture_output=True,
        text=True
    )

    return result.stdout


def rollout_rollback(deployment_name):
    command = (
        f"kubectl "
        f"--context {context.current_context} "
        f"rollout undo deployment/{deployment_name} "
        f"-n {context.namespace}"
    )

    result = subprocess.run(
        command,
        shell=True,
        capture_output=True,
        text=True
    )

    return result.returncode == 0, result.stdout


def rollout_restart(deployment_name):
    command = (
        f"kubectl "
        f"--context {context.current_context} "
        f"rollout restart deployment/{deployment_name} "
        f"-n {context.namespace}"
    )

    result = subprocess.run(
        command,
        shell=True,
        capture_output=True,
        text=True
    )

    return result.returncode == 0, result.stdout


def _get_image(spec):
    containers = spec.get(
        "template", {}
    ).get(
        "spec", {}
    ).get("containers", [])

    if containers:
        return containers[0].get("image", "")
    return ""
