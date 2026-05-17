"""
Deployment Diff — compare current vs previous revision
to show what changed in the last rollout.
"""

import subprocess
import json

from core.context import context


def deployment_diff(name):
    """Get diff between current and previous revision."""
    ns = context.namespace
    ctx = context.current_context

    # Get current revision
    current = _get_revision(name, ns, ctx, 0)

    # Get previous revision number
    history_cmd = [
        "kubectl", "--context", str(ctx or ""),
        "rollout", "history",
        f"deployment/{name}",
        "-n", str(ns)
    ]

    r = subprocess.run(
        history_cmd,
        capture_output=True, text=True
    )

    if r.returncode != 0 or not current:
        return None

    # Parse revision numbers
    lines = r.stdout.strip().split("\n")
    revisions = []
    for line in lines[1:]:
        parts = line.split()
        if parts and parts[0].isdigit():
            revisions.append(int(parts[0]))

    if len(revisions) < 2:
        return {
            "name": name,
            "changes": [],
            "message": "Only one revision exists",
        }

    prev_rev = revisions[-2]
    curr_rev = revisions[-1]

    # Get previous revision spec
    previous = _get_revision_spec(
        name, ns, ctx, prev_rev
    )

    if not previous:
        return {
            "name": name,
            "changes": [],
            "message": "Could not fetch previous revision",
        }

    # Compare
    changes = _compare(current, previous)

    return {
        "name": name,
        "current_revision": curr_rev,
        "previous_revision": prev_rev,
        "changes": changes,
    }


def _get_revision(name, ns, ctx, rev):
    """Get current deployment spec."""
    cmd = [
        "kubectl", "--context", str(ctx or ""),
        "get", "deployment", name, "-n", str(ns), "-o", "json"
    ]

    r = subprocess.run(
        cmd,
        capture_output=True, text=True
    )

    if r.returncode != 0:
        return None

    return json.loads(r.stdout)


def _get_revision_spec(name, ns, ctx, rev):
    """Get a specific revision's replicaset."""
    cmd = [
        "kubectl", "--context", str(ctx or ""),
        "get", "replicasets", "-n", str(ns), "-o", "json",
        "-l", f"app={name}"
    ]

    r = subprocess.run(
        cmd,
        capture_output=True, text=True
    )

    if r.returncode != 0:
        return None

    data = json.loads(r.stdout)

    for item in data.get("items", []):
        annotations = item["metadata"].get(
            "annotations", {}
        )
        rs_rev = annotations.get(
            "deployment.kubernetes.io/revision", ""
        )
        if str(rs_rev) == str(rev):
            return item

    return None


def _compare(current, previous):
    """Compare two deployment specs and return changes."""
    changes = []

    # Compare images
    curr_containers = current["spec"].get(
        "template", {}
    ).get("spec", {}).get("containers", [])

    prev_containers = previous["spec"].get(
        "template", {}
    ).get("spec", {}).get("containers", [])

    for i, cc in enumerate(curr_containers):
        pc = prev_containers[i] if i < len(prev_containers) else {}

        if cc.get("image") != pc.get("image"):
            changes.append({
                "field": f"image ({cc['name']})",
                "old": pc.get("image", "N/A"),
                "new": cc.get("image", "N/A"),
            })

        # Compare env vars count
        curr_env = len(cc.get("env", []))
        prev_env = len(pc.get("env", []))
        if curr_env != prev_env:
            changes.append({
                "field": f"env vars ({cc['name']})",
                "old": str(prev_env),
                "new": str(curr_env),
            })

        # Compare resources
        curr_res = cc.get("resources", {})
        prev_res = pc.get("resources", {})
        if curr_res != prev_res:
            changes.append({
                "field": f"resources ({cc['name']})",
                "old": str(prev_res.get("limits", {})),
                "new": str(curr_res.get("limits", {})),
            })

    # Compare replicas
    curr_replicas = current["spec"].get("replicas", 0)
    prev_replicas = previous["spec"].get("replicas", 0)
    if curr_replicas != prev_replicas:
        changes.append({
            "field": "replicas",
            "old": str(prev_replicas),
            "new": str(curr_replicas),
        })

    return changes
