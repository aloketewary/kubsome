from fastapi import APIRouter, Query
from fastapi.responses import StreamingResponse

from core.context import context
from core.collectors.logs import fetch_logs, stream_logs

router = APIRouter(tags=["logs"])


@router.get("/logs/{pod}")
def get_logs(
    pod: str,
    tail: int = Query(100, ge=1, le=5000),
    errors: bool = False,
    previous: bool = False,
):
    lines = fetch_logs(pod, tail=tail, previous=previous, errors_only=errors)
    return {
        "pod": pod,
        "namespace": context.namespace,
        "lines": lines,
        "count": len(lines),
    }


@router.get("/logs/{pod}/stream")
def get_logs_stream(pod: str):
    def generate():
        process = stream_logs(pod)
        try:
            for line in process.stdout:
                yield line
        finally:
            process.kill()

    return StreamingResponse(generate(), media_type="text/plain")
