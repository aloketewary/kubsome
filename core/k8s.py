import subprocess
import json
from datetime import datetime, timezone
import humanize

from core.context import context
from core.cache import cached


@cached(ttl=5)
def get_pods():
    command = [
        "kubectl",
        "--context", str(context.current_context or ""),
        "get", "pods",
        "-n", str(context.namespace),
        "-o", "json"
    ]

    result = subprocess.run(
        command,
        shell=False,
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


@cached(ttl=10)
def get_pod_names():
    """Fast pod name list using jsonpath (no full JSON parse)."""
    command = [
        "kubectl",
        "--context", str(context.current_context or ""),
        "get", "pods",
        "-n", str(context.namespace),
        "-o", "jsonpath={.items[*].metadata.name}"
    ]

    result = subprocess.run(
        command, shell=False,
        capture_output=True, text=True
    )

    if result.returncode != 0:
        return []

    return result.stdout.strip("'").split()

def human_age(timestamp: str):
    created = datetime.fromisoformat(
        timestamp.replace("Z", "+00:00")
    )

    now = datetime.now(timezone.utc)

    return humanize.naturaltime(now - created)