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
    r = subprocess.run(f"kubectl --context {ctx} get pods -n {ns} -o json", shell=True, capture_output=True, text=True)
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
    r = subprocess.run(f"kubectl --context {ctx} get nodes -o json", shell=True, capture_output=True, text=True)
    nodes = []
    if r.returncode == 0:
        nodes = json.loads(r.stdout).get("items", [])

    node_health = {
        "healthy": sum(1 for n in nodes if any(c["type"] == "Ready" and c["status"] == "True" for c in n["status"].get("conditions", []))),
        "warning": sum(1 for n in nodes if not any(c["type"] == "Ready" and c["status"] == "True" for c in n["status"].get("conditions", []))),
        "critical": 0, "unavailable": 0,
    }

    # Deployments
    r = subprocess.run(f"kubectl --context {ctx} get deployments -n {ns} -o json", shell=True, capture_output=True, text=True)
    deps = []
    if r.returncode == 0:
        deps = json.loads(r.stdout).get("items", [])

    dep_health = {
        "healthy": sum(1 for d in deps if d["status"].get("availableReplicas", 0) >= d["spec"].get("replicas", 1)),
        "unavailable": sum(1 for d in deps if d["status"].get("availableReplicas", 0) < d["spec"].get("replicas", 1)),
        "warning": 0, "critical": 0,
    }

    # Events
    r = subprocess.run(f"kubectl --context {ctx} get events -n {ns} --sort-by=.lastTimestamp -o json", shell=True, capture_output=True, text=True)
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
