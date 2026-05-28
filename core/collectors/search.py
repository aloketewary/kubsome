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
        "Pod", "Deployment", "Service",
        "ConfigMap", "Secret", "Ingress"
    ]
    resource_types = [
        "pods", "deployments", "services",
        "configmaps", "secrets", "ingress"
    ]

    # Bolt: Parallelize name fetching to achieve O(1) latency
    ns = context.namespace
    ctx = context.current_context

    with ThreadPoolExecutor(max_workers=len(resource_types)) as executor:
        futures = {
            executor.submit(_get_names, r, ns, ctx): k
            for r, k in zip(resource_types, kinds)
        }

        for future in futures:
            kind = futures[future]
            names = future.result()
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
def _get_names(resource_type, ns, ctx):
    """Fetch resource names with caching."""
    cmd = ["kubectl"]
    if ctx:
        cmd.extend(["--context", str(ctx)])
    cmd.extend([
        "get", resource_type,
        "-n", str(ns),
        "-o", "jsonpath={.items[*].metadata.name}"
    ])

    result = subprocess.run(
        cmd,
        capture_output=True, text=True
    )

    if result.returncode != 0:
        return []

    names = result.stdout.strip().split()
    return [n for n in names if n]
