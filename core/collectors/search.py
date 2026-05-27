import subprocess
import json
from concurrent.futures import ThreadPoolExecutor

from rapidfuzz import process

from core.context import context
from core.cache import cached


def search_resources(query):
    """
    Fuzzy search across pods, deployments, services,
    configmaps in the current namespace.
    """
    results = []

    kinds = [
        ("Pod", "pods"),
        ("Deployment", "deployments"),
        ("Service", "services"),
        ("ConfigMap", "configmaps"),
        ("Secret", "secrets"),
        ("Ingress", "ingress"),
    ]

    # Bolt: fetch all resource names in parallel to reduce sequential I/O latency
    # Pass ctx and ns as arguments to ensure they are part of the cache key
    ctx = context.current_context
    ns = context.namespace

    with ThreadPoolExecutor(max_workers=len(kinds)) as executor:
        futures = {
            executor.submit(_get_names, r_type, ctx, ns): kind
            for kind, r_type in kinds
        }

        resources = []
        for future in futures:
            kind = futures[future]
            names = future.result()
            resources.append((kind, names))

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


@cached(ttl=60)
def _get_names(resource_type, ctx, ns):
    cmd = [
        "kubectl", "--context", str(ctx or ""),
        "get", resource_type,
        "-n", str(ns),
        "-o", "jsonpath={.items[*].metadata.name}"
    ]

    result = subprocess.run(
        cmd,
        capture_output=True, text=True
    )

    if result.returncode != 0:
        return []

    names = result.stdout.strip().split()
    return [n for n in names if n]
