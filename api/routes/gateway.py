from fastapi import APIRouter

from core.context import context
from core.collectors.gateway_monitor import collect_gateway_monitor

router = APIRouter(tags=["gateway"])


@router.get("/gateway-monitor")
def get_gateway_monitor():
    return {
        "context": context.current_context,
        "namespace": context.namespace,
        "entries": collect_gateway_monitor(),
    }
