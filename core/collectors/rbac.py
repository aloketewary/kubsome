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

            for subj in subjects:
                bindings.append({
                    "binding": item["metadata"]["name"],
                    "scope": "Namespace",
                    "role": role.get("name", ""),
                    "role_kind": role.get("kind", ""),
                    "subject": subj.get("name", ""),
                    "subject_kind": subj.get("kind", ""),
                    "namespace": subj.get("namespace", ns),
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

            for subj in subjects:
                if (
                    subj.get("namespace") == ns
                    or subj.get("kind") == "Group"
                ):
                    bindings.append({
                        "binding": item["metadata"]["name"],
                        "scope": "Cluster",
                        "role": role.get("name", ""),
                        "role_kind": role.get("kind", ""),
                        "subject": subj.get("name", ""),
                        "subject_kind": subj.get("kind", ""),
                        "namespace": subj.get("namespace", "*"),
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
