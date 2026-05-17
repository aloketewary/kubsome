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
    cmd = [
        "kubectl", "--context", str(ctx or ""),
        "get", rtype, "-n", str(ns), "--no-headers"
    ]

    result = subprocess.run(
        cmd,
        capture_output=True, text=True
    )

    return len([l for l in result.stdout.strip().splitlines() if l])


def _pod_status_breakdown(ns, ctx):
    cmd = [
        "kubectl", "--context", str(ctx or ""),
        "get", "pods", "-n", str(ns), "-o", "json"
    ]

    result = subprocess.run(
        cmd,
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
