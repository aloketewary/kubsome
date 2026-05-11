import subprocess
import json

from core.context import context
from core.collectors.inspect import (
    inspect_pod, pod_events, pod_logs,
    extract_pod_details
)


def collect_diagnosis(pod_name):
    """Gather all diagnostic signals for a pod."""

    pod_data = inspect_pod(pod_name)
    if not pod_data:
        return None

    try:
        details = extract_pod_details(pod_data)
    except (KeyError, TypeError, IndexError):
        return None

    events = pod_events(pod_name)
    logs = pod_logs(pod_name, tail=100)

    return {
        "details": details,
        "events": events,
        "logs": logs,
        "raw": pod_data,
    }
