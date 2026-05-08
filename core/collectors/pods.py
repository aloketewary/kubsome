import subprocess
import json

from core.context import context


def collect_pods():

    command = (
        f"kubectl "
        f"--context {context.current_context} "
        f"get pods "
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

    pods = []

    for item in data["items"]:

        statuses = item["status"].get(
            "containerStatuses",
            []
        )

        restarts = 0

        if statuses:
            restarts = statuses[0].get(
                "restartCount",
                0
            )

        pods.append({
            "name": item["metadata"]["name"],
            "status": item["status"]["phase"],
            "restarts": restarts
        })

    return pods