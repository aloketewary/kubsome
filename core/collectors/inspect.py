import subprocess
import json
from datetime import datetime, timezone

import humanize

from core.context import context


def inspect_pod(pod_name):
    command = (
        f"kubectl "
        f"--context {context.current_context} "
        f"get pod {pod_name} "
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
        return None

    return json.loads(result.stdout)


def pod_events(pod_name):
    command = (
        f"kubectl "
        f"--context {context.current_context} "
        f"get events "
        f"-n {context.namespace} "
        f"--field-selector involvedObject.name={pod_name} "
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
    for item in data.get("items", []):
        events.append({
            "type": item.get("type", "Normal"),
            "reason": item.get("reason", ""),
            "message": item.get("message", ""),
            "count": item.get("count", 1),
            "last_seen": item.get(
                "lastTimestamp", ""
            )
        })

    return events


def pod_logs(pod_name, tail=50, previous=False):
    cmd = (
        f"kubectl "
        f"--context {context.current_context} "
        f"logs {pod_name} "
        f"-n {context.namespace} "
        f"--tail={tail}"
    )

    if previous:
        cmd += " --previous"

    result = subprocess.run(
        cmd,
        shell=True,
        capture_output=True,
        text=True
    )

    return result.stdout


def extract_pod_details(pod):
    metadata = pod["metadata"]
    spec = pod["spec"]
    status = pod["status"]

    containers = []
    for c in spec.get("containers", []):
        cs = next(
            (s for s in status.get("containerStatuses", [])
             if s["name"] == c["name"]),
            {}
        )

        container = {
            "name": c["name"],
            "image": c.get("image", ""),
            "ready": cs.get("ready", False),
            "restarts": cs.get("restartCount", 0),
            "state": list(cs.get("state", {}).keys())[0] if cs.get("state") else "unknown",
            "ports": [
                f"{p.get('containerPort')}/{p.get('protocol', 'TCP')}"
                for p in c.get("ports", [])
            ],
            "env_count": len(c.get("env", [])) + len(c.get("envFrom", [])),
            "liveness": _probe_summary(c.get("livenessProbe")),
            "readiness": _probe_summary(c.get("readinessProbe")),
            "startup": _probe_summary(c.get("startupProbe")),
            "resources": c.get("resources", {}),
        }
        containers.append(container)

    volumes = [
        v["name"] for v in spec.get("volumes", [])
    ]

    created = metadata.get("creationTimestamp", "")
    age = ""
    if created:
        dt = datetime.fromisoformat(
            created.replace("Z", "+00:00")
        )
        age = humanize.naturaltime(
            datetime.now(timezone.utc) - dt
        )

    return {
        "name": metadata["name"],
        "namespace": metadata["namespace"],
        "node": spec.get("nodeName", "N/A"),
        "pod_ip": status.get("podIP", "N/A"),
        "host_ip": status.get("hostIP", "N/A"),
        "phase": status.get("phase", "Unknown"),
        "age": age,
        "labels": metadata.get("labels", {}),
        "containers": containers,
        "volumes": volumes,
        "restart_policy": spec.get(
            "restartPolicy", "Always"
        ),
        "service_account": spec.get(
            "serviceAccountName", "default"
        ),
    }


def _probe_summary(probe):
    if not probe:
        return None

    if "httpGet" in probe:
        p = probe["httpGet"]
        return (
            f"HTTP {p.get('path', '/')}:"
            f"{p.get('port', '')}"
        )

    if "tcpSocket" in probe:
        return f"TCP :{probe['tcpSocket'].get('port', '')}"

    if "exec" in probe:
        return "exec"

    return "configured"
