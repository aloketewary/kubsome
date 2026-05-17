"""
Network Diagnostics — test connectivity, DNS resolution,
and service endpoint reachability.
"""

import subprocess
import json

from core.context import context


def netcheck(pod_name):
    """Run network diagnostics for a pod."""
    ns = context.namespace
    ctx = context.current_context

    results = {
        "pod": pod_name,
        "dns": _check_dns(pod_name, ns, ctx),
        "services": _check_service_endpoints(ns, ctx),
        "pod_ip": _get_pod_ip(pod_name, ns, ctx),
        "network_policy": _check_network_policies(ns, ctx),
    }

    return results


def _check_dns(pod_name, ns, ctx):
    """Test DNS resolution from inside the pod."""
    tests = [
        ("kubernetes.default", "Cluster DNS"),
        ("kubernetes.default.svc.cluster.local", "FQDN"),
    ]

    results = []
    for host, label in tests:
        cmd = [
            "kubectl", "--context", str(ctx or ""),
            "exec", pod_name, "-n", str(ns),
            "--", "nslookup", host
        ]

        r = subprocess.run(
            cmd,
            capture_output=True, text=True,
            timeout=10
        )

        success = (
            r.returncode == 0
            and "can't resolve" not in r.stdout.lower()
        )

        results.append({
            "host": host,
            "label": label,
            "success": success,
        })

    return results


def _check_service_endpoints(ns, ctx):
    """Check if services have healthy endpoints."""
    cmd = [
        "kubectl", "--context", str(ctx or ""),
        "get", "endpoints", "-n", str(ns), "-o", "json"
    ]

    r = subprocess.run(
        cmd,
        capture_output=True, text=True
    )

    if r.returncode != 0:
        return []

    data = json.loads(r.stdout)
    services = []

    for item in data.get("items", []):
        name = item["metadata"]["name"]
        subsets = item.get("subsets", [])

        ready_count = 0
        not_ready_count = 0

        for subset in subsets:
            ready_count += len(
                subset.get("addresses", [])
            )
            not_ready_count += len(
                subset.get("notReadyAddresses", [])
            )

        if ready_count > 0 or not_ready_count > 0:
            services.append({
                "name": name,
                "ready": ready_count,
                "not_ready": not_ready_count,
                "healthy": not_ready_count == 0,
            })

    return services


def _get_pod_ip(pod_name, ns, ctx):
    """Get pod IP and node."""
    cmd = [
        "kubectl", "--context", str(ctx or ""),
        "get", "pod", pod_name, "-n", str(ns),
        "-o", "jsonpath={.status.podIP} {.status.hostIP}"
    ]

    r = subprocess.run(
        cmd,
        capture_output=True, text=True
    )

    parts = r.stdout.strip().split()
    if len(parts) >= 2:
        return {"pod_ip": parts[0], "host_ip": parts[1]}
    return {"pod_ip": "unknown", "host_ip": "unknown"}


def _check_network_policies(ns, ctx):
    """Check if network policies exist in namespace."""
    cmd = [
        "kubectl", "--context", str(ctx or ""),
        "get", "networkpolicies", "-n", str(ns),
        "--no-headers"
    ]

    r = subprocess.run(
        cmd,
        capture_output=True, text=True
    )

    count = len([l for l in r.stdout.strip().splitlines() if l])
    return {"count": count, "exists": count > 0}
