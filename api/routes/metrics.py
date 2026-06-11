from fastapi import APIRouter

from core.collectors.metrics import top_pods, top_nodes, node_workloads
from core.context import context

router = APIRouter(tags=["metrics"])


@router.get("/top/pods")
def get_top_pods():
    return {
        "context": context.current_context,
        "namespace": context.namespace,
        "pods": top_pods(),
    }


@router.get("/top/nodes")
def get_top_nodes():
    return {
        "context": context.current_context,
        "nodes": top_nodes(),
    }


@router.get("/nodes/workloads")
def get_node_workloads():
    """Pods grouped by node with deployment labels."""
    return {
        "context": context.current_context,
        "namespace": context.namespace,
        "nodes": node_workloads(),
    }

@router.get("/top/pods/specs")
def get_pod_specs():
    from core.collectors.metrics import pod_resource_specs
    return {"specs": pod_resource_specs()}
