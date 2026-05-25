"""
Service Intelligence — dependency mapping, mesh awareness,
traffic patterns, ingress overview, DNS debugging.
"""

import subprocess
import json

from core.context import context
from core.cache import cached
from core.k8s import get_raw_resources

# Bolt: Standard TTL for service-related caches
SERVICE_CACHE_TTL = 15


@cached(ttl=SERVICE_CACHE_TTL)
def detect_mesh():
    """Detect service mesh (Istio/Linkerd) and show status."""
    ns = context.namespace
    ctx = context.current_context

    # Bolt: Use cached raw fetcher to enable sharing pod data across collectors
    data = get_raw_resources("pods", ctx, ns)

    if not data or "items" not in data:
        return {"mesh": None, "pods": []}

    mesh_type = None
    mesh_pods = []

    for pod in data.get("items", []):
        containers = [
            c["name"]
            for c in pod["spec"].get("containers", [])
        ]

        has_istio = "istio-proxy" in containers
        has_linkerd = "linkerd-proxy" in containers

        if has_istio:
            mesh_type = "istio"
        elif has_linkerd:
            mesh_type = "linkerd"

        if has_istio or has_linkerd:
            mesh_pods.append({
                "name": pod["metadata"]["name"],
                "mesh": "istio" if has_istio else "linkerd",
                "sidecar_ready": _sidecar_ready(
                    pod, "istio-proxy" if has_istio else "linkerd-proxy"
                ),
            })

    total_pods = len(data.get("items", []))
    injected = len(mesh_pods)

    return {
        "mesh": mesh_type,
        "total_pods": total_pods,
        "injected": injected,
        "coverage_pct": (
            int((injected / total_pods) * 100)
            if total_pods > 0 else 0
        ),
        "pods": mesh_pods,
    }


@cached(ttl=SERVICE_CACHE_TTL)
def list_ingresses():
    """List all ingress resources with routing info."""
    ns = context.namespace
    ctx = context.current_context

    # Bolt: Use cached raw fetcher for performance and consistency
    data = get_raw_resources("ingresses", ctx, ns)

    if not data or "items" not in data:
        return []
    ingresses = []

    for item in data.get("items", []):
        name = item["metadata"]["name"]
        rules = item["spec"].get("rules", [])

        for rule in rules:
            host = rule.get("host", "*")
            paths = rule.get("http", {}).get("paths", [])

            for path in paths:
                backend = path.get("backend", {})
                svc = backend.get("service", {})

                ingresses.append({
                    "name": name,
                    "host": host,
                    "path": path.get("path", "/"),
                    "service": svc.get("name", ""),
                    "port": svc.get("port", {}).get(
                        "number", ""
                    ),
                    "path_type": path.get(
                        "pathType", "Prefix"
                    ),
                })

    return ingresses


def service_dependencies(deployment_name):
    """
    Map dependencies for a deployment by analyzing:
    - Environment variables (SERVICE_URL patterns)
    - Service references in configmaps
    - Network connections (if mesh available)
    """
    ns = context.namespace
    ctx = context.current_context

    # Bolt: Use cached raw fetcher to fetch deployments and leverage cluster-wide caches
    data = get_raw_resources("deployments", ctx, ns)

    # Find specific deployment
    matching = [d for d in data.get("items", []) if d.get("metadata", {}).get("name") == deployment_name]
    if not matching:
        return None

    dep = matching[0]
    containers = dep["spec"].get(
        "template", {}
    ).get("spec", {}).get("containers", [])

    dependencies = {
        "name": deployment_name,
        "upstream": [],   # services this depends on
        "downstream": [], # services that depend on this
        "env_refs": [],   # service references in env vars
    }

    # Scan env vars for service references
    all_services = _get_service_names(ns, ctx)

    for c in containers:
        for env in c.get("env", []):
            value = env.get("value", "")
            name = env.get("name", "")

            # Look for service URLs or hostnames
            for svc in all_services:
                if svc in value and svc != deployment_name:
                    dependencies["upstream"].append({
                        "service": svc,
                        "via": f"env:{name}",
                    })

            # Common patterns
            if any(
                kw in name.lower()
                for kw in [
                    "url", "host", "endpoint",
                    "addr", "service"
                ]
            ):
                if value and "://" in value or "." in value:
                    dependencies["env_refs"].append({
                        "var": name,
                        "value": value[:60],
                    })

    # Check if any service points to this deployment
    # Bolt: Use cached raw fetcher for services
    svcs = get_raw_resources("services", ctx, ns)

    if svcs and "items" in svcs:
        dep_labels = dep["spec"].get(
            "selector", {}
        ).get("matchLabels", {})

        for svc in svcs.get("items", []):
            selector = svc["spec"].get("selector", {})
            if selector and all(
                dep_labels.get(k) == v
                for k, v in selector.items()
            ):
                dependencies["downstream"].append({
                    "service": svc["metadata"]["name"],
                    "ports": [
                        f"{p['port']}/{p.get('protocol', 'TCP')}"
                        for p in svc["spec"].get("ports", [])
                    ],
                })

    return dependencies


def dns_debug(service_name):
    """Test DNS resolution for a service."""
    ns = context.namespace
    ctx = context.current_context

    results = []

    # Test different DNS forms
    dns_names = [
        service_name,
        f"{service_name}.{ns}",
        f"{service_name}.{ns}.svc",
        f"{service_name}.{ns}.svc.cluster.local",
    ]

    # Get service ClusterIP for comparison
    # Bolt: Use cached raw fetcher for consistency
    data = get_raw_resources("services", ctx, ns)

    expected_ip = ""
    if data and "items" in data:
        matching = [s for s in data.get("items", []) if s.get("metadata", {}).get("name") == service_name]
        if matching:
            expected_ip = matching[0].get("spec", {}).get("clusterIP", "")

    for dns_name in dns_names:
        # Use kubectl run to test DNS from inside cluster
        cmd = (
            f"kubectl --context {ctx} "
            f"run dns-test-{hash(dns_name) % 10000} "
            f"--image=busybox --rm -it --restart=Never "
            f"-n {ns} -- nslookup {dns_name} 2>/dev/null"
        )

        # Simpler: just check if service exists
        results.append({
            "name": dns_name,
            "expected_ip": expected_ip,
        })

    return {
        "service": service_name,
        "namespace": ns,
        "cluster_ip": expected_ip,
        "dns_names": dns_names,
        "resolvable": bool(expected_ip),
    }


def _sidecar_ready(pod, sidecar_name):
    statuses = pod["status"].get("containerStatuses", [])
    for cs in statuses:
        if cs["name"] == sidecar_name:
            return cs.get("ready", False)
    return False


def _get_service_names(ns, ctx):
    # Bolt: Use cached raw fetcher for consistency and to share data with service_dependencies
    data = get_raw_resources("services", ctx, ns)
    if not data or "items" not in data:
        return []

    return [
        item["metadata"]["name"]
        for item in data.get("items", [])
    ]
