"""
RBAC Viewer — show who has access to what in the namespace.
"""

import subprocess
import json
from concurrent.futures import ThreadPoolExecutor

from core.context import context
from core.cache import cached
from core.k8s import get_raw_resources


@cached(ttl=15)
def list_role_bindings():
    """List RoleBindings and ClusterRoleBindings affecting this namespace."""
    ns = context.namespace
    ctx = context.current_context

    bindings = []

    # Namespace RoleBindings
    # Bolt: Use cached raw fetcher to reduce redundant kubectl calls
    data = get_raw_resources("rolebindings", ctx, ns)
    if data:
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
    # Bolt: Use cached raw fetcher
    data = get_raw_resources("clusterrolebindings", ctx)
    if data:
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

    cmd = [
        "kubectl", "--context", str(ctx or ""),
        "auth", "can-i", verb, resource, "-n", str(ns)
    ]

    r = subprocess.run(
        cmd,
        capture_output=True, text=True
    )

    return "yes" in r.stdout.lower()


def check_permissions(subject, subject_kind="ServiceAccount"):
    """
    Check what a subject can do in the current namespace.
    Returns a permission matrix.
    """
    ns = context.namespace
    ctx = context.current_context

    resources = [
        "pods", "deployments", "services", "secrets",
        "configmaps", "ingresses", "jobs", "cronjobs",
    ]
    verbs = ["get", "list", "create", "delete", "update"]

    def _check(verb, resource):
        cmd = [
            "kubectl", "--context", str(ctx or ""),
            "auth", "can-i", verb, resource,
            f"--as=system:{subject_kind.lower()}:{ns}:{subject}",
            "-n", str(ns)
        ]
        r = subprocess.run(cmd, capture_output=True, text=True)
        return verb, resource, "yes" in r.stdout.lower()

    # Bolt: Parallelize 40+ auth checks to reduce latency from O(N) to O(1)
    results_map = {r: {} for r in resources}
    with ThreadPoolExecutor(max_workers=10) as executor:
        futures = [
            executor.submit(_check, v, r)
            for r in resources for v in verbs
        ]
        for future in futures:
            verb, resource, allowed = future.result()
            results_map[resource][verb] = allowed

    results = [
        {"resource": r, "permissions": results_map[r]}
        for r in resources
    ]

    return {
        "subject": subject,
        "subject_kind": subject_kind,
        "namespace": ns,
        "resources": results,
    }


def list_service_accounts():
    """List service accounts in the namespace."""
    ns = context.namespace
    ctx = context.current_context

    # Bolt: Use cached raw fetcher for consistency and performance
    data = get_raw_resources("serviceaccounts", ctx, ns)
    if not data:
        return []

    return [
        item["metadata"]["name"]
        for item in data.get("items", [])
    ]
