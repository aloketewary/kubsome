"""
Resource Resolver — fuzzy name resolution optimized
for large clusters (1000+ pods).

Strategy:
1. Exact match → instant return
2. Substring filter → narrows to ~5-20 candidates
3. Fuzzy match only on filtered subset (fast)
"""

from rapidfuzz import process

from core.k8s import get_pod_names
from core.cache import cached


MAX_SELECTOR_CHOICES = 8


def _fuzzy_match(query, names):
    """Fuzzy match with score filtering."""
    if not names:
        return None

    # Fast path: exact match
    if query in names:
        return [query]

    # Pre-filter: substring matches (O(n) but fast string ops)
    substr_matches = [
        n for n in names if query in n
    ]

    # If substring gives good results, use those directly
    if len(substr_matches) == 1:
        return substr_matches
    if 1 < len(substr_matches) <= MAX_SELECTOR_CHOICES:
        return substr_matches

    # If too many substring matches, fuzzy-rank them
    if len(substr_matches) > MAX_SELECTOR_CHOICES:
        ranked = process.extract(
            query, substr_matches, limit=MAX_SELECTOR_CHOICES
        )
        return [m[0] for m in ranked if m[1] > 50]

    # No substring matches — fuzzy on full list
    # For large lists, use prefix filter first
    if len(names) > 200:
        # Try prefix match (first N chars)
        prefix = query[:3] if len(query) >= 3 else query
        prefix_matches = [
            n for n in names if n.startswith(prefix)
        ]
        if prefix_matches:
            ranked = process.extract(
                query, prefix_matches, limit=5
            )
            good = [m[0] for m in ranked if m[1] > 60]
            if good:
                return good

    # Final fallback: fuzzy on full list (capped)
    matches = process.extract(query, names, limit=5)
    if not matches:
        return None
    if matches[0][1] > 80:
        return [matches[0][0]]
    return [m[0] for m in matches if m[1] > 50] or None


def _get_pod_names_fast():
    """Get pod names using fastest available source."""
    names = get_pod_names()
    if names:
        return names
    from core.collectors.pods import collect_pods
    pods = collect_pods()
    return [p["name"] for p in pods] if pods else []


def resolve_pod_name(query: str):
    """Resolve a partial pod name. Requires 2+ chars."""
    if len(query) < 2:
        return None
    names = _get_pod_names_fast()
    if not names:
        return None
    return _fuzzy_match(query, names)


@cached(ttl=10)
def resolve_deployment_name(query: str):
    """Fuzzy match deployment names. Requires 2+ chars."""
    if len(query) < 2:
        return None
    import subprocess
    from core.context import context

    cmd = (
        f"kubectl --context {context.current_context} "
        f"get deployments -n {context.namespace} "
        f"-o jsonpath='{{.items[*].metadata.name}}'"
    )

    r = subprocess.run(
        cmd, shell=True,
        capture_output=True, text=True
    )

    names = r.stdout.strip("'").split()
    if not names:
        return None
    return _fuzzy_match(query, names)


@cached(ttl=10)
def resolve_cronjob_name(query: str):
    """Fuzzy match cronjob names. Requires 2+ chars."""
    if len(query) < 2:
        return None
    import subprocess
    from core.context import context

    cmd = (
        f"kubectl --context {context.current_context} "
        f"get cronjobs -n {context.namespace} "
        f"-o jsonpath='{{.items[*].metadata.name}}'"
    )

    r = subprocess.run(
        cmd, shell=True,
        capture_output=True, text=True
    )

    names = r.stdout.strip("'").split()
    if not names:
        return None
    return _fuzzy_match(query, names)
