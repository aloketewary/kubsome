"""
Helm Lifecycle — list releases, status, history, values,
and intelligent rollback with blast-radius awareness.
"""

import json
import subprocess

from core.context import context


def helm_list(namespace=None, all_namespaces=False):
    """List Helm releases."""
    ns = namespace or context.namespace
    cmd = ["helm", "list", "-o", "json"]
    if all_namespaces:
        cmd.append("--all-namespaces")
    else:
        cmd.extend(["-n", str(ns)])

    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode != 0:
        return {"error": r.stderr.strip(), "releases": []}

    releases = json.loads(r.stdout) if r.stdout.strip() else []
    return {
        "releases": [
            {
                "name": rel.get("name", ""),
                "namespace": rel.get("namespace", ""),
                "revision": rel.get("revision", ""),
                "status": rel.get("status", ""),
                "chart": rel.get("chart", ""),
                "app_version": rel.get("app_version", ""),
                "updated": rel.get("updated", ""),
            }
            for rel in releases
        ]
    }


def helm_status(release, namespace=None):
    """Get detailed status of a release."""
    ns = namespace or context.namespace
    cmd = [
        "helm", "status", release, "-n", str(ns), "-o", "json"
    ]
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode != 0:
        return {"error": r.stderr.strip()}

    data = json.loads(r.stdout)
    info = data.get("info", {})

    return {
        "name": data.get("name", release),
        "namespace": ns,
        "version": data.get("version", 0),
        "status": info.get("status", ""),
        "description": info.get("description", ""),
        "first_deployed": info.get("first_deployed", ""),
        "last_deployed": info.get("last_deployed", ""),
        "notes": info.get("notes", ""),
    }


def helm_history(release, namespace=None):
    """Get revision history of a release."""
    ns = namespace or context.namespace
    cmd = [
        "helm", "history", release, "-n", str(ns), "-o", "json"
    ]
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode != 0:
        return {"error": r.stderr.strip(), "revisions": []}

    revisions = json.loads(r.stdout) if r.stdout.strip() else []
    return {
        "release": release,
        "revisions": [
            {
                "revision": rev.get("revision", 0),
                "status": rev.get("status", ""),
                "chart": rev.get("chart", ""),
                "app_version": rev.get("app_version", ""),
                "description": rev.get("description", ""),
                "updated": rev.get("updated", ""),
            }
            for rev in revisions
        ],
    }


def helm_values(release, namespace=None, revision=None):
    """Get computed values for a release."""
    ns = namespace or context.namespace
    cmd = ["helm", "get", "values", release, "-n", str(ns), "-o", "json"]
    if revision:
        cmd.extend(["--revision", str(revision)])

    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode != 0:
        return {"error": r.stderr.strip()}

    try:
        values = json.loads(r.stdout) if r.stdout.strip() else {}
    except json.JSONDecodeError:
        values = {}

    return {"release": release, "values": values}


def helm_rollback(release, revision=None, namespace=None):
    """
    Rollback a release. If no revision, rolls back to previous.
    Returns {success, message}.
    """
    ns = namespace or context.namespace
    cmd = ["helm", "rollback", release]
    if revision:
        cmd.append(str(revision))
    cmd.extend(["-n", str(ns)])

    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode != 0:
        return {"success": False, "message": r.stderr.strip()}

    return {
        "success": True,
        "message": r.stdout.strip() or f"Rolled back {release}",
    }


def helm_diff(release, namespace=None):
    """
    Show what changed between current and previous revision.
    Compares values of revision N vs N-1.
    """
    ns = namespace or context.namespace

    # Get current revision
    status = helm_status(release, ns)
    if "error" in status:
        return status

    current_rev = status.get("version", 0)
    if current_rev < 2:
        return {"changes": [], "message": "Only 1 revision, nothing to diff"}

    # Get values for current and previous
    current_vals = helm_values(release, ns, current_rev)
    prev_vals = helm_values(release, ns, current_rev - 1)

    if "error" in current_vals or "error" in prev_vals:
        return {"changes": [], "message": "Cannot fetch values for diff"}

    # Diff the values
    changes = _diff_values(
        prev_vals.get("values", {}),
        current_vals.get("values", {}),
    )

    return {
        "release": release,
        "current_revision": current_rev,
        "previous_revision": current_rev - 1,
        "changes": changes,
        "change_count": len(changes),
    }


def _diff_values(old, new, prefix=""):
    """Recursively diff two value dicts."""
    changes = []

    all_keys = set(list(old.keys()) + list(new.keys()))
    for key in sorted(all_keys):
        path = f"{prefix}.{key}" if prefix else key
        old_val = old.get(key)
        new_val = new.get(key)

        if old_val == new_val:
            continue

        if isinstance(old_val, dict) and isinstance(new_val, dict):
            changes.extend(_diff_values(old_val, new_val, path))
        elif old_val is None:
            changes.append({
                "path": path, "type": "added",
                "old": None, "new": str(new_val)[:100],
            })
        elif new_val is None:
            changes.append({
                "path": path, "type": "removed",
                "old": str(old_val)[:100], "new": None,
            })
        else:
            changes.append({
                "path": path, "type": "changed",
                "old": str(old_val)[:100], "new": str(new_val)[:100],
            })

    return changes
