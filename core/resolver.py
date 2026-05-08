from rapidfuzz import process

from core.k8s import get_pods


def resolve_pod_name(query: str):
    pods = get_pods()

    if not pods:
        return None

    names = [pod["name"] for pod in pods]

    matches = process.extract(
        query, names, limit=5
    )

    if not matches:
        return None

    # Strong match — return just that one
    if matches[0][1] > 80:
        return [matches[0][0]]

    return [
        m[0] for m in matches if m[1] > 50
    ] or None


def resolve_deployment_name(query: str):
    """Fuzzy match deployment names."""
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

    matches = process.extract(
        query, names, limit=5
    )

    if not matches:
        return None

    if matches[0][1] > 80:
        return [matches[0][0]]

    return [
        m[0] for m in matches if m[1] > 50
    ] or None


def resolve_cronjob_name(query: str):
    """Fuzzy match cronjob names."""
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

    matches = process.extract(
        query, names, limit=5
    )

    if not matches:
        return None

    if matches[0][1] > 80:
        return [matches[0][0]]

    return [
        m[0] for m in matches if m[1] > 50
    ] or None