from fastapi import APIRouter
from concurrent.futures import ThreadPoolExecutor

from core.collectors.pods import collect_pods
from core.collectors.nodes import collect_nodes
from core.collectors.deployments import collect_deployments
from core.collectors.cost import resource_recommendations
from core.context import context

router = APIRouter(tags=["overview"])


@router.get("/overview")
def get_overview():
    with ThreadPoolExecutor(max_workers=4) as executor:
        f_pods = executor.submit(collect_pods)
        f_nodes = executor.submit(collect_nodes)
        f_deps = executor.submit(collect_deployments)
        f_recs = executor.submit(resource_recommendations)

        pods = f_pods.result()
        nodes = f_nodes.result()
        deployments = f_deps.result()
        recs = f_recs.result()

    healthy_statuses = {"Running", "Succeeded", "Completed"}
    pod_health = {
        "healthy": sum(1 for p in pods if p["status"] in healthy_statuses),
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

    # Growth: pick top recommendation
    top_rec = recs[0] if recs else None

    return {
        "context": context.current_context,
        "namespace": context.namespace,
        "pods": pod_health,
        "nodes": node_health,
        "deployments": dep_health,
        "top_recommendation": top_rec,
    }


@router.get("/overview/{ctx}/{ns}")
def get_overview_for(ctx: str, ns: str, app: str = None):
    """Get overview for a specific context/namespace, optionally filtered by app."""
    import subprocess
    import json

    # Pods
    cmd = ["kubectl", "--context", ctx, "get", "pods", "-n", ns, "-o", "json"]
    if app:
        cmd += ["-l", f"app={app}"]
    r = subprocess.run(cmd, capture_output=True, text=True)
    pods = []
    if r.returncode == 0:
        pods = json.loads(r.stdout).get("items", [])

    total_restarts = 0
    for p in pods:
        for cs in p["status"].get("containerStatuses", []):
            total_restarts += cs.get("restartCount", 0)

    pod_health = {
        "healthy": sum(1 for p in pods if p["status"].get("phase") == "Running"),
        "warning": sum(1 for p in pods if sum(cs.get("restartCount", 0) for cs in p["status"].get("containerStatuses", [])) > 5),
        "critical": sum(1 for p in pods if p["status"].get("phase") in ("CrashLoopBackOff", "Error", "Failed")),
        "unavailable": 0,
        "total": len(pods),
        "restarts": total_restarts,
    }

    # App-specific: get deployment replicas
    if app:
        r = subprocess.run(
            ["kubectl", "--context", ctx, "get", "deployment", app, "-n", ns, "-o", "json"],
            capture_output=True, text=True
        )
        app_info = {}
        if r.returncode == 0:
            dep = json.loads(r.stdout)
            desired = dep.get("spec", {}).get("replicas", 0)
            available = dep.get("status", {}).get("availableReplicas", 0)
            app_info = {
                "desired": desired,
                "available": available,
                "ready": dep.get("status", {}).get("readyReplicas", 0),
                "image": (dep.get("spec", {}).get("template", {}).get("spec", {}).get("containers", [{}])[0].get("image", "")),
            }

        # Events filtered to app pods
        r = subprocess.run(
            ["kubectl", "--context", ctx, "get", "events", "-n", ns,
             "--field-selector", f"involvedObject.kind=Pod",
             "--sort-by=.lastTimestamp", "-o", "json"],
            capture_output=True, text=True
        )
        events = []
        if r.returncode == 0:
            for item in json.loads(r.stdout).get("items", [])[-50:]:
                obj_name = item.get("involvedObject", {}).get("name", "")
                if app.lower() in obj_name.lower():
                    events.append({
                        "type": item.get("type", "Normal"),
                        "reason": item.get("reason", ""),
                        "object": obj_name,
                        "message": item.get("message", ""),
                    })

        return {
            "context": ctx, "namespace": ns, "app": app,
            "mode": "app",
            "pods": pod_health,
            "app_info": app_info,
            "events": events,
        }

    # Cluster/namespace level — parallel fetch
    from concurrent.futures import ThreadPoolExecutor

    def _get_nodes():
        r = subprocess.run(["kubectl", "--context", ctx, "get", "nodes", "-o", "json"], capture_output=True, text=True)
        return json.loads(r.stdout).get("items", []) if r.returncode == 0 else []

    def _get_deps():
        r = subprocess.run(["kubectl", "--context", ctx, "get", "deployments", "-n", ns, "-o", "json"], capture_output=True, text=True)
        return json.loads(r.stdout).get("items", []) if r.returncode == 0 else []

    def _get_events():
        r = subprocess.run(["kubectl", "--context", ctx, "get", "events", "-n", ns, "--sort-by=.lastTimestamp", "-o", "json"], capture_output=True, text=True)
        if r.returncode != 0:
            return []
        return [
            {"type": i.get("type", "Normal"), "reason": i.get("reason", ""), "object": i.get("involvedObject", {}).get("name", ""), "message": i.get("message", "")}
            for i in json.loads(r.stdout).get("items", [])[-50:]
        ]

    with ThreadPoolExecutor(max_workers=3) as ex:
        nodes = ex.submit(_get_nodes).result()
        deps = ex.submit(_get_deps).result()
        events = ex.submit(_get_events).result()

    node_health = {
        "healthy": sum(1 for n in nodes if any(c["type"] == "Ready" and c["status"] == "True" for c in n["status"].get("conditions", []))),
        "warning": sum(1 for n in nodes if not any(c["type"] == "Ready" and c["status"] == "True" for c in n["status"].get("conditions", []))),
        "critical": 0, "unavailable": 0,
    }

    dep_health = {
        "healthy": sum(1 for d in deps if d["status"].get("availableReplicas", 0) >= d["spec"].get("replicas", 1)),
        "unavailable": sum(1 for d in deps if d["status"].get("availableReplicas", 0) < d["spec"].get("replicas", 1)),
        "warning": 0, "critical": 0,
    }

    return {
        "context": ctx, "namespace": ns,
        "mode": "cluster",
        "pods": pod_health, "nodes": node_health, "deployments": dep_health,
        "events": events,
    }


@router.get("/list-apps/{ctx}/{ns}")
def get_apps_for(ctx: str, ns: str):
    """List deployments for a specific context/namespace."""
    import subprocess
    import json
    r = subprocess.run(
        ["kubectl", "--context", ctx, "get", "deployments", "-n", ns, "-o", "json"],
        capture_output=True, text=True
    )
    if r.returncode != 0:
        return {"deployments": []}
    items = json.loads(r.stdout).get("items", [])
    return {
        "deployments": [
            {"name": d["metadata"]["name"]}
            for d in items
        ]
    }


@router.get("/monitor/apps")
def get_monitor_apps(ctx: str = "", ns: str = ""):
    """List deployments using query params (handles special chars in context)."""
    import subprocess
    import json
    if not ctx or not ns:
        return {"deployments": []}
    r = subprocess.run(
        ["kubectl", "--context", ctx, "get", "deployments", "-n", ns, "-o", "json"],
        capture_output=True, text=True
    )
    if r.returncode != 0:
        return {"deployments": []}
    items = json.loads(r.stdout).get("items", [])
    return {
        "deployments": [
            {"name": d["metadata"]["name"]}
            for d in items
        ]
    }


@router.get("/monitor/overview")
def get_monitor_overview(ctx: str = "", ns: str = "", app: str = ""):
    """Monitor overview using query params (handles special chars)."""
    if not ctx or not ns:
        return {"error": "ctx and ns required"}
    return get_overview_for(ctx, ns, app or None)


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


@router.post("/watch-alert")
def post_watch_alert(req: dict):
    from core.watch_alert import (
        get_watcher, pod_crash_condition,
        pod_restart_condition, pod_count_condition
    )

    target = req.get("target", "")
    condition = req.get("condition", "crash")

    if not target:
        from fastapi import HTTPException
        raise HTTPException(400, "target required")

    watcher = get_watcher()
    conditions = {
        "crash": pod_crash_condition(target),
        "restart": pod_restart_condition(target, 5),
        "count": pod_count_condition(target, 1),
    }

    check_fn = conditions.get(condition, conditions["crash"])
    name = f"{target}-{condition}"
    watcher.add(name, check_fn, interval=30)
    watcher.start()

    return {
        "added": name,
        "condition": condition,
        "target": target,
    }


@router.delete("/watch-alert/{name}")
def delete_watch_alert(name: str):
    from core.watch_alert import get_watcher
    get_watcher().remove(name)
    return {"removed": name}
