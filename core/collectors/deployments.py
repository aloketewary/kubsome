import subprocess
import json

from core.context import context


def collect_deployments():

    command = (
        f"kubectl "
        f"--context {context.current_context} "
        f"get deployments "
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
        return []

    data = json.loads(result.stdout)

    deployments = []

    for item in data["items"]:

        desired = item["spec"]["replicas"]

        available = item["status"].get(
            "availableReplicas",
            0
        )

        deployments.append({
            "name": item["metadata"]["name"],
            "desired": desired,
            "available": available
        })

    return deployments