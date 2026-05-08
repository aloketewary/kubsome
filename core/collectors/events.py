import subprocess
import json

from core.context import context


def collect_events(limit=50):
    command = (
        f"kubectl "
        f"--context {context.current_context} "
        f"get events "
        f"-n {context.namespace} "
        f"--sort-by=.lastTimestamp "
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

    events = []
    for item in data.get("items", [])[-limit:]:
        events.append({
            "type": item.get("type", "Normal"),
            "reason": item.get("reason", ""),
            "object": item.get(
                "involvedObject", {}
            ).get("name", ""),
            "kind": item.get(
                "involvedObject", {}
            ).get("kind", ""),
            "message": item.get("message", ""),
            "count": item.get("count", 1),
            "last_seen": item.get(
                "lastTimestamp", ""
            ),
        })

    return events
