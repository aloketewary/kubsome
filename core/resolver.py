import sys
from rapidfuzz import process

from core.k8s import get_pod_names
from core.cache import cached


def _fuzzy_match(query, names):
    """Fuzzy match with score filtering."""
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
    # Fallback: extract from collect_pods cache if available
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