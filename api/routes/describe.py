"""
Describe API — kubectl describe with fuzzy resolution.
"""

import subprocess
import json

from fastapi import APIRouter, HTTPException

from core.context import context
from core.resolver import (
    resolve_pod_name, resolve_deployment_name
)

router = APIRouter(tags=["describe"])


@router.get("/describe/{resource}/{name}")
def describe_resource(resource: str, name: str):
    """Describe a resource with fuzzy name matching."""
    resolved = _fuzzy_resolve(resource, name)

    args = [
        "kubectl", "--context", context.current_context,
        "describe", resource, resolved, "-n", context.namespace
    ]

    # Cluster-scoped resources
    cluster_scoped = {"node", "nodes", "namespace", "namespaces"}
    if resource in cluster_scoped:
        args = [
            "kubectl", "--context", context.current_context,
            "describe", resource, resolved
        ]

    result = subprocess.run(
        args,
        capture_output=True, text=True,
        timeout=15,
    )

    if result.returncode != 0:
        raise HTTPException(
            status_code=404,
            detail=result.stderr.strip(),
        )

    raw = result.stdout.strip()
    parsed = _parse_describe(raw)

    return {
        "context": context.current_context,
        "namespace": context.namespace,
        "resource": resource,
        "name": resolved,
        "raw": raw,
        "parsed": parsed,
    }


@router.get("/get/{resource}")
def get_resource(resource: str, name: str = ""):
    """Get resources with optional fuzzy name."""
    resolved = ""
    if name:
        resolved = _fuzzy_resolve(resource, name)

    args = [
        "kubectl", "--context", context.current_context,
        "get", resource
    ]
    if resolved:
        args.append(resolved)

    cluster_scoped = {
        "node", "nodes", "namespace", "namespaces",
        "pv", "persistentvolumes",
    }
    if resource not in cluster_scoped:
        args.extend(["-n", context.namespace])

    args.extend(["-o", "json"])

    result = subprocess.run(
        args,
        capture_output=True, text=True,
        timeout=15,
    )

    if result.returncode != 0:
        raise HTTPException(
            status_code=404,
            detail=result.stderr.strip(),
        )

    data = json.loads(result.stdout)
    return {
        "context": context.current_context,
        "namespace": context.namespace,
        "resource": resource,
        "data": data,
    }


@router.delete("/resource/{resource}/{name}")
def delete_resource(resource: str, name: str):
    """Delete a resource with fuzzy name matching."""
    resolved = _fuzzy_resolve(resource, name)

    args = [
        "kubectl", "--context", context.current_context,
        "delete", resource, resolved, "-n", context.namespace
    ]

    result = subprocess.run(
        args,
        capture_output=True, text=True,
        timeout=30,
    )

    if result.returncode != 0:
        raise HTTPException(
            status_code=500,
            detail=result.stderr.strip(),
        )

    return {"deleted": resolved, "resource": resource}


def _fuzzy_resolve(resource: str, name: str) -> str:
    """Fuzzy resolve name based on resource type."""
    pod_types = {"pod", "pods", "po"}
    deploy_types = {"deployment", "deployments", "deploy"}

    if resource in pod_types:
        matches = resolve_pod_name(name)
        if matches and len(matches) == 1:
            return matches[0]
        if matches:
            return matches[0]

    if resource in deploy_types:
        matches = resolve_deployment_name(name)
        if matches and len(matches) == 1:
            return matches[0]
        if matches:
            return matches[0]

    return name


def _parse_describe(raw: str) -> dict:
    """Parse describe output into structured sections."""
    sections = {}
    current_key = None

    for line in raw.split("\n"):
        if not line.strip():
            continue
        if not line.startswith(" ") and ":" in line:
            key, _, val = line.partition(":")
            key = key.strip()
            val = val.strip()
            sections[key] = val
            current_key = key
        elif current_key and line.startswith(" "):
            existing = sections.get(current_key, "")
            sections[current_key] = (
                existing + "\n" + line.rstrip()
                if existing else line.rstrip()
            )

    return sections
