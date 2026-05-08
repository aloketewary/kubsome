import subprocess
import json
from datetime import datetime, timezone
import humanize

from core.context import context


def get_pods():
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
        container_statuses = item["status"].get(
            "containerStatuses",
            []
        )

        restarts = 0

        if container_statuses:
            restarts = container_statuses[0].get(
                "restartCount",
                0
            )

        pod = {
            "name": item["metadata"]["name"],
            "status": item["status"].get(
                "phase",
                "Unknown"
            ),
            "restarts": restarts,
            "age": human_age(
                item["metadata"]["creationTimestamp"]
            )
        }

        pods.append(pod)

    return pods

def human_age(timestamp: str):
    created = datetime.fromisoformat(
        timestamp.replace("Z", "+00:00")
    )

    now = datetime.now(timezone.utc)

    return humanize.naturaltime(now - created)