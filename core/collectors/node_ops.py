"""
Node Operations — cordon, uncordon, drain, and wait commands.
"""

import subprocess
import json

from core.context import context
from core.cache import cached


def cordon_node(node_name):
    """Mark a node as unschedulable."""
    ctx = context.current_context
    cmd = [
        "kubectl", "--context", str(ctx or ""),
        "cordon", node_name
    ]
    r = subprocess.run(cmd, capture_output=True, text=True)
    return {
        "node": node_name,
        "success": r.returncode == 0,
        "message": r.stdout.strip() or r.stderr.strip(),
    }


def uncordon_node(node_name):
    """Mark a node as schedulable."""
    ctx = context.current_context
    cmd = [
        "kubectl", "--context", str(ctx or ""),
        "uncordon", node_name
    ]
    r = subprocess.run(cmd, capture_output=True, text=True)
    return {
        "node": node_name,
        "success": r.returncode == 0,
        "message": r.stdout.strip() or r.stderr.strip(),
    }


def drain_node(node_name, force=False, ignore_daemonsets=True,
               delete_emptydir=False, timeout=300):
    """Drain a node — evict all pods safely."""
    ctx = context.current_context
    cmd = [
        "kubectl", "--context", str(ctx or ""),
        "drain", node_name,
        f"--timeout={timeout}s",
    ]
    if ignore_daemonsets:
        cmd.append("--ignore-daemonsets")
    if force:
        cmd.append("--force")
    if delete_emptydir:
        cmd.append("--delete-emptydir-data")

    r = subprocess.run(cmd, capture_output=True, text=True)
    return {
        "node": node_name,
        "success": r.returncode == 0,
        "message": r.stdout.strip() or r.stderr.strip(),
        "force": force,
    }


def wait_for(resource, name, condition="condition=Ready",
             timeout=120):
    """Wait for a resource to reach a condition."""
    ctx = context.current_context
    ns = context.namespace
    cmd = [
        "kubectl", "--context", str(ctx or ""),
        "wait", f"{resource}/{name}",
        "-n", str(ns),
        f"--for={condition}",
        f"--timeout={timeout}s",
    ]
    r = subprocess.run(cmd, capture_output=True, text=True)
    return {
        "resource": resource,
        "name": name,
        "condition": condition,
        "success": r.returncode == 0,
        "message": r.stdout.strip() or r.stderr.strip(),
    }


@cached(ttl=30)
def list_api_resources():
    """List all API resources available in the cluster."""
    ctx = context.current_context
    cmd = [
        "kubectl", "--context", str(ctx or ""),
        "api-resources", "--verbs=list",
        "-o", "wide"
    ]
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode != 0:
        return []

    lines = r.stdout.strip().split("\n")
    if len(lines) < 2:
        return []

    resources = []
    for line in lines[1:]:
        parts = line.split()
        if len(parts) >= 4:
            resources.append({
                "name": parts[0],
                "shortnames": parts[1] if len(parts) > 4 else "",
                "apiversion": parts[-3] if len(parts) > 4 else parts[-2],
                "namespaced": parts[-2] if len(parts) > 4 else parts[-1],
                "kind": parts[-1],
            })
    return resources
