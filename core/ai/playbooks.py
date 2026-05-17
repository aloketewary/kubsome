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
            "Check network to registry from node",
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
            "Set memory request = limit to avoid burst OOM",
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
    "RolloutStuck": {
        "title": "Stuck Rollout Recovery",
        "steps": [
            "Check rollout status: [cyan]rollout <deployment>[/cyan]",
            "Check new pods: [cyan]pods[/cyan]",
            "Inspect failing new pod: [cyan]inspect <pod>[/cyan]",
            "Common causes:",
            "  • New image crashing (check logs)",
            "  • Readiness probe failing",
            "  • Resource quota exceeded",
            "  • PDB blocking rollout",
            "Rollback if needed: [cyan]rollback <deployment>[/cyan]",
            "Check PDB: [cyan]pdb[/cyan]",
        ],
    },
    "HighLatency": {
        "title": "High Latency Investigation",
        "steps": [
            "Check pod resource usage: [cyan]top pods[/cyan]",
            "Check if CPU throttled (limits too low)",
            "Check network: [cyan]netcheck <pod>[/cyan]",
            "Check downstream deps: [cyan]deps <deployment>[/cyan]",
            "Look for connection pool exhaustion in logs",
            "Consider scaling: [cyan]scale <deployment> <n>[/cyan]",
            "Check HPA: [cyan]hpa[/cyan]",
        ],
    },
    "CertificateExpiry": {
        "title": "Certificate Expiry",
        "steps": [
            "Check cert-manager certificates:",
            "  kubectl get certificates -A",
            "Check certificate status:",
            "  kubectl describe certificate <name>",
            "If expired: delete certificate to trigger renewal",
            "Check cert-manager logs:",
            "  kubectl logs -n cert-manager deploy/cert-manager",
            "Verify DNS challenge or HTTP challenge is working",
        ],
    },
    "PVCPending": {
        "title": "PVC Not Binding",
        "steps": [
            "Check PVC status: [cyan]get pvc[/cyan]",
            "Check PV availability:",
            "  kubectl get pv",
            "Check storage class exists:",
            "  kubectl get storageclass",
            "Common causes:",
            "  • No matching PV available",
            "  • StorageClass not found",
            "  • Zone mismatch (topology)",
            "  • Capacity exceeded",
            "Check events: [cyan]events[/cyan]",
        ],
    },
    "NodeNotReady": {
        "title": "Node Not Ready",
        "steps": [
            "Check node status: [cyan]describe node <name>[/cyan]",
            "Check node conditions (MemoryPressure, DiskPressure)",
            "Check kubelet logs on the node",
            "Check if node is cordoned: kubectl get nodes",
            "Common causes:",
            "  • Kubelet crashed",
            "  • Network partition",
            "  • Disk full",
            "  • Docker/containerd issues",
            "If recoverable: uncordon after fix",
            "If dead: drain and replace: [cyan]drain-check <node>[/cyan]",
        ],
    },
    "ServiceUnavailable": {
        "title": "Service Unavailable (503/502)",
        "steps": [
            "Check service endpoints:",
            "  kubectl get endpoints <service>",
            "Verify pods are running: [cyan]pods[/cyan]",
            "Check readiness probes: [cyan]inspect <pod>[/cyan]",
            "Check ingress config: [cyan]get ingress[/cyan]",
            "If no endpoints: pods not ready or selector mismatch",
            "Check service selector matches pod labels",
            "Check network policies: [cyan]netcheck <pod>[/cyan]",
        ],
    },
    "ConfigMapChange": {
        "title": "ConfigMap/Secret Change Impact",
        "steps": [
            "Identify affected deployments:",
            "  kubectl get pods -o json | grep configMapRef",
            "Check if pods auto-reload config",
            "If not: rolling restart required",
            "  [cyan]restart <deployment>[/cyan]",
            "Verify new config is correct:",
            "  [cyan]config <configmap>[/cyan]",
            "Monitor after restart: [cyan]pods watch[/cyan]",
        ],
    },
    "HighRestarts": {
        "title": "High Restart Count",
        "steps": [
            "Check pod logs: [cyan]logs <pod>[/cyan]",
            "Check previous container: [cyan]logs <pod> --previous[/cyan]",
            "Check events: [cyan]inspect <pod>[/cyan]",
            "Common patterns:",
            "  • Exit code 137 → OOM killed",
            "  • Exit code 1 → Application error",
            "  • Exit code 143 → SIGTERM (graceful)",
            "If OOM: increase memory limits",
            "If app error: fix code and redeploy",
            "If intermittent: check liveness probe timing",
        ],
    },
    "IngressNotWorking": {
        "title": "Ingress Not Routing",
        "steps": [
            "Check ingress resource: [cyan]get ingress[/cyan]",
            "Verify ingress controller is running:",
            "  kubectl get pods -n ingress-nginx",
            "Check ingress class annotation",
            "Verify backend service exists and has endpoints",
            "Check TLS secret if HTTPS",
            "Test with curl -H 'Host: <domain>' <ingress-ip>",
            "Check ingress controller logs",
        ],
    },
    "JobFailing": {
        "title": "Job/CronJob Failure",
        "steps": [
            "Check job status: [cyan]jobs[/cyan]",
            "Check pod logs from job:",
            "  kubectl logs job/<job-name>",
            "Check backoffLimit (default 6)",
            "Common causes:",
            "  • Image not found",
            "  • Command error",
            "  • Timeout (activeDeadlineSeconds)",
            "  • Resource limits too low",
            "If CronJob: check schedule and concurrencyPolicy",
            "List cronjobs: [cyan]cronjobs[/cyan]",
        ],
    },
    "EtcdSlow": {
        "title": "etcd Performance Issues",
        "steps": [
            "Check etcd pod health:",
            "  kubectl get pods -n kube-system -l component=etcd",
            "Check etcd metrics (if exposed)",
            "Common causes:",
            "  • Disk I/O too slow (use SSD)",
            "  • Too many objects in cluster",
            "  • Network latency between etcd members",
            "Check API server latency:",
            "  kubectl get --raw /metrics | grep apiserver_request_duration",
            "Consider etcd defrag if DB size is large",
        ],
    },
    "GracefulShutdown": {
        "title": "Pod Not Terminating Gracefully",
        "steps": [
            "Check terminationGracePeriodSeconds (default 30s)",
            "Verify app handles SIGTERM properly",
            "Check if preStop hook is configured",
            "If stuck Terminating:",
            "  kubectl delete pod <name> --force --grace-period=0",
            "Common causes:",
            "  • App ignoring SIGTERM",
            "  • Finalizers blocking deletion",
            "  • Volume unmount stuck",
            "Check finalizers: kubectl get pod <name> -o json | jq .metadata.finalizers",
        ],
    },
    "RBAC": {
        "title": "RBAC Permission Denied",
        "steps": [
            "Check current RBAC: [cyan]rbac[/cyan]",
            "Test permissions:",
            "  kubectl auth can-i <verb> <resource> --as=<user>",
            "Check service account:",
            "  kubectl get sa <name> -o yaml",
            "Check role bindings:",
            "  kubectl get rolebindings,clusterrolebindings -A",
            "Create missing role/binding if needed",
            "Verify namespace-scoped vs cluster-scoped",
        ],
    },
    "FailedToRetrieveImagePullSecret": {
        "title": "Failed to Retrieve Image Pull Secret",
        "steps": [
            "Check pod events: [cyan]inspect <pod>[/cyan]",
            "List secrets in namespace:",
            "  kubectl get secrets -n <namespace>",
            "Verify imagePullSecrets in pod spec:",
            "  kubectl get pod <pod> -o jsonpath='{.spec.imagePullSecrets}'",
            "Check if secret exists: [cyan]secret <name>[/cyan]",
            "Common causes:",
            "  • Secret deleted or not created in namespace",
            "  • Secret name typo in deployment spec",
            "  • ServiceAccount missing imagePullSecrets",
            "Recreate secret if missing:",
            "  kubectl create secret docker-registry <name> --docker-server=<registry> --docker-username=<user> --docker-password=<pass>",
            "Verify ServiceAccount has secret attached:",
            "  kubectl get sa default -o yaml",
            "Restart pods after fix: [cyan]restart <deployment>[/cyan]",
        ],
    },
    "FailedGetScale": {
        "title": "Failed Get Scale (HPA/Controller Issue)",
        "steps": [
            "Check HPA status: [cyan]hpa[/cyan]",
            "Verify target deployment exists:",
            "  kubectl get deployment <name>",
            "Check HPA target reference:",
            "  kubectl get hpa <name> -o yaml",
            "Common causes:",
            "  • HPA references a deleted/renamed deployment",
            "  • RBAC: controller lacks permission to read scale subresource",
            "  • API group mismatch in scaleTargetRef",
            "Fix scaleTargetRef in HPA spec:",
            "  apiVersion should match target (apps/v1)",
            "  kind should be Deployment/StatefulSet",
            "  name must match exactly",
            "Check controller-manager logs:",
            "  kubectl logs -n kube-system deploy/kube-controller-manager",
            "Delete and recreate HPA if reference is stale",
        ],
    },
}


def get_playbook(issue_type):
    """Get remediation playbook for an issue type."""
    # Check team runbooks first (project-local)
    team = _load_team_runbooks()
    if issue_type in team:
        return team[issue_type]
    return PLAYBOOKS.get(issue_type)


def list_all_playbooks():
    """List all playbooks including team runbooks."""
    all_pb = dict(PLAYBOOKS)
    all_pb.update(_load_team_runbooks())
    return all_pb


def _load_team_runbooks():
    """
    Load team-shared runbooks from:
    1. .kubsome/runbooks/*.yaml in current directory (project)
    2. ~/.kubsome/runbooks/*.yaml (user-level)

    Format:
      title: My Custom Runbook
      steps:
        - Check the thing
        - Fix the thing
    """
    import yaml
    from pathlib import Path

    runbooks = {}
    search_paths = [
        Path.cwd() / ".kubsome" / "runbooks",
        Path.home() / ".kubsome" / "runbooks",
    ]

    for runbook_dir in search_paths:
        if not runbook_dir.exists():
            continue
        for f in runbook_dir.glob("*.yaml"):
            try:
                with open(f, "r") as fh:
                    data = yaml.safe_load(fh)
                if data and "title" in data and "steps" in data:
                    key = f.stem
                    runbooks[key] = {
                        "title": data["title"],
                        "steps": data["steps"],
                        "source": str(f),
                    }
            except Exception:
                continue

    return runbooks


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
