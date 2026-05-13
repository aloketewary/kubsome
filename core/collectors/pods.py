from core.context import context
from core.cache import cached
from core.k8s import get_raw_resources


@cached(ttl=5)
def collect_pods():
    """Collect pod summary data with labels and age."""
    data = get_raw_resources(
        "pods", context.current_context, context.namespace
    )

    from datetime import datetime, timezone
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