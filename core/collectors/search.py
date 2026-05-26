import subprocess
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

    resource_types = [
        ("Pod", "pods"),
        ("Deployment", "deployments"),
        ("Service", "services"),
        ("ConfigMap", "configmaps"),
        ("Secret", "secrets"),
        ("Ingress", "ingress"),
    ]

    # Bolt: O(N) -> O(1) latency relative to resource types by parallelizing name fetching
    with ThreadPoolExecutor(max_workers=len(resource_types)) as executor:
        futures = {
            executor.submit(_get_names, r_type, context.current_context, context.namespace): kind
            for kind, r_type in resource_types
        }

        for future in futures:
            kind = futures[future]
            try:
                names = future.result()
                if not names:
                    continue

                matches = process.extract(
                    query, names, limit=3
                )

                for match in matches:
                    # Result format: (string, score, index)
                    if match[1] > 40:
                        results.append({
                            "kind": kind,
                            "name": match[0],
                            "score": match[1],
                        })
            except Exception:
                continue

    # Sort by score
    results.sort(
        key=lambda x: x["score"], reverse=True
    )

    return results[:10]


@cached(ttl=60)
def _get_names(resource_type, ctx, ns):
    """
    Fetch names for a resource type using jsonpath.
    Cached for 60s to avoid redundant shell-outs.
    """
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
