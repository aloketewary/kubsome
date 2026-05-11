import subprocess
import json

from core.context import context
from core.cache import cached


@cached(ttl=5)
def collect_pods():
    """Collect pod summary data with labels and age."""
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

    from datetime import datetime, timezone
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
        label_pairs = [
            f"{k}={v}" for k, v in labels.items()
        ] if labels else []
        # Calculate age
        age = ""
        created = meta.get("creationTimestamp", "")
        if created:
            try:
                ts = datetime.fromisoformat(
                    created.replace("Z", "+00:00")
                )
                delta = datetime.now(timezone.utc) - ts
                secs = int(delta.total_seconds())
                if secs < 60:
                    age = f"{secs}s"
                elif secs < 3600:
                    age = f"{secs // 60}m"
                elif secs < 86400:
                    age = f"{secs // 3600}h"
                else:
                    age = f"{secs // 86400}d"
            except Exception:
                pass
        pods.append({
            "name": name,
            "status": phase,
            "restarts": restarts,
            "labels": label_pairs,
            "age": age,
        })

    return pods