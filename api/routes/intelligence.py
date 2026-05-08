from fastapi import APIRouter, Query
from pydantic import BaseModel

from core.collectors.search import search_resources
from core.collectors.security import security_scan
from core.collectors.cost import resource_recommendations, find_unused_resources
from core.healthcheck import run_health_check
from core.ai.engine import handle_ai_query
from core.ai.anomaly import detect_anomalies

router = APIRouter(tags=["intelligence"])


class AiRequest(BaseModel):
    query: str


@router.get("/search")
def get_search(q: str = Query(..., min_length=1)):
    results = search_resources(q)
    return {"query": q, "results": results}


@router.get("/security")
def get_security():
    findings = security_scan()
    return {"findings": findings}


@router.get("/health-check")
def get_health_check():
    return run_health_check()


@router.get("/anomalies")
def get_anomalies():
    alerts = detect_anomalies()
    return {"alerts": alerts}


@router.get("/optimize")
def get_optimize():
    recs = resource_recommendations()
    return {"recommendations": recs}


@router.get("/unused")
def get_unused():
    return {"resources": find_unused_resources()}


@router.post("/ai")
def post_ai(req: AiRequest):
    import re
    from core.resolver import resolve_pod_name

    # Check if query references an ambiguous resource
    clarification = _check_ambiguity(req.query)
    if clarification:
        return clarification

    response = handle_ai_query(req.query)
    # Strip Rich markup tags for API consumers
    content = response.get("content", "")
    content = re.sub(r'\[/?[^\]]+\]', '', content)
    return {
        "title": response.get("title", "").replace("🤖 ", ""),
        "answer": content,
        "severity": response.get("severity", "info"),
    }


def _check_ambiguity(query: str):
    """If query mentions a resource with multiple matches, return options."""
    from core.collectors.pods import collect_pods
    import re

    lower = query.lower()
    # Extract potential resource name from query
    target = None
    patterns = [
        r"why is (\S+)",
        r"why (\S+)",
        r"pod (\S+)",
        r"pods (\S+)",
        r"how many (\S+)",
        r"count (\S+)",
        r"number of (\S+)",
        r"diagnose (\S+)",
        r"inspect (\S+)",
        r"describe (\S+)",
        r"logs for (\S+)",
        r"logs of (\S+)",
        r"logs (\S+)",
        r"is (\S+) healthy",
        r"is (\S+) running",
        r"is (\S+) failing",
        r"(\S+) consuming",
        r"(\S+) consumes",
        r"(\S+) cpu",
        r"(\S+) memory",
        r"(\S+) failing",
        r"(\S+) crashing",
        r"(\S+) restarting",
        r"(\S+) down",
        r"(\S+) unhealthy",
        r"(\S+) oom",
        r"(\S+) stuck",
        r"(\S+) pending",
        r"(\S+) not ready",
        r"(\S+) error",
        r"(\S+) running",
        r"restart.* (\S+)",
        r"scale (\S+)",
        r"rollback (\S+)",
        r"trace (\S+)",
        r"events for (\S+)",
        r"events of (\S+)",
        r"what.* wrong with (\S+)",
        r"check (\S+)",
        r"status of (\S+)",
        r"health of (\S+)",
    ]

    for pattern in patterns:
        match = re.search(pattern, lower)
        if match:
            target = match.group(1).rstrip("?")
            break

    if not target:
        return None

    # Skip if target is a generic word
    skip_words = {
        "failing", "crashing", "down", "more",
        "high", "the", "my", "all", "pods",
        "cluster", "health", "unhealthy",
        "running", "healthy", "stuck", "pending",
        "error", "oom", "ready", "not",
        "recently", "events", "logs", "status",
        "what", "which", "how", "when", "where",
        "is", "are", "was", "were", "been",
        "cpu", "memory", "consuming", "consumes",
        "restarting", "restart", "restarts",
    }
    if target in skip_words:
        return None

    # Use substring matching to find ALL pods containing target
    pods = collect_pods()
    matching = [
        p["name"] for p in pods
        if target in p["name"].lower()
    ]

    if not matching or len(matching) <= 1:
        return None

    # Multiple matches — ask user to pick
    return {
        "title": f"Which '{target}'?",
        "answer": (
            f"Multiple pods match '{target}'. "
            f"Select one to continue:"
        ),
        "severity": "clarify",
        "options": matching[:8],
        "original_query": query,
    }
