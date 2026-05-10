from fastapi import APIRouter

from core.collectors.pods import collect_pods
from core.collectors.nodes import collect_nodes
from core.collectors.deployments import collect_deployments
from core.context import context

router = APIRouter(tags=["overview"])


@router.get("/overview")
def get_overview():
    pods = collect_pods()
    nodes = collect_nodes()
    deployments = collect_deployments()

    pod_health = {
        "healthy": sum(1 for p in pods if p["status"] == "Running"),
        "warning": sum(1 for p in pods if p["restarts"] > 5),
        "critical": sum(1 for p in pods if p["status"] in ("CrashLoopBackOff", "Error", "Failed")),
    }

    node_health = {
        "healthy": sum(1 for n in nodes if n["ready"]),
        "warning": sum(1 for n in nodes if not n["ready"]),
        "critical": 0,
        "unavailable": 0,
    }

    dep_health = {
        "healthy": sum(1 for d in deployments if d["available"] == d["desired"]),
        "warning": 0,
        "critical": 0,
        "unavailable": sum(1 for d in deployments if d["available"] < d["desired"]),
    }

    return {
        "context": context.current_context,
        "namespace": context.namespace,
        "pods": pod_health,
        "nodes": node_health,
        "deployments": dep_health,
    }


@router.get("/overview/{ctx}/{ns}")
def get_overview_for(ctx: str, ns: str):
    """Get overview for a specific context/namespace without switching global state."""
    import subprocess
    import json

    # Pods
    r = subprocess.run(["kubectl", "--context", ctx, "get", "pods", "-n", ns, "-o", "json"], capture_output=True, text=True)
    pods = []
    if r.returncode == 0:
        pods = json.loads(r.stdout).get("items", [])

    pod_health = {
        "healthy": sum(1 for p in pods if p["status"].get("phase") == "Running"),
        "warning": sum(1 for p in pods if sum(cs.get("restartCount", 0) for cs in p["status"].get("containerStatuses", [])) > 5),
        "critical": sum(1 for p in pods if p["status"].get("phase") in ("CrashLoopBackOff", "Error", "Failed")),
        "unavailable": 0,
    }

    # Nodes
    r = subprocess.run(["kubectl", "--context", ctx, "get", "nodes", "-o", "json"], capture_output=True, text=True)
    nodes = []
    if r.returncode == 0:
        nodes = json.loads(r.stdout).get("items", [])

    node_health = {
        "healthy": sum(1 for n in nodes if any(c["type"] == "Ready" and c["status"] == "True" for c in n["status"].get("conditions", []))),
        "warning": sum(1 for n in nodes if not any(c["type"] == "Ready" and c["status"] == "True" for c in n["status"].get("conditions", []))),
        "critical": 0, "unavailable": 0,
    }

    # Deployments
    r = subprocess.run(["kubectl", "--context", ctx, "get", "deployments", "-n", ns, "-o", "json"], capture_output=True, text=True)
    deps = []
    if r.returncode == 0:
        deps = json.loads(r.stdout).get("items", [])

    dep_health = {
        "healthy": sum(1 for d in deps if d["status"].get("availableReplicas", 0) >= d["spec"].get("replicas", 1)),
        "unavailable": sum(1 for d in deps if d["status"].get("availableReplicas", 0) < d["spec"].get("replicas", 1)),
        "warning": 0, "critical": 0,
    }

    # Events
    r = subprocess.run(["kubectl", "--context", ctx, "get", "events", "-n", ns, "--sort-by=.lastTimestamp", "-o", "json"], capture_output=True, text=True)
    events = []
    if r.returncode == 0:
        for item in json.loads(r.stdout).get("items", [])[-50:]:
            events.append({
                "type": item.get("type", "Normal"),
                "reason": item.get("reason", ""),
                "object": item.get("involvedObject", {}).get("name", ""),
                "message": item.get("message", ""),
            })

    return {
        "context": ctx, "namespace": ns,
        "pods": pod_health, "nodes": node_health, "deployments": dep_health,
        "events": events,
    }


@router.get("/uptime")
def get_uptime():
    from core.collectors.uptime import collect_uptime
    return collect_uptime()


@router.get("/diff-timeline")
def get_diff_timeline(hours: int = 24):
    from core.collectors.diff_timeline import collect_diff_timeline
    return collect_diff_timeline(hours)


@router.post("/correlate-logs")
def post_correlate_logs(req: dict):
    from core.collectors.log_correlation import correlate_logs
    pods = req.get("pods", [])
    tail = req.get("tail", 50)
    if not pods:
        return {"error": "No pods specified"}
    return correlate_logs(pods, tail)


@router.get("/dep-health/{name}")
def get_dep_health(name: str):
    from core.collectors.dep_health import dependency_health
    return dependency_health(name)


@router.get("/rollback-preview/{name}")
def get_rollback_preview(name: str):
    from core.collectors.rollback_preview import rollback_preview
    return rollback_preview(name)


@router.get("/watch-status")
def get_watch_status():
    from core.watch_alert import get_watcher
    return get_watcher().status()


@router.get("/scorecard")
def get_scorecard():
    from core.collectors.scorecard import cluster_scorecard
    return cluster_scorecard()


@router.get("/cost-estimate")
def get_cost_estimate():
    from core.collectors.cost_estimate import estimate_costs
    return estimate_costs()


@router.post("/remediate/{pod}")
def post_remediate(pod: str):
    from core.remediation import auto_remediate
    return auto_remediate(pod)


@router.get("/yaml-diff/{name}")
def get_yaml_diff(name: str, rev_a: int = None, rev_b: int = None):
    from core.collectors.yaml_diff import yaml_diff
    return yaml_diff(name, rev_a, rev_b)


@router.get("/saved-queries")
def get_saved_queries():
    from core.saved_queries import list_queries
    return {"queries": list_queries()}


@router.post("/saved-queries")
def post_saved_query(req: dict):
    from core.saved_queries import save_query
    name = req.get("name", "")
    query = req.get("query", "")
    interval = req.get("interval", 300)
    if not name or not query:
        from fastapi import HTTPException
        raise HTTPException(400, "name and query required")
    return save_query(name, query, interval)


@router.delete("/saved-queries/{name}")
def delete_saved_query(name: str):
    from core.saved_queries import remove_query
    if not remove_query(name):
        from fastapi import HTTPException
        raise HTTPException(404, "Query not found")
    return {"deleted": name}
