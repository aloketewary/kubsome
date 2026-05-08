from fastapi import APIRouter

from core.collectors.metrics import top_pods, top_nodes
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
