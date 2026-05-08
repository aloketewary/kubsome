"""
Intent definitions — maps operational intents to
natural language phrases for matching.
"""

INTENTS = {
    # Observe
    "show_pods": [
        "show pods", "list pods", "get pods",
        "pods", "running pods", "pod list",
        "what pods are running", "show all pods",
    ],
    "overview": [
        "overview", "cluster health", "dashboard",
        "system state", "cluster status",
        "how is the cluster",
    ],
    "events": [
        "events", "show events", "recent events",
        "what happened", "cluster events",
    ],
    "top_pods": [
        "top pods", "resource usage", "cpu usage",
        "memory usage", "resource consumers",
        "which pod uses most", "heavy workloads",
        "memory-heavy", "cpu-heavy",
    ],
    "top_nodes": [
        "top nodes", "node usage", "node pressure",
        "node resources",
    ],

    # Diagnose
    "diagnose": [
        "diagnose", "debug", "troubleshoot",
        "root cause", "why failing", "why crashing",
        "why restarting", "what's wrong",
    ],
    "inspect": [
        "inspect", "describe pod", "pod details",
        "show details", "deep inspect",
    ],
    "trace": [
        "trace", "dependency map", "resource map",
        "what depends on", "relationship",
    ],
    "netcheck": [
        "network check", "netcheck", "dns check",
        "connectivity", "can reach",
    ],

    # Operate
    "logs": [
        "logs", "show logs", "view logs",
        "log output", "print logs",
    ],
    "restart": [
        "restart", "rolling restart",
        "bounce", "recycle",
    ],
    "scale": [
        "scale", "scale up", "scale down",
        "set replicas", "increase replicas",
        "decrease replicas",
    ],
    "rollback": [
        "rollback", "undo", "revert",
        "go back", "previous version",
    ],
    "rollout": [
        "rollout", "rollout status",
        "deployment status", "deploy status",
    ],

    # AI / Analysis
    "summarize": [
        "summarize", "summary", "health summary",
        "cluster summary", "quick status",
        "give me overview",
    ],
    "why_failing": [
        "why is", "why failing", "why crashing",
        "why down", "why broken", "why restarting",
        "why oom", "why stuck", "why pending",
        "what caused", "root cause",
    ],
    "count_pods": [
        "how many pods", "how many running",
        "count pods", "number of pods",
        "total pods", "pod count",
        "how many customer", "how many payment",
        "how many billing",
    ],
    "unhealthy": [
        "unhealthy pods", "failing pods",
        "which pods failing", "degraded pods",
        "broken pods", "crashlooping",
        "show unhealthy", "show me unhealthy",
        "list unhealthy", "pods not running",
    ],
    "anomalies": [
        "anomalies", "anomaly", "issues",
        "problems", "alerts", "warnings",
    ],
    "what_changed": [
        "what changed", "recent changes",
        "what happened", "activity",
        "what changed before failure",
    ],
    "correlate": [
        "correlate", "correlation",
        "cause and effect", "related events",
    ],

    # Safety
    "is_safe": [
        "is it safe", "safe to restart",
        "safe to scale", "safe to rollback",
        "safe to delete", "impact of",
        "risk of restarting", "risk of scaling",
        "is it safe to",
    ],
    "health_check": [
        "is healthy", "health of", "status of",
        "check health", "is running",
    ],

    # Security & Cost
    "security": [
        "security", "scan", "vulnerabilities",
        "misconfigurations", "security scan",
    ],
    "optimize": [
        "optimize", "right-size", "cost",
        "savings", "over-provisioned",
        "recommended fixes",
    ],
    "unused": [
        "unused", "orphaned", "cleanup",
        "dead resources", "stale",
    ],

    # Operations
    "exec": [
        "exec", "shell", "ssh into",
        "connect to pod", "terminal",
    ],
    "port_forward": [
        "port forward", "forward port",
        "expose locally",
    ],
    "delete": [
        "delete", "remove", "kill pod",
    ],
    "apply": [
        "apply", "deploy manifest",
        "apply yaml",
    ],

    # Incident
    "incident_start": [
        "incident start", "start incident",
        "begin tracking", "open incident",
    ],
    "incident_stop": [
        "incident stop", "close incident",
        "end incident", "resolve incident",
    ],
}
