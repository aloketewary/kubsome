import subprocess
import json

from core.context import context
from core.cache import cached


@cached(ttl=5)
def collect_pods():
    """Collect pod summary data with labels."""
    cmd = (
        f"kubectl --context {context.current_context} "
        f"get pods -n {context.namespace} -o json"
    )

    result = subprocess.run(
        cmd, shell=True,
        capture_output=True, text=True
    )

    if result.returncode != 0 or not result.stdout.strip():
        return []

    data = json.loads(result.stdout)
    pods = []
    for item in data.get("items", []):
        meta = item.get("metadata", {})
        status = item.get("status", {})
        name = meta.get("name", "")
        phase = status.get("phase", "Unknown")
        restarts = 0
        for cs in status.get("containerStatuses", []):
            restarts += cs.get("restartCount", 0)
        labels = meta.get("labels", {})
        label_values = list(labels.values()) if labels else []
        pods.append({
            "name": name,
            "status": phase,
            "restarts": restarts,
            "labels": label_values,
        })

    return pods