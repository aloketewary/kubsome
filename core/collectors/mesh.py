"""
Mesh Collector — deep service mesh visibility for Istio/Linkerd.
VirtualServices, DestinationRules, mTLS status, circuit breakers,
traffic policies, and sidecar injection status.
"""

import subprocess
import json

from core.context import context


def collect_mesh_detail():
    """
    Collect comprehensive mesh status including traffic
    policies, mTLS, and circuit breaker configuration.
    """
    ctx = context.current_context
    ns = context.namespace

    mesh_type = _detect_mesh_type(ctx, ns)
    if not mesh_type:
        return {"mesh": None}

    if mesh_type == "istio":
        return _collect_istio(ctx, ns)
    else:
        return _collect_linkerd(ctx, ns)


def collect_virtual_services(target=None):
    """List Istio VirtualServices with routing rules."""
    ctx = context.current_context
    ns = context.namespace

    cmd = [
        "kubectl", "--context", str(ctx or ""),
        "get", "virtualservices.networking.istio.io",
        "-n", str(ns), "-o", "json"
    ]
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode != 0:
        return []

    data = json.loads(r.stdout)
    results = []
    for item in data.get("items", []):
        name = item["metadata"]["name"]
        if target and target not in name:
            continue

        spec = item.get("spec", {})
        hosts = spec.get("hosts", [])
        http_routes = spec.get("http", [])

        routes = []
        for route in http_routes:
            destinations = []
            for dest in route.get("route", []):
                d = dest.get("destination", {})
                destinations.append({
                    "host": d.get("host", ""),
                    "subset": d.get("subset", ""),
                    "port": d.get("port", {}).get("number", ""),
                    "weight": dest.get("weight", 100),
                })

            match_rules = []
            for match in route.get("match", []):
                for key, val in match.items():
                    if isinstance(val, dict):
                        match_rules.append(
                            f"{key}={list(val.values())[0]}"
                        )

            routes.append({
                "destinations": destinations,
                "match": match_rules,
                "timeout": route.get("timeout", ""),
                "retries": route.get("retries", {}),
                "fault": route.get("fault", {}),
            })

        results.append({
            "name": name,
            "hosts": hosts,
            "routes": routes,
            "gateways": spec.get("gateways", []),
        })

    return results


def collect_destination_rules(target=None):
    """List Istio DestinationRules — circuit breakers, load balancing."""
    ctx = context.current_context
    ns = context.namespace

    cmd = [
        "kubectl", "--context", str(ctx or ""),
        "get", "destinationrules.networking.istio.io",
        "-n", str(ns), "-o", "json"
    ]
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode != 0:
        return []

    data = json.loads(r.stdout)
    results = []
    for item in data.get("items", []):
        name = item["metadata"]["name"]
        if target and target not in name:
            continue

        spec = item.get("spec", {})
        host = spec.get("host", "")
        traffic = spec.get("trafficPolicy", {})

        # Circuit breaker
        cb = traffic.get("connectionPool", {})
        outlier = traffic.get("outlierDetection", {})

        # TLS mode
        tls = traffic.get("tls", {})

        # Subsets (versions)
        subsets = []
        for s in spec.get("subsets", []):
            subsets.append({
                "name": s.get("name", ""),
                "labels": s.get("labels", {}),
            })

        results.append({
            "name": name,
            "host": host,
            "tls_mode": tls.get("mode", ""),
            "circuit_breaker": {
                "tcp_max_connections": (
                    cb.get("tcp", {}).get("maxConnections", "")
                ),
                "http_max_requests": (
                    cb.get("http", {})
                    .get("h2UpgradePolicy", "")
                ),
                "http1_max_pending": (
                    cb.get("http", {})
                    .get("http1MaxPendingRequests", "")
                ),
                "http2_max_requests": (
                    cb.get("http", {})
                    .get("http2MaxRequests", "")
                ),
            },
            "outlier_detection": {
                "consecutive_errors": outlier.get(
                    "consecutiveErrors",
                    outlier.get("consecutive5xxErrors", "")
                ),
                "interval": outlier.get("interval", ""),
                "base_ejection_time": outlier.get(
                    "baseEjectionTime", ""
                ),
                "max_ejection_pct": outlier.get(
                    "maxEjectionPercent", ""
                ),
            },
            "load_balancer": traffic.get(
                "loadBalancer", {}
            ).get("simple", ""),
            "subsets": subsets,
        })

    return results


def collect_mtls_status():
    """Check mTLS enforcement across the mesh."""
    ctx = context.current_context
    ns = context.namespace

    # Check PeerAuthentication policies
    cmd = [
        "kubectl", "--context", str(ctx or ""),
        "get", "peerauthentications.security.istio.io",
        "--all-namespaces", "-o", "json"
    ]
    r = subprocess.run(cmd, capture_output=True, text=True)

    policies = []
    if r.returncode == 0:
        data = json.loads(r.stdout)
        for item in data.get("items", []):
            meta = item.get("metadata", {})
            spec = item.get("spec", {})
            policies.append({
                "name": meta.get("name", ""),
                "namespace": meta.get("namespace", ""),
                "mode": spec.get("mtls", {}).get(
                    "mode", "UNSET"
                ),
                "scope": (
                    "mesh-wide"
                    if meta.get("namespace") == "istio-system"
                    and meta.get("name") == "default"
                    else "namespace"
                ),
            })

    # Determine effective mode
    mesh_wide = next(
        (p for p in policies if p["scope"] == "mesh-wide"),
        None
    )
    ns_policy = next(
        (p for p in policies if p["namespace"] == ns),
        None
    )

    effective = "PERMISSIVE"
    if ns_policy:
        effective = ns_policy["mode"]
    elif mesh_wide:
        effective = mesh_wide["mode"]

    return {
        "effective_mode": effective,
        "mesh_wide": mesh_wide,
        "namespace_policy": ns_policy,
        "all_policies": policies,
        "strict": effective == "STRICT",
    }


def _detect_mesh_type(ctx, ns):
    """Detect which mesh is running."""
    # Check Istio
    cmd = [
        "kubectl", "--context", str(ctx or ""),
        "get", "namespace", "istio-system",
        "-o", "name"
    ]
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode == 0:
        return "istio"

    # Check Linkerd
    cmd = [
        "kubectl", "--context", str(ctx or ""),
        "get", "namespace", "linkerd",
        "-o", "name"
    ]
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode == 0:
        return "linkerd"

    return None


def _collect_istio(ctx, ns):
    """Full Istio mesh status."""
    vs = collect_virtual_services()
    dr = collect_destination_rules()
    mtls = collect_mtls_status()

    # Sidecar injection status
    cmd = [
        "kubectl", "--context", str(ctx or ""),
        "get", "pods", "-n", str(ns), "-o", "json"
    ]
    r = subprocess.run(cmd, capture_output=True, text=True)

    injected = 0
    total = 0
    not_injected = []
    if r.returncode == 0:
        pods = json.loads(r.stdout).get("items", [])
        total = len(pods)
        for pod in pods:
            containers = [
                c["name"]
                for c in pod["spec"].get("containers", [])
            ]
            if "istio-proxy" in containers:
                injected += 1
            else:
                not_injected.append(
                    pod["metadata"]["name"]
                )

    return {
        "mesh": "istio",
        "virtual_services": vs,
        "destination_rules": dr,
        "mtls": mtls,
        "injection": {
            "total": total,
            "injected": injected,
            "coverage_pct": (
                int((injected / total) * 100)
                if total > 0 else 0
            ),
            "not_injected": not_injected[:10],
        },
    }


def _collect_linkerd(ctx, ns):
    """Full Linkerd mesh status."""
    cmd = [
        "kubectl", "--context", str(ctx or ""),
        "get", "pods", "-n", str(ns), "-o", "json"
    ]
    r = subprocess.run(cmd, capture_output=True, text=True)

    injected = 0
    total = 0
    not_injected = []
    if r.returncode == 0:
        pods = json.loads(r.stdout).get("items", [])
        total = len(pods)
        for pod in pods:
            containers = [
                c["name"]
                for c in pod["spec"].get("containers", [])
            ]
            if "linkerd-proxy" in containers:
                injected += 1
            else:
                not_injected.append(
                    pod["metadata"]["name"]
                )

    # Check Linkerd server authorizations
    cmd = [
        "kubectl", "--context", str(ctx or ""),
        "get", "serverauthorizations.policy.linkerd.io",
        "-n", str(ns), "-o", "json"
    ]
    r = subprocess.run(cmd, capture_output=True, text=True)
    auth_policies = []
    if r.returncode == 0:
        data = json.loads(r.stdout)
        for item in data.get("items", []):
            auth_policies.append({
                "name": item["metadata"]["name"],
                "server": (
                    item.get("spec", {})
                    .get("server", {})
                    .get("name", "")
                ),
            })

    return {
        "mesh": "linkerd",
        "virtual_services": [],
        "destination_rules": [],
        "mtls": {
            "effective_mode": "STRICT",
            "strict": True,
            "all_policies": [],
        },
        "injection": {
            "total": total,
            "injected": injected,
            "coverage_pct": (
                int((injected / total) * 100)
                if total > 0 else 0
            ),
            "not_injected": not_injected[:10],
        },
        "auth_policies": auth_policies,
    }
