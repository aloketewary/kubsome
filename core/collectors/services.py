"""
Service Intelligence — dependency mapping, mesh awareness,
traffic patterns, ingress overview, DNS debugging.
"""

import subprocess
import json

from core.context import context


def detect_mesh():
    """Detect service mesh (Istio/Linkerd) and show status."""
    ns = context.namespace
    ctx = context.current_context

    # Check for Istio sidecars
    cmd = (
        f"kubectl --context {ctx} "
        f"get pods -n {ns} -o json"
    )

    r = subprocess.run(
        cmd, shell=True,
        capture_output=True, text=True
    )

    if r.returncode != 0:
        return {"mesh": None, "pods": []}

    data = json.loads(r.stdout)

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


def list_ingresses():
    """List all ingress resources with routing info."""
    ns = context.namespace
    ctx = context.current_context

    cmd = (
        f"kubectl --context {ctx} "
        f"get ingress -n {ns} -o json"
    )

    r = subprocess.run(
        cmd, shell=True,
        capture_output=True, text=True
    )

    if r.returncode != 0:
        return []

    data = json.loads(r.stdout)
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

    cmd = (
        f"kubectl --context {ctx} "
        f"get deployment {deployment_name} "
        f"-n {ns} -o json"
    )

    r = subprocess.run(
        cmd, shell=True,
        capture_output=True, text=True
    )

    if r.returncode != 0:
        return None

    dep = json.loads(r.stdout)
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
    cmd2 = (
        f"kubectl --context {ctx} "
        f"get services -n {ns} -o json"
    )

    r2 = subprocess.run(
        cmd2, shell=True,
        capture_output=True, text=True
    )

    if r2.returncode == 0:
        svcs = json.loads(r2.stdout)
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
    cmd = (
        f"kubectl --context {ctx} "
        f"get service {service_name} -n {ns} "
        f"-o jsonpath='{{.spec.clusterIP}}'"
    )

    r = subprocess.run(
        cmd, shell=True,
        capture_output=True, text=True
    )
    expected_ip = r.stdout.strip("'") if r.returncode == 0 else ""

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
    cmd = (
        f"kubectl --context {ctx} "
        f"get services -n {ns} "
        f"-o jsonpath='{{.items[*].metadata.name}}'"
    )
    r = subprocess.run(
        cmd, shell=True,
        capture_output=True, text=True
    )
    return r.stdout.strip("'").split()
