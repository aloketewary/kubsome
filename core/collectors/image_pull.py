"""
Image Pull Secret Diagnostics — checks if referenced secrets exist.
"""

from core.context import context
from core.k8s import get_raw_resources


def check_image_pull_secrets(pod_name=None):
    """
    Check image pull secrets for a specific pod or all pods.
    Returns missing secrets with full context: which images need them,
    which registry they're for, and which service account is involved.
    """
    ctx = context.current_context
    ns = context.namespace

    # Get all secrets in namespace
    existing_secrets = _get_all_secrets(ctx, ns)

    # Get pods to check
    if pod_name:
        pods = _get_pod_specs(ctx, ns, pod_name)
    else:
        pods = _get_pod_specs(ctx, ns)

    results = []
    for pod in pods:
        spec = pod.get("spec", {})
        pod_secrets = _extract_pull_secrets(pod)
        images = [c.get("image", "") for c in spec.get("containers", [])]
        registries = list(set(_extract_registry(img) for img in images))
        sa_name = spec.get("serviceAccountName", "default")

        for secret_name in pod_secrets:
            exists = secret_name in existing_secrets
            secret_type = existing_secrets.get(secret_name, {}).get("type", "MISSING")
            # If secret exists and is docker type, extract which registry it's for
            registry_in_secret = None
            if exists and secret_type in ("kubernetes.io/dockerconfigjson", "kubernetes.io/dockercfg"):
                registry_in_secret = existing_secrets[secret_name].get("registry")

            results.append({
                "pod": pod["metadata"]["name"],
                "secret": secret_name,
                "exists": exists,
                "secret_type": secret_type,
                "images": images,
                "registries_needed": registries,
                "registry_in_secret": registry_in_secret,
                "service_account": sa_name,
            })

    # Service account pull secrets
    sa_secrets = _get_sa_pull_secrets(ctx, ns, pods)

    missing = [r for r in results if not r["exists"]]
    found = [r for r in results if r["exists"]]

    return {
        "namespace": ns,
        "total_checked": len(results),
        "missing": missing,
        "found": found,
        "service_account_secrets": sa_secrets,
        "existing_docker_secrets": [
            k for k, v in existing_secrets.items()
            if v.get("type") in ("kubernetes.io/dockerconfigjson", "kubernetes.io/dockercfg")
        ],
    }


def _get_all_secrets(ctx, ns):
    """Get all secrets with type and registry info."""
    # Bolt: Use cached raw fetcher to reduce redundant I/O and shell overhead
    data = get_raw_resources("secrets", ctx, ns)
    if not data:
        return {}

    import base64
    secrets = {}
    for item in data.get("items", []):
        name = item["metadata"]["name"]
        stype = item.get("type", "")
        registry = None

        # Try to extract registry URL from docker secrets
        if stype == "kubernetes.io/dockerconfigjson":
            try:
                raw = item.get("data", {}).get(".dockerconfigjson", "")
                decoded = json.loads(base64.b64decode(raw))
                auths = decoded.get("auths", {})
                registry = ", ".join(auths.keys()) if auths else None
            except Exception:
                pass
        elif stype == "kubernetes.io/dockercfg":
            try:
                raw = item.get("data", {}).get(".dockercfg", "")
                decoded = json.loads(base64.b64decode(raw))
                registry = ", ".join(decoded.keys()) if decoded else None
            except Exception:
                pass

        secrets[name] = {"type": stype, "registry": registry}

    return secrets


def _extract_registry(image):
    """Extract registry hostname from image string."""
    # image format: registry/path:tag or just name:tag
    if "/" not in image:
        return "docker.io"
    parts = image.split("/")
    if "." in parts[0] or ":" in parts[0]:
        return parts[0]
    return "docker.io"


def _get_pod_specs(ctx, ns, pod_name=None):
    """Get pod specs."""
    # Bolt: Use cached raw fetcher
    if pod_name:
        # For a single pod, we don't have a specific cached helper in get_raw_resources
        # that takes a name, but get_raw_resources can handle filtering if we were to add it.
        # However, for consistency and caching of the whole namespace, we can fetch all or use it as is.
        # Let's use get_raw_resources for all pods if pod_name is None,
        # and for single pod, we can just filter the list from get_raw_resources if it's not too large,
        # or just keep it as a direct call but maybe it's better to standardize.
        data = get_raw_resources("pods", ctx, ns)
        items = data.get("items", [])
        return [p for p in items if p["metadata"]["name"] == pod_name]
    else:
        data = get_raw_resources("pods", ctx, ns)
        return data.get("items", [])


def _extract_pull_secrets(pod):
    """Extract imagePullSecrets from pod spec."""
    spec = pod.get("spec", {})
    pull_secrets = spec.get("imagePullSecrets", [])
    return [s.get("name", "") for s in pull_secrets if s.get("name")]


def _get_sa_pull_secrets(ctx, ns, pods):
    """Check service account imagePullSecrets."""
    # Bolt: Instead of sequential kubectl calls for each SA, fetch all SAs in NS once
    sa_names_needed = set()
    for pod in pods:
        sa = pod.get("spec", {}).get("serviceAccountName", "default")
        sa_names_needed.add(sa)

    data = get_raw_resources("serviceaccounts", ctx, ns)
    all_sas = data.get("items", [])

    sa_secrets = {}
    for sa in all_sas:
        name = sa["metadata"]["name"]
        if name in sa_names_needed:
            pull_secrets = sa.get("imagePullSecrets", [])
            sa_secrets[name] = [s.get("name", "") for s in pull_secrets if s.get("name")]

    return sa_secrets
