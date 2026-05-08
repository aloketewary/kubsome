from fastapi import APIRouter

from core.collectors.pods import collect_pods
from core.context import context

router = APIRouter(tags=["pods"])


@router.get("/pods")
def get_pods():
    pods = collect_pods()
    return {
        "context": context.current_context,
        "namespace": context.namespace,
        "pods": pods,
    }
