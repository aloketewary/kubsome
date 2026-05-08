"""
Image Pull Secret Diagnostics — checks if referenced secrets exist.
"""

import subprocess
import json

from core.context import context


def check_image_pull_secrets(pod_name=None):
    """
    Check image pull secrets for a specific pod or all pods.
    Returns missing secrets and which pods reference them.
    """
    ctx = context.current_context
    ns = context.namespace

    # Get all secrets of type docker-registry in namespace
    existing_secrets = _get_docker_secrets(ctx, ns)

    # Get pods to check
    if pod_name:
        pods = _get_pod_specs(ctx, ns, pod_name)
    else:
        pods = _get_pod_specs(ctx, ns)

    results = []
    for pod in pods:
        pod_secrets = _extract_pull_secrets(pod)
        for secret_name in pod_secrets:
            exists = secret_name in existing_secrets
            results.append({
                "pod": pod["metadata"]["name"],
                "secret": secret_name,
                "exists": exists,
                "type": existing_secrets.get(secret_name, "MISSING"),
            })

    # Also check service account default pull secrets
    sa_secrets = _get_sa_pull_secrets(ctx, ns, pods)

    missing = [r for r in results if not r["exists"]]
    found = [r for r in results if r["exists"]]

    return {
        "namespace": ns,
        "total_checked": len(results),
        "missing": missing,
        "found": found,
        "service_account_secrets": sa_secrets,
        "existing_docker_secrets": list(existing_secrets.keys()),
    }


def _get_docker_secrets(ctx, ns):
    """Get all secrets that could be used for image pulling."""
    cmd = (
        f"kubectl --context {ctx} get secrets -n {ns} "
        f"-o json"
    )
    result = subprocess.run(cmd, shell=True, capture_output=True, text=True)
    if result.returncode != 0:
        return {}

    data = json.loads(result.stdout)
    secrets = {}
    for item in data.get("items", []):
        name = item["metadata"]["name"]
        stype = item.get("type", "")
        if stype in ("kubernetes.io/dockerconfigjson", "kubernetes.io/dockercfg"):
            secrets[name] = stype
        else:
            # Include all secrets since imagePullSecrets can reference any
            secrets[name] = stype

    return secrets


def _get_pod_specs(ctx, ns, pod_name=None):
    """Get pod specs."""
    if pod_name:
        cmd = (
            f"kubectl --context {ctx} get pod {pod_name} "
            f"-n {ns} -o json"
        )
        result = subprocess.run(cmd, shell=True, capture_output=True, text=True)
        if result.returncode != 0:
            return []
        return [json.loads(result.stdout)]
    else:
        cmd = (
            f"kubectl --context {ctx} get pods "
            f"-n {ns} -o json"
        )
        result = subprocess.run(cmd, shell=True, capture_output=True, text=True)
        if result.returncode != 0:
            return []
        return json.loads(result.stdout).get("items", [])


def _extract_pull_secrets(pod):
    """Extract imagePullSecrets from pod spec."""
    spec = pod.get("spec", {})
    pull_secrets = spec.get("imagePullSecrets", [])
    return [s.get("name", "") for s in pull_secrets if s.get("name")]


def _get_sa_pull_secrets(ctx, ns, pods):
    """Check service account imagePullSecrets."""
    sa_names = set()
    for pod in pods:
        sa = pod.get("spec", {}).get("serviceAccountName", "default")
        sa_names.add(sa)

    sa_secrets = {}
    for sa_name in sa_names:
        cmd = (
            f"kubectl --context {ctx} get serviceaccount {sa_name} "
            f"-n {ns} -o json"
        )
        result = subprocess.run(cmd, shell=True, capture_output=True, text=True)
        if result.returncode != 0:
            continue
        sa_data = json.loads(result.stdout)
        pull_secrets = sa_data.get("imagePullSecrets", [])
        sa_secrets[sa_name] = [s.get("name", "") for s in pull_secrets if s.get("name")]

    return sa_secrets
