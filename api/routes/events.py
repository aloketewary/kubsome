from fastapi import APIRouter

from core.collectors.events import collect_events
from core.context import context

router = APIRouter(tags=["events"])


@router.get("/events")
def get_events(limit: int = 50):
    events = collect_events(limit=limit)
    return {
        "context": context.current_context,
        "namespace": context.namespace,
        "events": events,
    }
