from fastapi import APIRouter, Query
from typing import Optional

from core.collectors.pods import collect_pods
from core.context import context

router = APIRouter(tags=["pods"])


@router.get("/pods")
def get_pods(
    page: int = Query(1, ge=1),
    size: int = Query(50, ge=0),
    search: Optional[str] = None,
):
    pods = collect_pods()

    # Filter by search query
    if search:
        q = search.lower()
        pods = [p for p in pods if q in p["name"].lower()]

    total = len(pods)

    # Paginate (size=0 means return all)
    if size > 0:
        start = (page - 1) * size
        pods = pods[start:start + size]

    return {
        "context": context.current_context,
        "namespace": context.namespace,
        "pods": pods,
        "total": total,
        "page": page,
        "size": size,
    }
