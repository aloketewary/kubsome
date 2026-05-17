"""
Security Scanner — detects common Kubernetes
security misconfigurations.
"""

from core.context import context
from core.cache import cached
from core.k8s import get_raw_resources


@cached(ttl=15)
def security_scan():
    """
    Scan pods in namespace for security issues.
    Returns list of findings.
    """
    ns = context.namespace
    ctx = context.current_context

    data = get_raw_resources("pods", ctx, ns)
    findings = []

    for item in data.get("items", []):
        pod_name = item["metadata"]["name"]
        spec = item["spec"]

        # Check host network
        if spec.get("hostNetwork"):
            findings.append({
                "pod": pod_name,
                "severity": "high",
                "issue": "Host network enabled",
                "detail": (
                    "Pod shares host network namespace"
                ),
                "fix": "Remove hostNetwork: true",
            })

        # Check host PID
        if spec.get("hostPID"):
            findings.append({
                "pod": pod_name,
                "severity": "high",
                "issue": "Host PID enabled",
                "detail": (
                    "Pod can see host processes"
                ),
                "fix": "Remove hostPID: true",
            })

        for container in spec.get("containers", []):
            c_name = container["name"]
            sc = container.get("securityContext", {})

            # Privileged container
            if sc.get("privileged"):
                findings.append({
                    "pod": pod_name,
                    "severity": "critical",
                    "issue": f"Privileged: {c_name}",
                    "detail": (
                        "Container runs with full "
                        "host privileges"
                    ),
                    "fix": (
                        "Set privileged: false"
                    ),
                })

            # Run as root
            if sc.get("runAsUser") == 0:
                findings.append({
                    "pod": pod_name,
                    "severity": "high",
                    "issue": f"Runs as root: {c_name}",
                    "detail": "Container runs as UID 0",
                    "fix": (
                        "Set runAsNonRoot: true"
                    ),
                })

            # No security context at all
            if not sc and not spec.get(
                "securityContext"
            ):
                findings.append({
                    "pod": pod_name,
                    "severity": "medium",
                    "issue": (
                        f"No security context: {c_name}"
                    ),
                    "detail": (
                        "No security constraints defined"
                    ),
                    "fix": (
                        "Add securityContext with "
                        "runAsNonRoot, readOnlyRootFilesystem"
                    ),
                })

            # Writable root filesystem
            if not sc.get("readOnlyRootFilesystem"):
                findings.append({
                    "pod": pod_name,
                    "severity": "low",
                    "issue": (
                        f"Writable rootfs: {c_name}"
                    ),
                    "detail": (
                        "Root filesystem is writable"
                    ),
                    "fix": (
                        "Set readOnlyRootFilesystem: true"
                    ),
                })

            # Latest tag
            image = container.get("image", "")
            if (
                ":latest" in image
                or ":" not in image.split("/")[-1]
            ):
                findings.append({
                    "pod": pod_name,
                    "severity": "medium",
                    "issue": f"Latest tag: {c_name}",
                    "detail": f"Image: {image}",
                    "fix": "Pin to specific image tag",
                })

            # No resource limits
            resources = container.get("resources", {})
            if not resources.get("limits"):
                findings.append({
                    "pod": pod_name,
                    "severity": "medium",
                    "issue": (
                        f"No resource limits: {c_name}"
                    ),
                    "detail": (
                        "Container can consume "
                        "unlimited resources"
                    ),
                    "fix": "Set CPU and memory limits",
                })

    # Deduplicate low-severity findings
    # (keep only unique issue types for low/medium)
    seen = set()
    deduped = []
    for f in findings:
        if f["severity"] in ("critical", "high"):
            deduped.append(f)
        else:
            key = (f["issue"].split(":")[0], f["pod"])
            if key not in seen:
                seen.add(key)
                deduped.append(f)

    return sorted(
        deduped,
        key=lambda f: (
            {"critical": 0, "high": 1,
             "medium": 2, "low": 3}.get(
                f["severity"], 4
            )
        )
    )
