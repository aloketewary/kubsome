"""
Rollback Preview — show what will change before
executing a rollback.
"""

import subprocess
import json

from core.context import context


def rollback_preview(deployment_name):
    """
    Compare current revision with previous revision
    to show what a rollback would change.
    """
    ctx = context.current_context
    ns = context.namespace

    current = _get_revision(ctx, ns, deployment_name, 0)
    previous = _get_revision(ctx, ns, deployment_name, 1)

    if not current or not previous:
        return {
            "deployment": deployment_name,
            "available": False,
            "reason": "Cannot fetch revision history",
        }

    diffs = []

    # Compare images
    curr_images = _extract_images(current)
    prev_images = _extract_images(previous)
    for container, image in curr_images.items():
        prev_image = prev_images.get(container, "")
        if image != prev_image:
            diffs.append({
                "field": f"image ({container})",
                "current": image,
                "rollback_to": prev_image,
            })

    # Compare replicas
    curr_replicas = current.get(
        "spec", {}
    ).get("replicas", 0)
    prev_replicas = previous.get(
        "spec", {}
    ).get("replicas", 0)
    if curr_replicas != prev_replicas:
        diffs.append({
            "field": "replicas",
            "current": str(curr_replicas),
            "rollback_to": str(prev_replicas),
        })

    # Compare env vars
    curr_envs = _extract_envs(current)
    prev_envs = _extract_envs(previous)
    added = set(curr_envs.keys()) - set(prev_envs.keys())
    removed = set(prev_envs.keys()) - set(curr_envs.keys())
    changed = {
        k for k in curr_envs.keys() & prev_envs.keys()
        if curr_envs[k] != prev_envs[k]
    }

    for k in added:
        diffs.append({
            "field": f"env.{k}",
            "current": curr_envs[k],
            "rollback_to": "(removed)",
        })
    for k in removed:
        diffs.append({
            "field": f"env.{k}",
            "current": "(not set)",
            "rollback_to": prev_envs[k],
        })
    for k in changed:
        diffs.append({
            "field": f"env.{k}",
            "current": curr_envs[k],
            "rollback_to": prev_envs[k],
        })

    return {
        "deployment": deployment_name,
        "available": True,
        "diffs": diffs,
        "has_changes": len(diffs) > 0,
        "current_revision": current.get(
            "metadata", {}
        ).get("annotations", {}).get(
            "deployment.kubernetes.io/revision", "?"
        ),
    }


def _get_revision(ctx, ns, deployment, offset):
    """Get deployment spec at a revision offset (0=current, 1=previous)."""
    if offset == 0:
        cmd = (
            f"kubectl --context {ctx} "
            f"get deployment {deployment} "
            f"-n {ns} -o json"
        )
    else:
        # Get revision history
        hist_cmd = (
            f"kubectl --context {ctx} "
            f"rollout history deployment/{deployment} "
            f"-n {ns}"
        )
        hist_result = subprocess.run(
            hist_cmd, shell=True,
            capture_output=True, text=True,
            timeout=10,
        )
        if hist_result.returncode != 0:
            return None

        # Parse revision numbers
        lines = hist_result.stdout.strip().split("\n")
        revisions = []
        for line in lines[1:]:
            parts = line.split()
            if parts and parts[0].isdigit():
                revisions.append(int(parts[0]))

        if len(revisions) < 2:
            return None

        prev_rev = revisions[-2]
        cmd = (
            f"kubectl --context {ctx} "
            f"rollout history deployment/{deployment} "
            f"-n {ns} --revision={prev_rev} -o json"
        )

    result = subprocess.run(
        cmd, shell=True,
        capture_output=True, text=True,
        timeout=10,
    )
    if result.returncode != 0:
        return None

    try:
        return json.loads(result.stdout)
    except json.JSONDecodeError:
        return None


def _extract_images(spec):
    """Extract container images from deployment spec."""
    containers = (
        spec.get("spec", {})
        .get("template", {})
        .get("spec", {})
        .get("containers", [])
    )
    return {
        c["name"]: c.get("image", "")
        for c in containers
    }


def _extract_envs(spec):
    """Extract env vars from first container."""
    containers = (
        spec.get("spec", {})
        .get("template", {})
        .get("spec", {})
        .get("containers", [])
    )
    if not containers:
        return {}
    envs = containers[0].get("env", [])
    return {
        e["name"]: e.get("value", "<secret>")
        for e in envs
        if "value" in e
    }
