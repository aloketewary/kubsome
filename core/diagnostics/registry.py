"""
Finding Registry — canonical finding types with
remediation catalog and explanation templates.

Every finding keys off a FindingType. This enables
consistent rendering, remediation, and AI explanation
across all interfaces.
"""

from enum import Enum

from core.diagnostics.models import Risk


class FindingType(Enum):
    # Container state
    OOM_KILL = "oom_kill"
    CRASH_LOOP = "crash_loop"
    IMAGE_PULL_ERROR = "image_pull_error"
    CONFIG_ERROR = "config_error"
    HIGH_RESTARTS = "high_restarts"
    RESTART_SPIKE = "restart_spike"
    EXIT_NONZERO = "exit_nonzero"
    CONTAINER_WAITING = "container_waiting"
    INIT_CONTAINER_FAILED = "init_container_failed"

    # Probes
    NO_PROBES = "no_probes"
    PROBE_FAILING = "probe_failing"
    LIVENESS_FAILING = "liveness_failing"
    READINESS_FAILING = "readiness_failing"

    # Scheduling
    PENDING_POD = "pending_pod"
    FAILED_SCHEDULING = "failed_scheduling"

    # Resources
    NO_RESOURCE_LIMITS = "no_resource_limits"
    RESOURCE_QUOTA_EXCEEDED = "resource_quota_exceeded"

    # Storage
    FAILED_MOUNT = "failed_mount"
    PVC_PENDING = "pvc_pending"

    # Secrets/Config
    MISSING_SECRET = "missing_secret"
    MISSING_CONFIGMAP = "missing_configmap"

    # Node
    NODE_PRESSURE = "node_pressure"
    EVICTED = "evicted"

    # Network
    DNS_FAILURE = "dns_failure"
    NETWORK_POLICY_BLOCKED = "network_policy_blocked"
    SERVICE_ENDPOINT_MISSING = "service_endpoint_missing"

    # RBAC
    RBAC_DENIED = "rbac_denied"

    # Correlation (multi-service)
    UPSTREAM_DEPENDENCY_FAILURE = "upstream_dependency_failure"
    DOWNSTREAM_TIMEOUT = "downstream_timeout"
    CASCADING_FAILURE = "cascading_failure"

    # Logs
    HIGH_ERROR_RATE = "high_error_rate"
    ERRORS_IN_LOGS = "errors_in_logs"

    # Events
    WARNING_EVENT = "warning_event"

    # Healthy
    HEALTHY = "healthy"


# --- Remediation Catalog ---

REMEDIATION_CATALOG = {
    FindingType.OOM_KILL: {
        "recommendations": [
            {
                "action": "Increase memory limit",
                "risk": Risk.LOW,
            },
            {
                "action": "Investigate memory leak",
                "risk": Risk.MEDIUM,
            },
        ],
        "plan_steps": [
            "Check current memory usage with kubectl top",
            "Identify peak memory from metrics",
            "Increase memory limit to 2x peak",
            "Apply updated resource spec",
            "Wait for rollout to complete",
            "Verify pod stability",
        ],
        "plan_risk": Risk.LOW,
        "reversible": True,
    },
    FindingType.CRASH_LOOP: {
        "recommendations": [
            {
                "action": "Check startup logs for errors",
                "risk": Risk.LOW,
            },
            {
                "action": "Rollback to last stable revision",
                "risk": Risk.MEDIUM,
            },
        ],
        "plan_steps": [
            "Retrieve previous container logs",
            "Identify crash reason from logs",
            "Fix application error or config",
            "Restart deployment",
            "Verify rollout status",
        ],
        "plan_risk": Risk.MEDIUM,
        "reversible": True,
    },
    FindingType.IMAGE_PULL_ERROR: {
        "recommendations": [
            {
                "action": (
                    "Verify image name, tag, and "
                    "registry credentials"
                ),
                "risk": Risk.LOW,
            },
        ],
        "plan_steps": [
            "Verify image exists in registry",
            "Check imagePullSecrets on pod spec",
            "Verify secret contains valid credentials",
            "Correct image reference or create secret",
            "Delete pod to trigger re-pull",
        ],
        "plan_risk": Risk.LOW,
        "reversible": True,
    },
    FindingType.CONFIG_ERROR: {
        "recommendations": [
            {
                "action": (
                    "Check ConfigMaps, Secrets, and "
                    "env references"
                ),
                "risk": Risk.LOW,
            },
        ],
        "plan_steps": [
            "Identify missing ConfigMap or Secret from events",
            "Create or restore missing resource",
            "Verify pod spec references match",
            "Delete pod to trigger restart",
        ],
        "plan_risk": Risk.LOW,
        "reversible": True,
    },
    FindingType.MISSING_SECRET: {
        "recommendations": [
            {
                "action": "Create or restore missing secret",
                "risk": Risk.LOW,
            },
            {
                "action": "Rollback deployment",
                "risk": Risk.MEDIUM,
            },
        ],
        "plan_steps": [
            "Identify required secret name from events",
            "Check if secret exists in other namespaces",
            "Create secret or restore from backup",
            "Verify pod starts successfully",
        ],
        "plan_risk": Risk.LOW,
        "reversible": True,
    },
    FindingType.PENDING_POD: {
        "recommendations": [
            {
                "action": (
                    "Check node resources and taints"
                ),
                "risk": Risk.MEDIUM,
            },
        ],
        "plan_steps": [
            "Describe pod for scheduling events",
            "Check node capacity with kubectl top nodes",
            "Verify taints and tolerations",
            "Scale node pool or adjust resource requests",
        ],
        "plan_risk": Risk.MEDIUM,
        "reversible": True,
    },
    FindingType.FAILED_SCHEDULING: {
        "recommendations": [
            {
                "action": (
                    "Check node resources and taints"
                ),
                "risk": Risk.MEDIUM,
            },
        ],
        "plan_steps": [
            "Check node capacity",
            "Review pod resource requests",
            "Verify node affinity and taints",
            "Scale cluster or reduce requests",
        ],
        "plan_risk": Risk.MEDIUM,
        "reversible": True,
    },
    FindingType.NO_RESOURCE_LIMITS: {
        "recommendations": [
            {
                "action": "Set resource requests and limits",
                "risk": Risk.LOW,
            },
        ],
        "plan_steps": [
            "Check current usage with kubectl top",
            "Set requests to current avg usage",
            "Set limits to 2x requests",
            "Apply and verify pod restarts cleanly",
        ],
        "plan_risk": Risk.LOW,
        "reversible": True,
    },
    FindingType.NO_PROBES: {
        "recommendations": [
            {
                "action": "Add liveness and readiness probes",
                "risk": Risk.LOW,
            },
        ],
        "plan_steps": [
            "Identify health endpoint or TCP port",
            "Add readiness probe",
            "Add liveness probe with higher threshold",
            "Apply and verify probe passes",
        ],
        "plan_risk": Risk.LOW,
        "reversible": True,
    },
    FindingType.PROBE_FAILING: {
        "recommendations": [
            {
                "action": "Check endpoint health",
                "risk": Risk.LOW,
            },
            {
                "action": "Increase probe timeout",
                "risk": Risk.LOW,
            },
        ],
        "plan_steps": [
            "Exec into pod and curl probe endpoint",
            "Check if app is slow to respond",
            "Adjust probe timeout or threshold",
            "Verify probe passes after fix",
        ],
        "plan_risk": Risk.LOW,
        "reversible": True,
    },
    FindingType.FAILED_MOUNT: {
        "recommendations": [
            {
                "action": "Check PVC and storage provisioner",
                "risk": Risk.MEDIUM,
            },
        ],
        "plan_steps": [
            "Describe PVC for status",
            "Verify StorageClass exists",
            "Check storage provisioner logs",
            "Recreate PVC if unrecoverable",
        ],
        "plan_risk": Risk.MEDIUM,
        "reversible": False,
    },
    FindingType.HIGH_ERROR_RATE: {
        "recommendations": [
            {
                "action": "Investigate application errors",
                "risk": Risk.LOW,
            },
        ],
        "plan_steps": [
            "Retrieve recent error logs",
            "Identify error pattern",
            "Check recent deployments for root cause",
            "Fix or rollback",
        ],
        "plan_risk": Risk.MEDIUM,
        "reversible": True,
    },
    FindingType.HIGH_RESTARTS: {
        "recommendations": [
            {
                "action": (
                    "Check application logs for crash "
                    "reason"
                ),
                "risk": Risk.LOW,
            },
        ],
        "plan_steps": [
            "Retrieve previous container logs",
            "Identify crash pattern",
            "Fix or rollback deployment",
            "Verify stability",
        ],
        "plan_risk": Risk.MEDIUM,
        "reversible": True,
    },
    FindingType.RESTART_SPIKE: {
        "recommendations": [
            {
                "action": "Monitor — may stabilize",
                "risk": Risk.LOW,
            },
        ],
        "plan_steps": [
            "Check recent logs for errors",
            "Monitor restart count over next 5 minutes",
            "Escalate if restarts continue",
        ],
        "plan_risk": Risk.LOW,
        "reversible": True,
    },
    FindingType.EXIT_NONZERO: {
        "recommendations": [
            {
                "action": "Check logs for crash reason",
                "risk": Risk.LOW,
            },
        ],
        "plan_steps": [
            "Retrieve previous container logs",
            "Identify exit reason from logs",
            "Fix application error or rollback",
        ],
        "plan_risk": Risk.MEDIUM,
        "reversible": True,
    },
    FindingType.CONTAINER_WAITING: {
        "recommendations": [
            {
                "action": "Investigate waiting state",
                "risk": Risk.LOW,
            },
        ],
        "plan_steps": [
            "Describe pod for events",
            "Identify reason for waiting state",
            "Resolve blocking condition",
        ],
        "plan_risk": Risk.LOW,
        "reversible": True,
    },
    FindingType.MISSING_CONFIGMAP: {
        "recommendations": [
            {
                "action": (
                    "Create or restore missing ConfigMap"
                ),
                "risk": Risk.LOW,
            },
        ],
        "plan_steps": [
            "Identify required ConfigMap from events",
            "Create ConfigMap or restore from backup",
            "Verify pod starts successfully",
        ],
        "plan_risk": Risk.LOW,
        "reversible": True,
    },
    FindingType.ERRORS_IN_LOGS: {
        "recommendations": [
            {
                "action": "Review: logs <pod> --errors",
                "risk": Risk.LOW,
            },
        ],
        "plan_steps": [
            "Retrieve error logs",
            "Identify error pattern",
            "Determine if action needed",
        ],
        "plan_risk": Risk.LOW,
        "reversible": True,
    },
    FindingType.NODE_PRESSURE: {
        "recommendations": [
            {
                "action": "Identify pressure type (memory/disk/PID)",
                "risk": Risk.LOW,
            },
            {
                "action": "Cordon node and drain workloads",
                "risk": Risk.MEDIUM,
            },
            {
                "action": "Scale node pool",
                "risk": Risk.MEDIUM,
            },
        ],
        "plan_steps": [
            "kubectl describe node <node> | grep Conditions",
            "Identify pressure type from conditions",
            "kubectl top node to check resource usage",
            "Cordon node if critical",
            "Drain pods to other nodes",
            "Investigate root cause (leak, noisy neighbor)",
        ],
        "plan_risk": Risk.MEDIUM,
        "reversible": True,
    },
    FindingType.EVICTED: {
        "recommendations": [
            {
                "action": "Check node pressure conditions",
                "risk": Risk.LOW,
            },
            {
                "action": "Set resource requests to prevent eviction",
                "risk": Risk.LOW,
            },
            {
                "action": "Add PriorityClass for critical workloads",
                "risk": Risk.MEDIUM,
            },
        ],
        "plan_steps": [
            "Describe pod for eviction reason",
            "Check node conditions at eviction time",
            "Set appropriate resource requests",
            "Consider PodDisruptionBudget",
            "Verify pod rescheduled successfully",
        ],
        "plan_risk": Risk.LOW,
        "reversible": True,
    },
    FindingType.DNS_FAILURE: {
        "recommendations": [
            {
                "action": "Check CoreDNS pods health",
                "risk": Risk.LOW,
            },
            {
                "action": "Verify DNS resolution from pod",
                "risk": Risk.LOW,
            },
            {
                "action": "Restart CoreDNS",
                "risk": Risk.MEDIUM,
            },
        ],
        "plan_steps": [
            "kubectl get pods -n kube-system -l k8s-app=kube-dns",
            "kubectl exec <pod> -- nslookup kubernetes.default",
            "Check CoreDNS logs for errors",
            "Verify /etc/resolv.conf in affected pod",
            "Restart CoreDNS if needed",
        ],
        "plan_risk": Risk.MEDIUM,
        "reversible": True,
    },
    FindingType.NETWORK_POLICY_BLOCKED: {
        "recommendations": [
            {
                "action": "Review NetworkPolicy rules",
                "risk": Risk.LOW,
            },
            {
                "action": "Add ingress/egress rule for blocked traffic",
                "risk": Risk.MEDIUM,
            },
        ],
        "plan_steps": [
            "kubectl get networkpolicy -n <ns>",
            "Identify which policy blocks traffic",
            "Verify pod labels match policy selectors",
            "Add allow rule or adjust selectors",
            "Test connectivity after change",
        ],
        "plan_risk": Risk.MEDIUM,
        "reversible": True,
    },
    FindingType.SERVICE_ENDPOINT_MISSING: {
        "recommendations": [
            {
                "action": "Verify service selector matches pod labels",
                "risk": Risk.LOW,
            },
            {
                "action": "Check target pods are Running and Ready",
                "risk": Risk.LOW,
            },
        ],
        "plan_steps": [
            "kubectl get endpoints <service> -n <ns>",
            "kubectl get svc <service> -n <ns> -o yaml | grep selector",
            "kubectl get pods -l <selector> -n <ns>",
            "Verify pods have matching labels and are Ready",
            "Fix selector or pod labels",
        ],
        "plan_risk": Risk.LOW,
        "reversible": True,
    },
    FindingType.PVC_PENDING: {
        "recommendations": [
            {
                "action": "Check StorageClass and provisioner",
                "risk": Risk.LOW,
            },
            {
                "action": "Verify storage quota not exceeded",
                "risk": Risk.LOW,
            },
            {
                "action": "Manually provision PV if static provisioning",
                "risk": Risk.MEDIUM,
            },
        ],
        "plan_steps": [
            "kubectl describe pvc <name> -n <ns>",
            "Check StorageClass exists and is default",
            "Verify storage provisioner is running",
            "Check storage quota in namespace",
            "Create PV manually or fix provisioner",
        ],
        "plan_risk": Risk.MEDIUM,
        "reversible": True,
    },
    FindingType.RESOURCE_QUOTA_EXCEEDED: {
        "recommendations": [
            {
                "action": "Check current quota usage",
                "risk": Risk.LOW,
            },
            {
                "action": "Reduce resource requests on pods",
                "risk": Risk.LOW,
            },
            {
                "action": "Request quota increase",
                "risk": Risk.MEDIUM,
            },
        ],
        "plan_steps": [
            "kubectl describe resourcequota -n <ns>",
            "Identify which resource hit limit",
            "Reduce requests or delete unused resources",
            "Request quota increase if legitimate growth",
            "Retry failed deployment",
        ],
        "plan_risk": Risk.LOW,
        "reversible": True,
    },
    FindingType.INIT_CONTAINER_FAILED: {
        "recommendations": [
            {
                "action": "Check init container logs",
                "risk": Risk.LOW,
            },
            {
                "action": (
                    "Verify init container dependencies "
                    "(DB, service availability)"
                ),
                "risk": Risk.LOW,
            },
            {
                "action": "Rollback deployment",
                "risk": Risk.MEDIUM,
            },
        ],
        "plan_steps": [
            "kubectl logs <pod> -c <init-container> -n <ns>",
            "Identify init container failure reason",
            "Verify dependencies are accessible",
            "Fix init script or dependency",
            "Delete pod to retry init",
        ],
        "plan_risk": Risk.LOW,
        "reversible": True,
    },
    FindingType.LIVENESS_FAILING: {
        "recommendations": [
            {
                "action": "Check why liveness probe fails",
                "risk": Risk.LOW,
            },
            {
                "action": (
                    "Increase liveness probe timeout or "
                    "failure threshold"
                ),
                "risk": Risk.LOW,
            },
            {
                "action": "Fix application health endpoint",
                "risk": Risk.MEDIUM,
            },
        ],
        "plan_steps": [
            "Exec into pod and test health endpoint",
            "Check if app is deadlocked or hung",
            "Increase initialDelaySeconds if slow start",
            "Increase failureThreshold if transient",
            "Fix application if genuinely unhealthy",
        ],
        "plan_risk": Risk.LOW,
        "reversible": True,
    },
    FindingType.READINESS_FAILING: {
        "recommendations": [
            {
                "action": "Check why readiness probe fails",
                "risk": Risk.LOW,
            },
            {
                "action": (
                    "Check downstream dependencies "
                    "(DB, cache, external APIs)"
                ),
                "risk": Risk.LOW,
            },
            {
                "action": "Increase readiness probe timeout",
                "risk": Risk.LOW,
            },
        ],
        "plan_steps": [
            "Exec into pod and test readiness endpoint",
            "Check downstream service connectivity",
            "Verify pod has not lost network",
            "Adjust probe or fix dependency",
            "Verify traffic resumes after fix",
        ],
        "plan_risk": Risk.LOW,
        "reversible": True,
    },
    FindingType.RBAC_DENIED: {
        "recommendations": [
            {
                "action": "Check ServiceAccount permissions",
                "risk": Risk.LOW,
            },
            {
                "action": (
                    "Create or update Role/ClusterRole "
                    "binding"
                ),
                "risk": Risk.MEDIUM,
            },
        ],
        "plan_steps": [
            "Identify denied verb and resource from logs",
            "kubectl auth can-i <verb> <resource> "
            "--as=system:serviceaccount:<ns>:<sa>",
            "Create Role with required permissions",
            "Create RoleBinding for ServiceAccount",
            "Verify access with auth can-i",
        ],
        "plan_risk": Risk.MEDIUM,
        "reversible": True,
    },
    FindingType.UPSTREAM_DEPENDENCY_FAILURE: {
        "recommendations": [
            {
                "action": (
                    "Investigate upstream service health"
                ),
                "risk": Risk.LOW,
            },
            {
                "action": (
                    "Check upstream pod restarts and "
                    "events"
                ),
                "risk": Risk.LOW,
            },
            {
                "action": (
                    "Add circuit breaker or retry with "
                    "backoff"
                ),
                "risk": Risk.MEDIUM,
            },
        ],
        "plan_steps": [
            "Identify upstream service from error logs",
            "Check upstream pods for failures",
            "Verify upstream service endpoints",
            "Fix upstream or add resilience pattern",
            "Verify downstream recovers",
        ],
        "plan_risk": Risk.MEDIUM,
        "reversible": True,
    },
    FindingType.DOWNSTREAM_TIMEOUT: {
        "recommendations": [
            {
                "action": (
                    "Check downstream service health "
                    "and latency"
                ),
                "risk": Risk.LOW,
            },
            {
                "action": (
                    "Increase timeout or add retry"
                ),
                "risk": Risk.LOW,
            },
            {
                "action": (
                    "Scale downstream service"
                ),
                "risk": Risk.MEDIUM,
            },
        ],
        "plan_steps": [
            "Identify timeout target from logs",
            "Check target service pod health",
            "Verify network connectivity",
            "Increase timeout or scale target",
            "Verify requests succeed",
        ],
        "plan_risk": Risk.LOW,
        "reversible": True,
    },
    FindingType.CASCADING_FAILURE: {
        "recommendations": [
            {
                "action": (
                    "Identify and fix root cause service"
                ),
                "risk": Risk.LOW,
            },
            {
                "action": (
                    "Enable circuit breakers on affected "
                    "services"
                ),
                "risk": Risk.MEDIUM,
            },
            {
                "action": (
                    "Scale impacted services to absorb "
                    "retry storms"
                ),
                "risk": Risk.MEDIUM,
            },
        ],
        "plan_steps": [
            "Identify first failure in timeline",
            "Fix root cause service",
            "Wait for dependent services to recover",
            "If not recovering, restart dependents",
            "Add circuit breakers to prevent recurrence",
        ],
        "plan_risk": Risk.HIGH,
        "reversible": True,
    },
}


# --- AI Explanation Templates ---

EXPLANATION_TEMPLATES = {
    FindingType.OOM_KILL: (
        "The container was killed by the Linux kernel's "
        "OOM killer because it exceeded its memory limit. "
        "This typically means the application needs more "
        "memory or has a memory leak."
    ),
    FindingType.CRASH_LOOP: (
        "The container starts, crashes, and Kubernetes "
        "keeps restarting it with increasing backoff "
        "delays. Check logs from the previous container "
        "instance for the crash reason."
    ),
    FindingType.IMAGE_PULL_ERROR: (
        "Kubernetes cannot pull the container image. "
        "Common causes: wrong image name/tag, private "
        "registry without credentials, or network issue."
    ),
    FindingType.CONFIG_ERROR: (
        "The container cannot start because its "
        "configuration is invalid. Usually a referenced "
        "ConfigMap or Secret does not exist."
    ),
    FindingType.MISSING_SECRET: (
        "A Secret referenced by the pod does not exist "
        "in this namespace. The pod cannot start until "
        "the secret is created or the reference removed."
    ),
    FindingType.MISSING_CONFIGMAP: (
        "A ConfigMap referenced by the pod does not "
        "exist in this namespace. The pod cannot start "
        "until the ConfigMap is created."
    ),
    FindingType.PENDING_POD: (
        "The pod cannot be scheduled to any node. "
        "Common causes: insufficient CPU/memory on nodes, "
        "taints without tolerations, or node affinity "
        "rules that cannot be satisfied."
    ),
    FindingType.FAILED_SCHEDULING: (
        "The scheduler cannot place this pod on any "
        "node. Check node capacity, taints, tolerations, "
        "and affinity rules."
    ),
    FindingType.NO_RESOURCE_LIMITS: (
        "Without resource limits, a misbehaving container "
        "can consume unbounded CPU/memory and impact "
        "other workloads on the same node."
    ),
    FindingType.NO_PROBES: (
        "Without health probes, Kubernetes cannot detect "
        "when the application is unhealthy or not ready "
        "to serve traffic."
    ),
    FindingType.PROBE_FAILING: (
        "The health probe is failing, which means "
        "Kubernetes considers the container unhealthy. "
        "This may cause traffic to be routed away or "
        "the container to be restarted."
    ),
    FindingType.HIGH_ERROR_RATE: (
        "A high volume of error-level log entries "
        "indicates the application is experiencing "
        "significant failures."
    ),
    FindingType.ERRORS_IN_LOGS: (
        "Some error-level log entries were found. "
        "This may indicate intermittent issues that "
        "should be investigated."
    ),
    FindingType.HIGH_RESTARTS: (
        "The container has restarted many times, "
        "indicating repeated crashes. Check previous "
        "container logs for the failure reason."
    ),
    FindingType.RESTART_SPIKE: (
        "The container has restarted a few times. "
        "This may stabilize on its own or indicate "
        "an emerging issue."
    ),
    FindingType.EXIT_NONZERO: (
        "The container exited with a non-zero exit code, "
        "indicating an application error or crash. "
        "Check logs for the failure reason."
    ),
    FindingType.CONTAINER_WAITING: (
        "The container is in a waiting state and has "
        "not started yet. Check events for the reason."
    ),
    FindingType.FAILED_MOUNT: (
        "A volume could not be mounted. Common causes: "
        "PVC not bound, storage class misconfigured, "
        "or the underlying storage is unavailable."
    ),
    FindingType.NODE_PRESSURE: (
        "The node is under resource pressure (memory, "
        "disk, or PID). Kubernetes may start evicting "
        "pods from this node. Workloads should be "
        "drained to healthy nodes."
    ),
    FindingType.EVICTED: (
        "The pod was evicted by the kubelet due to "
        "node resource pressure. Pods without resource "
        "requests are evicted first. Set requests to "
        "prevent eviction of critical workloads."
    ),
    FindingType.DNS_FAILURE: (
        "DNS resolution is failing inside the pod. "
        "This usually means CoreDNS is unhealthy, "
        "the cluster DNS service is unreachable, or "
        "the pod's resolv.conf is misconfigured."
    ),
    FindingType.NETWORK_POLICY_BLOCKED: (
        "Traffic is being blocked by a NetworkPolicy. "
        "The pod cannot reach or be reached by other "
        "services. Review ingress/egress rules and "
        "pod label selectors."
    ),
    FindingType.SERVICE_ENDPOINT_MISSING: (
        "The Service has no endpoints, meaning no "
        "pods match its selector or matching pods are "
        "not Ready. Traffic to this Service will fail."
    ),
    FindingType.PVC_PENDING: (
        "The PersistentVolumeClaim is stuck in Pending "
        "state. No PersistentVolume is available or the "
        "storage provisioner cannot create one. Pods "
        "using this PVC cannot start."
    ),
    FindingType.RESOURCE_QUOTA_EXCEEDED: (
        "The namespace resource quota has been exceeded. "
        "New pods cannot be created until existing "
        "resource usage is reduced or the quota is "
        "increased."
    ),
    FindingType.INIT_CONTAINER_FAILED: (
        "An init container failed to complete. Init "
        "containers run before main containers start. "
        "Common causes: missing dependency, failed "
        "migration, or network issue reaching a "
        "required service."
    ),
    FindingType.LIVENESS_FAILING: (
        "The liveness probe is failing. Kubernetes will "
        "restart the container because it believes the "
        "application is deadlocked or unresponsive. "
        "This causes restarts, not traffic routing."
    ),
    FindingType.READINESS_FAILING: (
        "The readiness probe is failing. Kubernetes "
        "removes the pod from Service endpoints so it "
        "receives no traffic. The application may be "
        "starting slowly or a downstream dependency "
        "is unavailable."
    ),
    FindingType.RBAC_DENIED: (
        "The pod's ServiceAccount lacks permissions to "
        "perform a required Kubernetes API operation. "
        "A Role or ClusterRole binding is missing."
    ),
    FindingType.UPSTREAM_DEPENDENCY_FAILURE: (
        "An upstream service that this pod depends on "
        "has failed or restarted. This caused connection "
        "errors or timeouts in the dependent service. "
        "Fix the upstream first."
    ),
    FindingType.DOWNSTREAM_TIMEOUT: (
        "Requests to a downstream service are timing out. "
        "The downstream may be overloaded, crashed, or "
        "unreachable. This causes request failures in "
        "the calling service."
    ),
    FindingType.CASCADING_FAILURE: (
        "Multiple services are failing in sequence. "
        "A root cause failure in one service has "
        "propagated to dependent services. Identify and "
        "fix the first failure in the timeline."
    ),
}


def get_remediation(finding_type):
    """Look up remediation catalog for a finding type."""
    return REMEDIATION_CATALOG.get(finding_type)


def get_explanation(finding_type):
    """Look up AI explanation template for a finding type."""
    return EXPLANATION_TEMPLATES.get(finding_type, "")
