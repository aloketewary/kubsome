import subprocess
import json

from core.context import context


def namespace_summary():
    """Get resource counts for current namespace."""
    ns = context.namespace
    ctx = context.current_context

    resources = {}

    types = [
        "pods", "deployments", "services",
        "configmaps", "secrets", "ingress",
        "jobs", "cronjobs", "statefulsets",
        "daemonsets"
    ]

    for rtype in types:
        count = _count_resource(rtype, ns, ctx)
        if count > 0:
            resources[rtype] = count

    # Pod status breakdown
    pod_statuses = _pod_status_breakdown(ns, ctx)

    return {
        "namespace": ns,
        "context": ctx,
        "resources": resources,
        "pod_statuses": pod_statuses,
    }


def _count_resource(rtype, ns, ctx):
    cmd = (
        f"kubectl --context {ctx} "
        f"get {rtype} -n {ns} "
        f"--no-headers 2>/dev/null | wc -l"
    )

    result = subprocess.run(
        cmd, shell=True,
        capture_output=True, text=True
    )

    try:
        return int(result.stdout.strip())
    except ValueError:
        return 0


def _pod_status_breakdown(ns, ctx):
    cmd = (
        f"kubectl --context {ctx} "
        f"get pods -n {ns} -o json"
    )

    result = subprocess.run(
        cmd, shell=True,
        capture_output=True, text=True
    )

    if result.returncode != 0:
        return {}

    data = json.loads(result.stdout)
    statuses = {}

    for item in data.get("items", []):
        phase = item["status"].get("phase", "Unknown")
        statuses[phase] = statuses.get(phase, 0) + 1

    return statuses
