"""
Remediation Playbooks — step-by-step fix guides
for common Kubernetes failure patterns.
"""

PLAYBOOKS = {
    "CrashLoopBackOff": {
        "title": "CrashLoopBackOff Recovery",
        "steps": [
            "Check recent logs: [cyan]logs <pod>[/cyan]",
            "Check previous container: [cyan]logs <pod> --previous[/cyan]",
            "Inspect pod events: [cyan]inspect <pod>[/cyan]",
            "Common causes:",
            "  • Application startup error",
            "  • Missing config/secret",
            "  • Port conflict",
            "  • OOM (check memory limits)",
            "If config issue: fix ConfigMap/Secret and restart",
            "If OOM: increase memory limits in deployment",
            "Quick fix: [cyan]restart <deployment>[/cyan]",
        ],
    },
    "ImagePullBackOff": {
        "title": "Image Pull Failure",
        "steps": [
            "Verify image exists: check registry",
            "Check image name/tag in deployment spec",
            "Verify imagePullSecrets are configured",
            "Check registry credentials:",
            "  kubectl get secret <pull-secret> -o yaml",
            "If private registry: ensure secret is in namespace",
            "If tag issue: update deployment image tag",
        ],
    },
    "OOMKilled": {
        "title": "Out of Memory Recovery",
        "steps": [
            "Check current limits: [cyan]inspect <pod>[/cyan]",
            "Check actual usage: [cyan]top pods[/cyan]",
            "Increase memory limit in deployment spec",
            "Look for memory leaks in application",
            "Consider horizontal scaling: [cyan]scale <dep> <n>[/cyan]",
            "Monitor after fix: [cyan]pods watch[/cyan]",
        ],
    },
    "Pending": {
        "title": "Pod Scheduling Failure",
        "steps": [
            "Check node resources: [cyan]top nodes[/cyan]",
            "Check pod events: [cyan]inspect <pod>[/cyan]",
            "Check cluster capacity: [cyan]capacity[/cyan]",
            "Common causes:",
            "  • Insufficient CPU/memory on nodes",
            "  • Node taints without tolerations",
            "  • PVC not bound",
            "  • Node selector mismatch",
            "If resource issue: scale cluster or reduce requests",
            "If taint issue: add toleration to pod spec",
        ],
    },
    "FailedScheduling": {
        "title": "Scheduling Failure",
        "steps": [
            "Check events: [cyan]events[/cyan]",
            "Check node capacity: [cyan]capacity[/cyan]",
            "Check node pressure: [cyan]top nodes[/cyan]",
            "Verify node labels match nodeSelector",
            "Check for taints: kubectl describe nodes",
            "Consider scaling cluster or reducing resource requests",
            "Check PDB: [cyan]pdb[/cyan]",
        ],
    },
    "Unhealthy": {
        "title": "Probe Failure",
        "steps": [
            "Check probe config: [cyan]inspect <pod>[/cyan]",
            "Test endpoint: [cyan]shell <pod>[/cyan] then curl localhost",
            "Check if app needs more startup time",
            "Increase initialDelaySeconds if startup is slow",
            "Verify probe path returns 200",
            "Check if port matches containerPort",
            "Check network: [cyan]netcheck <pod>[/cyan]",
        ],
    },
    "restart_spike": {
        "title": "Restart Spike Investigation",
        "steps": [
            "Identify affected pods: [cyan]which pods are unhealthy[/cyan]",
            "Check for common dependency:",
            "  • Shared ConfigMap/Secret changed?",
            "  • DNS issues? [cyan]netcheck <pod>[/cyan]",
            "  • Downstream service down? [cyan]deps <deployment>[/cyan]",
            "Check events timeline: [cyan]timeline[/cyan]",
            "Diagnose worst pod: [cyan]diagnose <pod>[/cyan]",
            "If cluster-wide: check kube-system pods",
        ],
    },
    "event_storm": {
        "title": "Event Storm Triage",
        "steps": [
            "Watch events live: [cyan]events watch[/cyan]",
            "Identify top event source",
            "Check if caused by deployment rollout: [cyan]rollout <dep>[/cyan]",
            "If BackOff events: check failing pods",
            "If scheduling events: [cyan]capacity[/cyan]",
            "Consider pausing rollouts until stable",
        ],
    },
    "DNS": {
        "title": "DNS Resolution Failure",
        "steps": [
            "Check DNS from pod: [cyan]netcheck <pod>[/cyan]",
            "Verify service exists: [cyan]dns <service>[/cyan]",
            "Check CoreDNS pods: kubectl get pods -n kube-system -l k8s-app=kube-dns",
            "Check service ClusterIP is assigned",
            "Verify namespace is correct in service reference",
            "Test with FQDN: <svc>.<ns>.svc.cluster.local",
        ],
    },
    "NetworkPolicy": {
        "title": "Network Connectivity Issue",
        "steps": [
            "Check network policies: [cyan]netcheck <pod>[/cyan]",
            "Verify service endpoints: [cyan]dns <service>[/cyan]",
            "Check if NetworkPolicy is blocking traffic",
            "Test from inside pod: [cyan]shell <pod>[/cyan]",
            "Check mesh status: [cyan]mesh[/cyan]",
            "Verify port numbers match between service and pod",
        ],
    },
    "HPA": {
        "title": "Autoscaler Not Scaling",
        "steps": [
            "Check HPA status: [cyan]hpa[/cyan]",
            "Verify metrics-server is running",
            "Check if already at maxReplicas",
            "Verify resource requests are set on pods",
            "Check actual usage: [cyan]top pods[/cyan]",
            "Check cluster capacity: [cyan]capacity[/cyan]",
        ],
    },
    "Security": {
        "title": "Security Hardening",
        "steps": [
            "Run security scan: [cyan]security[/cyan]",
            "Check RBAC: [cyan]rbac[/cyan]",
            "Fix privileged containers: set privileged: false",
            "Add runAsNonRoot: true to securityContext",
            "Set readOnlyRootFilesystem: true",
            "Pin image tags (avoid :latest)",
            "Set resource limits on all containers",
        ],
    },
    "ResourceExhaustion": {
        "title": "Resource Exhaustion",
        "steps": [
            "Check cluster capacity: [cyan]capacity[/cyan]",
            "Check node pressure: [cyan]top nodes[/cyan]",
            "Find over-provisioned pods: [cyan]optimize[/cyan]",
            "Check quotas: [cyan]quota[/cyan]",
            "Consider scaling cluster or right-sizing workloads",
            "Check for unused resources: [cyan]unused[/cyan]",
        ],
    },
}


def get_playbook(issue_type):
    """Get remediation playbook for an issue type."""
    return PLAYBOOKS.get(issue_type)


def match_playbook(findings):
    """Match findings to relevant playbooks."""
    matched = []

    for finding in findings:
        title = finding.get("title", "")
        severity = finding.get("severity", "")

        if severity not in ("critical", "warning"):
            continue

        for key in PLAYBOOKS:
            if key.lower() in title.lower():
                if key not in [m["key"] for m in matched]:
                    matched.append({
                        "key": key,
                        "playbook": PLAYBOOKS[key],
                        "trigger": title,
                    })
                break

    return matched
