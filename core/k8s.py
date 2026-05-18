import subprocess
import json
from datetime import datetime, timezone
import humanize

from core.context import context
from core.cache import cached


@cached(ttl=10)
def get_raw_resources(kind, context_name, namespace=None, selector=None, field_selector=None, sort_by=None):
    """Unified raw resource fetcher with caching."""
    command = [
        "kubectl", "--context", str(context_name or ""),
        "get", kind, "-o", "json"
    ]
    if namespace:
        command.extend(["-n", namespace])
    if selector:
        command.extend(["-l", selector])
    if field_selector:
        command.extend(["--field-selector", field_selector])
    if sort_by:
        command.extend(["--sort-by", sort_by])

    result = subprocess.run(
        command,
        capture_output=True,
        text=True
    )

    if result.returncode != 0 or not result.stdout.strip():
        return {"items": []}

    try:
        return json.loads(result.stdout)
    except json.JSONDecodeError:
        return {"items": []}


@cached(ttl=5)
def get_pods():
    data = get_raw_resources(
        "pods", context.current_context, context.namespace
    )

    pods = []

    for item in data.get("items", []):
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


@cached(ttl=30)
def get_pod_names():
    """Fast pod name list using -o name (no full JSON parse)."""
    command = [
        "kubectl",
        "--context", str(context.current_context or ""),
        "get", "pods",
        "-n", str(context.namespace),
        "-o", "name"
    ]

    result = subprocess.run(
        command, capture_output=True, text=True
    )

    if result.returncode != 0:
        return []

    # 'pod/name' -> 'name'
    return [
        line.split("/")[-1]
        for line in result.stdout.strip().split("\n")
        if "/" in line
    ]

def human_age(timestamp: str):
    created = datetime.fromisoformat(
        timestamp.replace("Z", "+00:00")
    )

    now = datetime.now(timezone.utc)

    return humanize.naturaltime(now - created)
