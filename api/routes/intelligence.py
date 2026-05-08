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
    response = handle_ai_query(req.query)
    # Strip Rich markup tags for API consumers
    content = response.get("content", "")
    content = re.sub(r'\[/?[^\]]+\]', '', content)
    return {
        "title": response.get("title", "").replace("🤖 ", ""),
        "answer": content,
        "severity": response.get("severity", "info"),
    }
