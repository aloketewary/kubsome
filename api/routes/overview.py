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
