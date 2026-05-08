import subprocess
import json

from rapidfuzz import process

from core.context import context


def search_resources(query):
    """
    Fuzzy search across pods, deployments, services,
    configmaps in the current namespace.
    """
    results = []

    resources = [
        ("Pod", _get_names("pods")),
        ("Deployment", _get_names("deployments")),
        ("Service", _get_names("services")),
        ("ConfigMap", _get_names("configmaps")),
        ("Secret", _get_names("secrets")),
        ("Ingress", _get_names("ingress")),
    ]

    for kind, names in resources:
        if not names:
            continue

        matches = process.extract(
            query, names, limit=3
        )

        for match in matches:
            if match[1] > 40:
                results.append({
                    "kind": kind,
                    "name": match[0],
                    "score": match[1],
                })

    # Sort by score
    results.sort(
        key=lambda x: x["score"], reverse=True
    )

    return results[:10]


def _get_names(resource_type):
    cmd = (
        f"kubectl --context {context.current_context} "
        f"get {resource_type} "
        f"-n {context.namespace} "
        f"-o jsonpath='{{.items[*].metadata.name}}'"
    )

    result = subprocess.run(
        cmd, shell=True,
        capture_output=True, text=True
    )

    if result.returncode != 0:
        return []

    names = result.stdout.strip("'").split()
    return [n for n in names if n]
