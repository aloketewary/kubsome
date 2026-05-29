"""
Resource Operations — patch, annotate, and set-image commands.
"""

import subprocess
import json

from core.context import context


def patch_resource(resource, name, patch_data, patch_type="strategic"):
    """Apply a JSON patch to a resource."""
    ctx = context.current_context
    ns = context.namespace

    type_flag = {
        "strategic": "strategic",
        "merge": "merge",
        "json": "json",
    }.get(patch_type, "strategic")

    cmd = [
        "kubectl", "--context", str(ctx or ""),
        "patch", resource, name,
        "-n", str(ns),
        "--type", type_flag,
        "-p", json.dumps(patch_data),
    ]
    r = subprocess.run(cmd, capture_output=True, text=True)
    return {
        "resource": resource,
        "name": name,
        "patch_type": type_flag,
        "success": r.returncode == 0,
        "message": r.stdout.strip() or r.stderr.strip(),
    }


def annotate_resource(resource, name, annotations, remove=False):
    """Add or remove annotations on a resource."""
    ctx = context.current_context
    ns = context.namespace

    cmd = [
        "kubectl", "--context", str(ctx or ""),
        "annotate", resource, name,
        "-n", str(ns),
        "--overwrite",
    ]

    if remove:
        cmd.extend([f"{k}-" for k in annotations])
    else:
        cmd.extend([f"{k}={v}" for k, v in annotations.items()])

    r = subprocess.run(cmd, capture_output=True, text=True)
    return {
        "resource": resource,
        "name": name,
        "annotations": annotations,
        "removed": remove,
        "success": r.returncode == 0,
        "message": r.stdout.strip() or r.stderr.strip(),
    }


def set_image(deployment, container, image):
    """Update container image on a deployment."""
    ctx = context.current_context
    ns = context.namespace

    cmd = [
        "kubectl", "--context", str(ctx or ""),
        "set", "image",
        f"deployment/{deployment}",
        f"{container}={image}",
        "-n", str(ns),
    ]
    r = subprocess.run(cmd, capture_output=True, text=True)
    return {
        "deployment": deployment,
        "container": container,
        "image": image,
        "success": r.returncode == 0,
        "message": r.stdout.strip() or r.stderr.strip(),
    }
