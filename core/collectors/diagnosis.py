import subprocess
import json

from core.context import context
from core.collectors.inspect import (
    inspect_pod, pod_events, pod_logs,
    extract_pod_details
)


def collect_diagnosis(pod_name):
    """Gather all diagnostic signals for a pod."""
    from concurrent.futures import ThreadPoolExecutor

    pod_data = inspect_pod(pod_name)
    if not pod_data:
        return None

    try:
        details = extract_pod_details(pod_data)
    except (KeyError, TypeError, IndexError):
        return None

    with ThreadPoolExecutor(max_workers=2) as ex:
        f_events = ex.submit(pod_events, pod_name)
        f_logs = ex.submit(pod_logs, pod_name, 100)

        events = f_events.result()
        logs = f_logs.result()

    return {
        "details": details,
        "events": events,
        "logs": logs,
        "raw": pod_data,
    }
