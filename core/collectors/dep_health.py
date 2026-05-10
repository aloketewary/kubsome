"""
Dependency Health Map — resolve service dependencies
and show health status of each node in the chain.
"""

import subprocess
import json

from core.context import context
from core.collectors.pods import collect_pods


def dependency_health(deployment_name):
    """
    Build a dependency map for a deployment showing
    health of connected services.
    """
    ctx = context.current_context
    ns = context.namespace

    # Get the deployment's pods and their env vars
    # to discover service dependencies
    deps = _discover_dependencies(
        ctx, ns, deployment_name
    )

    # Check health of each dependency
    nodes = []
    pods = collect_pods()

    # Add the target itself
    target_pods = [
        p for p in pods
        if deployment_name in p["name"]
    ]
    target_healthy = all(
        p["status"] == "Running" and p["restarts"] < 5
        for p in target_pods
    )
    nodes.append({
        "name": deployment_name,
        "type": "target",
        "healthy": target_healthy,
        "pod_count": len(target_pods),
        "status": "healthy" if target_healthy else "unhealthy",
        "detail": (
            f"{len(target_pods)} pods running"
            if target_healthy
            else _get_issue(target_pods)
        ),
    })

    # Check each dependency
    for dep in deps:
        dep_pods = [
            p for p in pods
            if dep["name"] in p["name"]
        ]
        if dep_pods:
            healthy = all(
                p["status"] == "Running"
                and p["restarts"] < 5
                for p in dep_pods
            )
            nodes.append({
                "name": dep["name"],
                "type": dep["type"],
                "healthy": healthy,
                "pod_count": len(dep_pods),
                "status": "healthy" if healthy else "unhealthy",
                "detail": (
                    f"{len(dep_pods)} pods"
                    if healthy
                    else _get_issue(dep_pods)
                ),
            })
        else:
            # Check if it's a service
            svc_exists = _check_service(
                ctx, ns, dep["name"]
            )
            nodes.append({
                "name": dep["name"],
                "type": dep["type"],
                "healthy": svc_exists,
                "pod_count": 0,
                "status": (
                    "external" if svc_exists
                    else "missing"
                ),
                "detail": (
                    "Service exists"
                    if svc_exists
                    else "Not found in namespace"
                ),
            })

    # Find likely root cause
    unhealthy = [
        n for n in nodes
        if not n["healthy"] and n["type"] != "target"
    ]
    root_cause = None
    if unhealthy:
        root_cause = {
            "name": unhealthy[0]["name"],
            "detail": unhealthy[0]["detail"],
            "suggestion": (
                f"Investigate {unhealthy[0]['name']} — "
                f"likely causing issues in "
                f"{deployment_name}"
            ),
        }

    return {
        "target": deployment_name,
        "nodes": nodes,
        "root_cause": root_cause,
        "total_deps": len(deps),
    }


def _discover_dependencies(ctx, ns, deployment):
    """Discover dependencies from env vars and service refs."""
    cmd = (
        f"kubectl --context {ctx} "
        f"get deployment {deployment} -n {ns} "
        f"-o json"
    )
    result = subprocess.run(
        cmd, shell=True,
        capture_output=True, text=True,
        timeout=10,
    )
    if result.returncode != 0:
        return []

    data = json.loads(result.stdout)
    containers = (
        data.get("spec", {})
        .get("template", {})
        .get("spec", {})
        .get("containers", [])
    )

    deps = []
    seen = set()

    for container in containers:
        envs = container.get("env", [])
        for env in envs:
            val = env.get("value", "")
            # Detect service references in env vars
            # Pattern: http://service-name:port or service-name.namespace
            if "://" in val:
                parts = val.split("://")[1].split(":")[0].split(".")[0]
                if parts and parts not in seen:
                    seen.add(parts)
                    deps.append({
                        "name": parts,
                        "type": "service",
                    })
            # Secret references
            secret_ref = (
                env.get("valueFrom", {})
                .get("secretKeyRef", {})
                .get("name")
            )
            if secret_ref and secret_ref not in seen:
                seen.add(secret_ref)
                deps.append({
                    "name": secret_ref,
                    "type": "secret",
                })

    return deps


def _check_service(ctx, ns, name):
    """Check if a service exists."""
    cmd = (
        f"kubectl --context {ctx} "
        f"get svc {name} -n {ns} "
        f"--no-headers 2>/dev/null"
    )
    result = subprocess.run(
        cmd, shell=True,
        capture_output=True, text=True,
        timeout=5,
    )
    return result.returncode == 0


def _get_issue(pods):
    """Get the primary issue from a list of pods."""
    for p in pods:
        if p["status"] != "Running":
            return f"{p['status']}"
        if p["restarts"] >= 5:
            return f"{p['restarts']} restarts"
    return "unknown issue"
