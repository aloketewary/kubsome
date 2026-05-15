from fastapi import APIRouter, Query
from fastapi.responses import StreamingResponse

from core.context import context
from core.collectors.logs import fetch_logs, stream_logs, fetch_containers

router = APIRouter(tags=["logs"])


@router.get("/logs/{pod}/containers")
def get_containers(pod: str):
    containers = fetch_containers(pod)
    return {"pod": pod, "containers": containers}


@router.get("/logs/{pod}")
def get_logs(
    pod: str,
    tail: int = Query(100, ge=1, le=5000),
    errors: bool = False,
    previous: bool = False,
    container: str = Query(None),
    since: str = Query(None),
    regex: str = Query(None),
):
    lines = fetch_logs(
        pod, tail=tail, previous=previous,
        errors_only=errors, container=container,
        since=since, regex=regex,
    )
    return {
        "pod": pod,
        "namespace": context.namespace,
        "container": container,
        "lines": lines,
        "count": len(lines),
        "filters": {
            "since": since,
            "regex": regex,
            "errors_only": errors,
        },
    }


@router.get("/logs/{pod}/stream")
def get_logs_stream(pod: str, container: str = Query(None)):
    def generate():
        process = stream_logs(pod, container=container)
        try:
            for line in process.stdout:
                yield line
        finally:
            process.kill()

    return StreamingResponse(generate(), media_type="text/plain")
