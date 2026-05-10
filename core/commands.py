from core.context import context
from core.resolver import (
    resolve_pod_name, resolve_deployment_name,
    resolve_cronjob_name
)
from core.selector import (
    choose_pod, choose_deployment, choose_cronjob
)


def resolve_command(user_input: str):
    tokens = user_input.split()

    if not tokens:
        return None

    cmd = tokens[0]

    # Pods
    if cmd == "pods":
        if len(tokens) > 1 and tokens[1] == "watch":
            return {"type": "pods_watch"}
        return {"type": "pods_table"}

    # Overview
    if cmd == "overview":
        return {"type": "overview"}

    # Inspect
    if cmd == "inspect" and len(tokens) > 1:
        query = tokens[1]
        matches = resolve_pod_name(query)
        if not matches:
            return None
        pod = choose_pod(matches)
        if not pod:
            return None
        return {"type": "inspect", "target": pod}

    # Events
    if cmd == "events":
        if len(tokens) > 1 and tokens[1] == "watch":
            return {"type": "events_watch"}
        return {"type": "events"}

    # Logs
    if cmd == "logs" and len(tokens) > 1:
        query = tokens[1]
        matches = resolve_pod_name(query)
        if not matches:
            return None
        pod = choose_pod(matches)
        if not pod:
            return None

        flags = tokens[2:]
        return {
            "type": "logs",
            "target": pod,
            "follow": "--follow" in flags or "-f" in flags,
            "errors": "--errors" in flags,
            "previous": "--previous" in flags,
        }

    # Logcat (combined logs from all pods of a deployment)
    if cmd == "logcat" and len(tokens) > 1:
        query = tokens[1]
        flags = tokens[2:]
        return {
            "type": "logcat",
            "query": query,
            "follow": "--follow" in flags or "-f" in flags,
            "errors": "--errors" in flags,
            "watch": "watch" in flags or "--watch" in flags,
        }

    # Rollout
    if cmd == "rollout" and len(tokens) > 1:
        query = tokens[1]
        matches = resolve_deployment_name(query)
        if not matches:
            return {"type": "rollout", "target": query}
        dep = choose_deployment(matches)
        if not dep:
            return None
        return {"type": "rollout", "target": dep}

    # Rollback
    if cmd == "rollback" and len(tokens) > 1:
        query = tokens[1]
        matches = resolve_deployment_name(query)
        if not matches:
            return {"type": "rollback", "target": query}
        dep = choose_deployment(matches)
        if not dep:
            return None
        return {"type": "rollback", "target": dep}

    # Restart
    if cmd == "restart" and len(tokens) > 1:
        query = tokens[1]
        matches = resolve_deployment_name(query)
        if not matches:
            return {"type": "restart", "target": query}
        dep = choose_deployment(matches)
        if not dep:
            return None
        return {"type": "restart", "target": dep}

    # Scale
    if cmd == "scale" and len(tokens) > 2:
        query = tokens[1]
        matches = resolve_deployment_name(query)
        if not matches:
            return {"type": "scale", "target": query, "replicas": tokens[2]}
        dep = choose_deployment(matches)
        if not dep:
            return None
        return {"type": "scale", "target": dep, "replicas": tokens[2]}

    # Top (metrics)
    if cmd == "top" and len(tokens) > 1:
        if tokens[1] == "pods":
            return {"type": "top_pods"}
        if tokens[1] == "nodes":
            return {"type": "top_nodes"}

    # Diagnose
    if cmd == "diagnose" and len(tokens) > 1:
        query = tokens[1]
        matches = resolve_pod_name(query)
        if not matches:
            return None
        pod = choose_pod(matches)
        if not pod:
            return None
        return {"type": "diagnose", "target": pod}

    # Trace
    if cmd == "trace" and len(tokens) > 1:
        query = tokens[1]
        matches = resolve_deployment_name(query)
        if not matches:
            return {"type": "trace", "target": query}
        dep = choose_deployment(matches)
        if not dep:
            return None
        return {"type": "trace", "target": dep}

    # TUI
    if cmd == "tui" or cmd == "dashboard":
        return {"type": "tui"}

    # Plugins
    if cmd == "plugin" and len(tokens) > 1:
        return {
            "type": "plugin",
            "name": tokens[1]
        }

    if cmd == "plugins":
        return {"type": "plugins_list"}

    # Compare (multi-cluster)
    if cmd == "compare" and len(tokens) > 2:
        from core.context_switcher import find_context

        # Fuzzy resolve context names
        matches_a = find_context(tokens[1])
        matches_b = find_context(tokens[2])

        if not matches_a:
            return None
        if not matches_b:
            return None

        ctx_a = matches_a[0]
        ctx_b = matches_b[0]

        return {
            "type": "compare",
            "ctx_a": ctx_a["name"],
            "ctx_b": ctx_b["name"],
            "ns_a": ctx_a.get("namespace", "default"),
            "ns_b": ctx_b.get("namespace", "default"),
        }

    # Incident mode
    if cmd == "incident":
        if len(tokens) > 1:
            sub = tokens[1]
            if sub == "start":
                title = " ".join(tokens[2:]) if len(tokens) > 2 else ""
                return {
                    "type": "incident_start",
                    "title": title
                }
            if sub == "stop":
                return {"type": "incident_stop"}
            if sub == "status":
                return {"type": "incident_status"}
        return {"type": "incident_status"}

    if cmd == "note" and len(tokens) > 1:
        return {
            "type": "incident_note",
            "text": " ".join(tokens[1:])
        }

    if cmd == "snapshot":
        return {"type": "incident_snapshot"}

    # Help
    if cmd == "help":
        return {"type": "help"}

    # Find (global search)
    if cmd == "find" and len(tokens) > 1:
        return {
            "type": "find",
            "query": " ".join(tokens[1:])
        }

    # Namespace overview
    if cmd == "ns":
        return {"type": "ns_overview"}

    # Anomaly detection
    if cmd == "alerts" or cmd == "anomalies":
        return {"type": "alerts"}

    # Playbook
    if cmd == "playbook" and len(tokens) > 1:
        return {
            "type": "playbook",
            "issue": " ".join(tokens[1:])
        }

    # Correlate
    if cmd == "correlate":
        target = tokens[1] if len(tokens) > 1 else None
        return {
            "type": "correlate",
            "target": target
        }

    # Cost / optimization
    if cmd == "optimize" or cmd == "cost":
        return {"type": "optimize"}

    # Security scan
    if cmd == "security" or cmd == "scan":
        return {"type": "security"}

    # Unused resources
    if cmd == "unused" or cmd == "cleanup":
        return {"type": "unused"}

    # Health check
    if cmd == "check":
        return {"type": "check"}

    # Export report
    if cmd == "export":
        fmt = "md"
        if len(tokens) > 1 and tokens[1] == "json":
            fmt = "json"
        return {"type": "export", "format": fmt}

    # Audit log
    if cmd == "audit":
        return {"type": "audit"}

    # Network check
    if cmd == "netcheck" and len(tokens) > 1:
        query = tokens[1]
        matches = resolve_pod_name(query)
        if not matches:
            return None
        pod = choose_pod(matches)
        if not pod:
            return None
        return {"type": "netcheck", "target": pod}

    # CronJobs
    if cmd == "cronjobs":
        return {"type": "cronjobs"}

    # Jobs
    if cmd == "jobs":
        return {"type": "jobs"}

    # Trigger cronjob
    if cmd == "trigger" and len(tokens) > 1:
        query = tokens[1]
        matches = resolve_cronjob_name(query)
        if not matches:
            return {"type": "trigger", "target": query}
        cj = choose_cronjob(matches)
        if not cj:
            return None
        return {"type": "trigger", "target": cj}

    # ConfigMap viewer
    if cmd == "config" and len(tokens) > 1:
        return {
            "type": "configmap",
            "name": tokens[1]
        }

    # Secret viewer
    if cmd == "secret" and len(tokens) > 1:
        return {
            "type": "secret",
            "name": tokens[1]
        }

    # Deployment diff
    if cmd == "diff" and len(tokens) > 1:
        query = tokens[1]
        matches = resolve_deployment_name(query)
        if not matches:
            return {"type": "diff", "target": query}
        dep = choose_deployment(matches)
        if not dep:
            return None
        return {"type": "diff", "target": dep}

    # Port forward
    if cmd == "forward" and len(tokens) > 2:
        query = tokens[1]
        matches = resolve_pod_name(query)
        if not matches:
            return None
        pod = choose_pod(matches)
        if not pod:
            return None
        return {
            "type": "forward",
            "target": pod,
            "port": tokens[2]
        }

    # Explain
    if cmd == "explain" and len(tokens) > 1:
        return {
            "type": "explain",
            "query": " ".join(tokens[1:])
        }

    # Generate manifest
    if cmd == "generate" and len(tokens) > 2:
        return {
            "type": "generate",
            "kind": tokens[1],
            "name": tokens[2],
        }

    # HPA
    if cmd == "hpa":
        return {"type": "hpa"}

    # PDB
    if cmd == "pdb":
        return {"type": "pdb"}

    # Capacity
    if cmd == "capacity":
        return {"type": "capacity"}

    # Quota
    if cmd == "quota":
        return {"type": "quota"}

    # Drain check
    if cmd == "drain-check" and len(tokens) > 1:
        return {
            "type": "drain_check",
            "node": tokens[1]
        }

    # Bookmarks
    if cmd == "bookmark":
        if len(tokens) >= 4 and tokens[1] == "add":
            return {
                "type": "bookmark_add",
                "name": tokens[2],
                "command": " ".join(tokens[3:])
            }
        if len(tokens) >= 3 and tokens[1] == "rm":
            return {
                "type": "bookmark_rm",
                "name": tokens[2]
            }
        return {"type": "bookmarks_list"}

    if cmd == "bookmarks":
        return {"type": "bookmarks_list"}

    # Run bookmark
    if cmd == "run" and len(tokens) > 1:
        return {
            "type": "run_bookmark",
            "name": tokens[1]
        }

    # Workflows
    if cmd == "workflow" and len(tokens) > 1:
        return {
            "type": "workflow_run",
            "name": tokens[1]
        }

    if cmd == "workflows":
        return {"type": "workflows_list"}

    # Watch any command
    if cmd == "watch" and len(tokens) > 1:
        return {
            "type": "watch_cmd",
            "command": " ".join(tokens[1:])
        }

    # RBAC
    if cmd == "rbac":
        return {"type": "rbac"}

    # Shell into pod
    if cmd == "shell" and len(tokens) > 1:
        query = tokens[1]
        matches = resolve_pod_name(query)
        if not matches:
            return None
        pod = choose_pod(matches)
        if not pod:
            return None
        return {"type": "shell", "target": pod}

    # Timeline
    if cmd == "timeline":
        return {"type": "timeline"}

    # Labels
    if cmd == "labels" and len(tokens) > 1:
        # labels pods or labels pod/name
        parts = tokens[1].split("/")
        if len(parts) == 2:
            return {
                "type": "labels",
                "resource_type": parts[0],
                "name": parts[1]
            }
        return {
            "type": "labels",
            "resource_type": tokens[1],
            "name": tokens[2] if len(tokens) > 2 else None
        }

    # Apply YAML
    if cmd == "apply" and len(tokens) > 1:
        return {
            "type": "apply",
            "file": tokens[1]
        }

    # Snapshot state
    if cmd == "snap":
        return {"type": "snap"}

    # Snapshot diff
    if cmd == "snap-diff" or (
        cmd == "snapshot" and len(tokens) > 1
        and tokens[1] == "diff"
    ):
        return {"type": "snap_diff"}

    # Changelog
    if cmd == "changelog":
        return {"type": "changelog"}

    # Resource history
    if cmd == "history" and len(tokens) > 1:
        query = tokens[1]
        matches = resolve_pod_name(query)
        if not matches:
            return {
                "type": "resource_history",
                "name": query
            }
        pod = choose_pod(matches)
        if not pod:
            return None
        return {
            "type": "resource_history",
            "name": pod
        }

    # Mesh
    if cmd == "mesh":
        return {"type": "mesh"}

    # Ingress
    if cmd == "ingress":
        return {"type": "ingress"}

    # Dependencies
    if cmd == "deps" and len(tokens) > 1:
        query = tokens[1]
        matches = resolve_deployment_name(query)
        if not matches:
            return {"type": "deps", "target": query}
        dep = choose_deployment(matches)
        if not dep:
            return None
        return {"type": "deps", "target": dep}

    # DNS debug
    if cmd == "dns" and len(tokens) > 1:
        return {
            "type": "dns",
            "service": tokens[1]
        }

    # AI queries
    if cmd in ["why", "summarize", "summary"]:
        return {
            "type": "ai",
            "query": user_input
        }

    if user_input.startswith("what changed"):
        return {
            "type": "ai",
            "query": user_input
        }

    if user_input.startswith("what happened"):
        return {
            "type": "ai",
            "query": user_input
        }

    if user_input.startswith("which pods"):
        return {
            "type": "ai",
            "query": user_input
        }

    if user_input.startswith("is "):
        return {
            "type": "ai",
            "query": user_input
        }

    # Catch-all AI patterns
    ai_triggers = [
        "diagnose", "analyze", "investigate",
        "show warning", "show error",
        "any anomal", "any issue",
        "high restart", "crash",
        "what's wrong", "whats wrong",
        "cluster health", "resource consumer",
        "recently", "last hour",
    ]

    # Skip AI triggers for explicit commands
    skip_ai = {
        "watch-alert", "watch-status",
        "correlate-logs", "diff-timeline",
        "dep-health", "rollback-preview",
        "changes", "changelog", "uptime",
    }

    lower = user_input.lower()
    if cmd not in skip_ai:
        for trigger in ai_triggers:
            if trigger in lower:
                return {
                    "type": "ai",
                    "query": user_input
                }

    # Services
    if cmd == "services":
        return (
            f"kubectl --context {context.current_context} "
            f"get services "
            f"-n {context.namespace}"
        )

    # Nodes
    if cmd == "nodes":
        return (
            f"kubectl --context {context.current_context} "
            f"get nodes"
        )

    # Uptime
    if cmd == "uptime":
        return {"type": "uptime"}

    # Correlate logs
    if cmd == "correlate-logs" and len(tokens) > 1:
        return {
            "type": "correlate_logs",
            "pods": tokens[1:],
        }

    # Diff timeline
    if cmd in ("diff-timeline", "changes", "changelog"):
        hours = 24
        if len(tokens) > 1 and tokens[1].isdigit():
            hours = int(tokens[1])
        return {"type": "diff_timeline", "hours": hours}

    # Dependency health
    if cmd == "dep-health" and len(tokens) > 1:
        return {
            "type": "dep_health",
            "target": tokens[1],
        }

    # Rollback preview
    if cmd == "rollback-preview" and len(tokens) > 1:
        return {
            "type": "rollback_preview",
            "target": tokens[1],
        }

    # Watch alert
    if cmd == "watch-alert" and len(tokens) > 1:
        return {
            "type": "watch_alert",
            "target": tokens[1],
            "condition": tokens[2] if len(tokens) > 2 else "crash",
        }

    # Watch status
    if cmd == "watch-status":
        return {"type": "watch_status"}

    # Scorecard
    if cmd == "scorecard":
        return {"type": "scorecard"}

    # Cost estimate
    if cmd == "cost-estimate":
        return {"type": "cost_estimate"}

    # Auto-remediate
    if cmd == "fix" and len(tokens) > 1:
        return {"type": "remediate", "target": tokens[1]}

    # YAML diff
    if cmd == "yaml-diff" and len(tokens) > 1:
        return {"type": "yaml_diff", "target": tokens[1]}

    # Save query
    if cmd == "pin" and len(tokens) > 1:
        return {
            "type": "save_query",
            "name": tokens[1],
            "query": " ".join(tokens[2:]) if len(tokens) > 2 else "",
        }

    # List saved queries
    if cmd == "pins":
        return {"type": "list_queries"}

    # describe <resource> <name>
    if cmd == "describe":
        if len(tokens) < 3:
            return None
        resource = tokens[1]
        query = tokens[2]
        # Pod describe → reuse inspect
        pod_types = {"pod", "pods", "po"}
        if resource in pod_types:
            matches = resolve_pod_name(query)
            if not matches:
                return None
            pod = choose_pod(matches)
            if not pod:
                return None
            return {"type": "inspect", "target": pod}
        # Deployment describe → full describe with containers
        deploy_types = {"deployment", "deployments", "deploy"}
        if resource in deploy_types:
            matches = resolve_deployment_name(query)
            if not matches:
                return None
            dep = choose_deployment(matches)
            if not dep:
                return None
            kubectl_cmd = (
                f"kubectl --context {context.current_context} "
                f"describe deployment {dep} "
                f"-n {context.namespace}"
            )
            return {"type": "kubectl_pretty", "cmd": kubectl_cmd}
        # Other resources → pretty kubectl
        resolved = _resolve_kubectl_resource(
            "describe", tokens[1:]
        )
        if resolved:
            return {"type": "kubectl_pretty", "cmd": resolved}
        return None

    # get <resource> [name]
    if cmd == "get" and len(tokens) > 1:
        resource = tokens[1]
        # get pods → reuse pods table
        pod_types = {"pod", "pods", "po"}
        deploy_types = {"deployment", "deployments", "deploy"}
        if resource in pod_types and len(tokens) == 2:
            return {"type": "pods_table"}
        # get deployments → reuse deployments handler
        if resource in deploy_types and len(tokens) == 2:
            return {"type": "kubectl_pretty", "cmd": (
                f"kubectl --context {context.current_context} "
                f"get deployments -n {context.namespace}"
            )}
        # get <resource> <name> → pretty kubectl
        resolved = _resolve_kubectl_resource(
            "get", tokens[1:]
        )
        if resolved:
            return {"type": "kubectl_pretty", "cmd": resolved}
        return None

    # delete <resource> <name>
    if cmd == "delete" and len(tokens) > 1:
        resolved = _resolve_kubectl_resource(
            "delete", tokens[1:]
        )
        if resolved:
            return {"type": "kubectl_pretty", "cmd": resolved}
        return None

    # edit <resource> <name>
    if cmd == "edit" and len(tokens) > 1:
        resolved = _resolve_kubectl_resource(
            "edit", tokens[1:]
        )
        if resolved:
            return resolved  # raw string, needs interactive tty

    # port-forward <pod> <ports>
    if cmd == "port-forward" and len(tokens) > 1:
        query = tokens[1]
        matches = resolve_pod_name(query)
        if not matches:
            return None
        pod = choose_pod(matches)
        if not pod:
            return None
        ports = " ".join(tokens[2:]) if len(tokens) > 2 else "8080:8080"
        return (
            f"kubectl --context {context.current_context} "
            f"port-forward {pod} {ports} "
            f"-n {context.namespace}"
        )

    # exec <pod> [-- command]
    if cmd == "exec" and len(tokens) > 1:
        query = tokens[1]
        matches = resolve_pod_name(query)
        if not matches:
            return None
        pod = choose_pod(matches)
        if not pod:
            return None
        extra = " ".join(tokens[2:]) if len(tokens) > 2 else "-- /bin/sh"
        return (
            f"kubectl --context {context.current_context} "
            f"exec -it {pod} -n {context.namespace} {extra}"
        )

    # cp <pod>:<path> <local> or <local> <pod>:<path>
    if cmd == "cp" and len(tokens) > 2:
        return (
            f"kubectl --context {context.current_context} "
            f"cp {' '.join(tokens[1:])} "
            f"-n {context.namespace}"
        )

    # Raw kubectl passthrough
    if cmd == "kubectl":
        return " ".join(tokens)

    return None


def _resolve_kubectl_resource(action, args):
    """Resolve kubectl <action> <resource> <name> with fuzzy matching."""
    if not args:
        return None

    resource = args[0]
    name = args[1] if len(args) > 1 else None
    extra = " ".join(args[2:]) if len(args) > 2 else ""

    ctx = context.current_context
    ns = context.namespace

    # Resources that are namespace-scoped
    ns_flag = f"-n {ns}"
    # Cluster-scoped resources
    cluster_resources = {
        "node", "nodes", "no",
        "namespace", "namespaces", "ns",
        "clusterrole", "clusterroles",
        "clusterrolebinding", "clusterrolebindings",
        "pv", "persistentvolumes",
    }

    if resource in cluster_resources:
        ns_flag = ""

    # Fuzzy resolve name for pod-like resources
    pod_types = {"pod", "pods", "po"}
    deploy_types = {"deployment", "deployments", "deploy"}
    cronjob_types = {"cronjob", "cronjobs", "cj"}

    if name:
        if resource in pod_types:
            matches = resolve_pod_name(name)
            if matches:
                name = choose_pod(matches)
                if not name:
                    return None
        elif resource in deploy_types:
            matches = resolve_deployment_name(name)
            if matches:
                name = choose_deployment(matches)
                if not name:
                    return None
        elif resource in cronjob_types:
            matches = resolve_cronjob_name(name)
            if matches:
                name = choose_cronjob(matches)
                if not name:
                    return None

    parts = [
        f"kubectl --context {ctx}",
        action,
        resource,
    ]
    if name:
        parts.append(name)
    if ns_flag:
        parts.append(ns_flag)
    if extra:
        parts.append(extra)

    return " ".join(parts)
