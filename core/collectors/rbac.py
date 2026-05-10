"""
RBAC Viewer — show who has access to what in the namespace.
"""

import subprocess
import json

from core.context import context


def list_role_bindings():
    """List RoleBindings and ClusterRoleBindings affecting this namespace."""
    ns = context.namespace
    ctx = context.current_context

    bindings = []

    # Namespace RoleBindings
    cmd = (
        f"kubectl --context {ctx} "
        f"get rolebindings -n {ns} -o json"
    )
    r = subprocess.run(
        cmd, shell=True,
        capture_output=True, text=True
    )

    if r.returncode == 0:
        data = json.loads(r.stdout)
        for item in data.get("items", []):
            subjects = item.get("subjects", [])
            role = item.get("roleRef", {})
            subj_str = ", ".join(
                f"{s.get('kind', '')}:{s.get('name', '')}"
                for s in subjects
            )
            bindings.append({
                "name": item["metadata"]["name"],
                "kind": "RoleBinding",
                "role": role.get("name", ""),
                "role_kind": role.get("kind", ""),
                "subjects": subj_str,
                "namespace": ns,
            })

    # ClusterRoleBindings (that reference this namespace's SAs)
    cmd2 = (
        f"kubectl --context {ctx} "
        f"get clusterrolebindings -o json"
    )
    r2 = subprocess.run(
        cmd2, shell=True,
        capture_output=True, text=True
    )

    if r2.returncode == 0:
        data = json.loads(r2.stdout)
        for item in data.get("items", []):
            subjects = item.get("subjects", [])
            role = item.get("roleRef", {})

            relevant = [
                s for s in subjects
                if s.get("namespace") == ns
                or s.get("kind") == "Group"
            ]
            if not relevant:
                continue

            subj_str = ", ".join(
                f"{s.get('kind', '')}:{s.get('name', '')}"
                for s in relevant
            )
            bindings.append({
                "name": item["metadata"]["name"],
                "kind": "ClusterRoleBinding",
                "role": role.get("name", ""),
                "role_kind": role.get("kind", ""),
                "subjects": subj_str,
                "namespace": "*",
            })

    return bindings


def can_i(verb, resource):
    """Check if current user can perform an action."""
    ns = context.namespace
    ctx = context.current_context

    cmd = (
        f"kubectl --context {ctx} "
        f"auth can-i {verb} {resource} -n {ns}"
    )

    r = subprocess.run(
        cmd, shell=True,
        capture_output=True, text=True
    )

    return "yes" in r.stdout.lower()
