"""
Action Mapper — translates parsed intents into
Kubsome command dicts for execution.

Architecture:
  Intent + Entities → Command Dict → Dispatcher
"""


def map_to_command(parsed):
    """
    Convert a parsed NLP result into a command dict
    that the dispatcher can execute.
    Returns command string or command dict, or None.
    """
    if not parsed:
        return None

    intent = parsed["intent"]
    entities = parsed.get("entities", {})
    target = entities.get("target")

    # Observe
    if intent == "show_pods":
        return {"type": "pods_table"}

    if intent == "overview":
        return {"type": "overview"}

    if intent == "events":
        return {"type": "events"}

    if intent == "top_pods":
        return {"type": "top_pods"}

    if intent == "top_nodes":
        return {"type": "top_nodes"}

    if intent == "show_nodes":
        return {"type": "nodes"}

    if intent == "show_services":
        return "services"

    if intent == "switch_context":
        ctx = entities.get("context")
        return f"switch {ctx}" if ctx else None

    if intent == "use_namespace":
        ns = entities.get("namespace")
        return f"use {ns}" if ns else None

    # Diagnose
    if intent == "diagnose" and target:
        return f"diagnose {target}"

    if intent == "inspect" and target:
        return f"inspect {target}"

    if intent == "trace" and target:
        return f"trace {target}"

    if intent == "netcheck" and target:
        return f"netcheck {target}"

    # Operate
    if intent == "logs" and target:
        return f"logs {target}"

    if intent == "restart" and target:
        return f"restart {target}"

    if intent == "scale" and target:
        replicas = entities.get("replicas", 3)
        return f"scale {target} {replicas}"

    if intent == "rollback" and target:
        return f"rollback {target}"

    if intent == "rollout" and target:
        return f"rollout {target}"

    if intent == "describe" and target:
        return f"describe pod {target}"

    if intent == "exec" and target:
        return f"exec {target}"

    if intent == "delete" and target:
        return f"delete pod {target}"

    if intent == "port_forward" and target:
        port = entities.get("port", "8080")
        return f"port-forward {target} {port}:{port}"

    # AI / Analysis
    if intent == "summarize":
        return {"type": "ai", "query": parsed["raw_query"]}

    if intent == "why_failing":
        return {"type": "ai", "query": parsed["raw_query"]}

    if intent == "count_pods":
        return {"type": "ai", "query": parsed["raw_query"]}

    if intent == "unhealthy":
        return {"type": "ai", "query": parsed["raw_query"]}

    if intent == "anomalies":
        return {"type": "alerts"}

    if intent == "what_changed":
        return {"type": "ai", "query": parsed["raw_query"]}

    if intent == "correlate":
        return {
            "type": "correlate",
            "target": target,
        }

    if intent == "is_safe":
        return {"type": "ai", "query": parsed["raw_query"]}

    if intent == "health_check":
        if target:
            return {
                "type": "ai",
                "query": parsed["raw_query"],
            }
        return {"type": "check"}

    # Security & Cost
    if intent == "security":
        return {"type": "security"}

    if intent == "optimize":
        return {"type": "optimize"}

    if intent == "unused":
        return {"type": "unused"}

    # Operations
    if intent == "apply":
        return None  # needs file path

    # Incident
    if intent == "incident_start":
        return {"type": "incident_start", "title": ""}

    if intent == "incident_stop":
        return {"type": "incident_stop"}

    # New features
    if intent == "correlate_logs" and target:
        return f"correlate {target}"

    if intent == "diff_timeline":
        return {"type": "diff_timeline", "hours": 24}

    if intent == "dep_health" and target:
        return f"dep-health {target}"

    if intent == "rollback_preview" and target:
        return f"rollback-preview {target}"

    if intent == "watch_alert" and target:
        return f"watch-alert {target} crash"

    return None
