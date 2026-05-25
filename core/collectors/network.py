"""
Network Diagnostics — test connectivity, DNS resolution,
and service endpoint reachability.
"""

import subprocess
import json
from concurrent.futures import ThreadPoolExecutor

from core.context import context
from core.k8s import get_raw_resources


def netcheck(pod_name):
    """Run network diagnostics for a pod."""
    ns = context.namespace
    ctx = context.current_context

    # Bolt: Parallelize all top-level diagnostic categories to minimize O(N) sequential latency
    # Total latency becomes that of the slowest category (typically DNS/exec).
    with ThreadPoolExecutor(max_workers=4) as executor:
        f_dns = executor.submit(_check_dns, pod_name, ns, ctx)
        f_services = executor.submit(_check_service_endpoints, ns, ctx)
        f_pod_ip = executor.submit(_get_pod_ip, pod_name, ns, ctx)
        f_net_pol = executor.submit(_check_network_policies, ns, ctx)

        results = {
            "pod": pod_name,
            "dns": f_dns.result(),
            "services": f_services.result(),
            "pod_ip": f_pod_ip.result(),
            "network_policy": f_net_pol.result(),
        }

    return results


def _check_dns(pod_name, ns, ctx):
    """Test DNS resolution from inside the pod."""
    tests = [
        ("kubernetes.default", "Cluster DNS"),
        ("kubernetes.default.svc.cluster.local", "FQDN"),
    ]

    def _lookup(host, label):
        cmd = [
            "kubectl", "--context", str(ctx or ""),
            "exec", pod_name, "-n", str(ns),
            "--", "nslookup", host
        ]

        try:
            r = subprocess.run(
                cmd,
                capture_output=True, text=True,
                timeout=10
            )

            success = (
                r.returncode == 0
                and "can't resolve" not in r.stdout.lower()
            )
        except (subprocess.SubprocessError, Exception):
            success = False

        return {
            "host": host,
            "label": label,
            "success": success,
        }

    # Bolt: Parallelize individual lookups within _check_dns to reduce total latency
    with ThreadPoolExecutor(max_workers=len(tests)) as executor:
        results = list(executor.map(lambda p: _lookup(*p), tests))

    return results


def _check_service_endpoints(ns, ctx):
    """Check if services have healthy endpoints."""
    # Bolt: Use cached raw fetcher to reduce redundant I/O and shell overhead
    data = get_raw_resources("endpoints", ctx, ns)
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
    # Bolt: This remains a direct call for specific field extraction,
    # but is now executed in parallel with other diagnostics.
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
    # Bolt: Use cached raw fetcher
    data = get_raw_resources("networkpolicies", ctx, ns)
    items = data.get("items", [])
    count = len(items)
    return {"count": count, "exists": count > 0}
