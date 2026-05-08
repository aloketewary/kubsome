from rapidfuzz import process

from core.k8s import get_pods


def resolve_pod_name(query: str):
    pods = get_pods()

    if not pods:
        return None

    names = [pod["name"] for pod in pods]

    matches = process.extract(
        query,
        names,
        limit=5
    )

    filtered = [
        match[0]
        for match in matches
        if match[1] > 50
    ]

    return filtered


def resolve_deployment_name(query: str):
    """Fuzzy match deployment names."""
    import subprocess
    import json
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

    matches = process.extract(
        query, names, limit=5
    )

    filtered = [
        match[0]
        for match in matches
        if match[1] > 50
    ]

    return filtered


def resolve_cronjob_name(query: str):
    """Fuzzy match cronjob names."""
    import subprocess
    import json
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

    matches = process.extract(
        query, names, limit=5
    )

    filtered = [
        match[0]
        for match in matches
        if match[1] > 50
    ]

    return filtered