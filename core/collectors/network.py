"""
Network Diagnostics — test connectivity, DNS resolution,
and service endpoint reachability.
"""

import subprocess
from concurrent.futures import ThreadPoolExecutor

from core.context import context
from core.k8s import get_raw_resources


def netcheck(pod_name):
    """Run network diagnostics for a pod."""
    ns = context.namespace
    ctx = context.current_context

    # BOLT OPTIMIZATION: Parallelize network checks to reduce total latency
    # from O(N) to O(1) of the slowest check.
    with ThreadPoolExecutor(max_workers=4) as executor:
        dns_future = executor.submit(_check_dns, pod_name, ns, ctx)
        svc_future = executor.submit(_check_service_endpoints, ns, ctx)
        ip_future = executor.submit(_get_pod_ip, pod_name, ns, ctx)
        np_future = executor.submit(_check_network_policies, ns, ctx)

        results = {
            "pod": pod_name,
            "dns": dns_future.result(),
            "services": svc_future.result(),
            "pod_ip": ip_future.result(),
            "network_policy": np_future.result(),
        }

    return results


def _check_dns(pod_name, ns, ctx):
    """Test DNS resolution from inside the pod."""
    tests = [
        ("kubernetes.default", "Cluster DNS"),
        ("kubernetes.default.svc.cluster.local", "FQDN"),
    ]

    def _single_lookup(host, label):
        cmd = [
            "kubectl", "--context", str(ctx or ""),
            "exec", pod_name, "-n", str(ns),
            "--", "nslookup", host
        ]
        r = subprocess.run(cmd, capture_output=True, text=True, timeout=10)
        return {
            "host": host,
            "label": label,
            "success": r.returncode == 0 and "can't resolve" not in r.stdout.lower(),
        }

    # BOLT OPTIMIZATION: Parallelize multiple DNS lookups
    with ThreadPoolExecutor(max_workers=len(tests)) as executor:
        return list(executor.map(lambda t: _single_lookup(*t), tests))


def _check_service_endpoints(ns, ctx):
    """Check if services have healthy endpoints."""
    # BOLT OPTIMIZATION: Use cached get_raw_resources
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
    # BOLT OPTIMIZATION: Use cached get_raw_resources
    data = get_raw_resources("networkpolicies", ctx, ns)
    count = len(data.get("items", []))
    return {"count": count, "exists": count > 0}
