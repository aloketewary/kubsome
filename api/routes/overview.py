from fastapi import APIRouter
from concurrent.futures import ThreadPoolExecutor

from core.collectors.pods import collect_pods
from core.collectors.nodes import collect_nodes
from core.collectors.deployments import collect_deployments
from core.context import context

router = APIRouter(tags=["overview"])


@router.get("/overview")
def get_overview():
    with ThreadPoolExecutor(max_workers=3) as executor:
        f_pods = executor.submit(collect_pods)
        f_nodes = executor.submit(collect_nodes)
        f_deps = executor.submit(collect_deployments)

        pods = f_pods.result()
        nodes = f_nodes.result()
        deployments = f_deps.result()

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

    return {
        "context": context.current_context,
        "namespace": context.namespace,
        "pods": pod_health,
        "nodes": node_health,
        "deployments": dep_health,
    }


@router.get("/overview/{ctx}/{ns}")
def get_overview_for(ctx: str, ns: str, app: str = None):
    """Get overview for a specific context/namespace, optionally filtered by app."""
    from core.k8s import get_raw_resources

    # Parallelize resource fetching to reduce latency and leverage unified cache
    with ThreadPoolExecutor(max_workers=4) as executor:
        f_pods = executor.submit(
            get_raw_resources, "pods", ctx, ns,
            selector=f"app={app}" if app else None
        )
        f_events = executor.submit(
            get_raw_resources, "events", ctx, ns,
            field_selector="involvedObject.kind=Pod" if app else None,
            sort_by=".lastTimestamp"
        )

        if app:
            f_app = executor.submit(get_raw_resources, f"deployment/{app}", ctx, ns)
            f_nodes = None
            f_deps = None
        else:
            f_app = None
            f_nodes = executor.submit(get_raw_resources, "nodes", ctx)
            f_deps = executor.submit(get_raw_resources, "deployments", ctx, ns)

        pods = f_pods.result().get("items", [])
        events_items = f_events.result().get("items", [])

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
        dep = f_app.result()
        app_info = {}
        if dep and "metadata" in dep:
            desired = dep.get("spec", {}).get("replicas", 0)
            available = dep.get("status", {}).get("availableReplicas", 0)
            app_info = {
                "desired": desired,
                "available": available,
                "ready": dep.get("status", {}).get("readyReplicas", 0),
                "image": (dep.get("spec", {}).get("template", {}).get("spec", {}).get("containers", [{}])[0].get("image", "")),
            }

        # Events filtered to app pods
        events = []
        for item in events_items[-50:]:
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

    # Cluster/namespace level
    nodes = f_nodes.result().get("items", [])
    node_health = {
        "healthy": sum(1 for n in nodes if any(c["type"] == "Ready" and c["status"] == "True" for c in n["status"].get("conditions", []))),
        "warning": sum(1 for n in nodes if not any(c["type"] == "Ready" and c["status"] == "True" for c in n["status"].get("conditions", []))),
        "critical": 0, "unavailable": 0,
    }

    deps = f_deps.result().get("items", [])
    dep_health = {
        "healthy": sum(1 for d in deps if d["status"].get("availableReplicas", 0) >= d["spec"].get("replicas", 1)),
        "unavailable": sum(1 for d in deps if d["status"].get("availableReplicas", 0) < d["spec"].get("replicas", 1)),
        "warning": 0, "critical": 0,
    }

    events = []
    for item in events_items[-50:]:
        events.append({
            "type": item.get("type", "Normal"),
            "reason": item.get("reason", ""),
            "object": item.get("involvedObject", {}).get("name", ""),
            "message": item.get("message", ""),
        })

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
