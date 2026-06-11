from fastapi import APIRouter, HTTPException

from core.context import context
from core.collectors.inspect import inspect_pod, pod_events, extract_pod_details
from core.collectors.diagnosis import collect_diagnosis
from core.collectors.trace import trace_resource
from core.diagnostics.engine import diagnose, investigate
from core.diagnostics.recommendations import recommend

router = APIRouter(tags=["diagnostics"])


@router.get("/inspect/{name}")
def get_inspect(name: str):
    pod_data = inspect_pod(name)
    if not pod_data:
        # Try prefix match
        from core.collectors.pods import collect_pods
        pods = collect_pods()
        match = next((p for p in pods if p["name"].startswith(name)), None)
        if match:
            pod_data = inspect_pod(match["name"])
            name = match["name"]
    if not pod_data:
        raise HTTPException(status_code=404, detail="Pod not found")
    details = extract_pod_details(pod_data)
    events = pod_events(name)
    recommendation = recommend(pod_data)
    return {
        "pod": name,
        "details": details,
        "events": events,
        "recommendation": recommendation,
    }


@router.get("/diagnose/{name}")
def get_diagnose(name: str):
    # Try exact pod name first, then fuzzy match
    data = collect_diagnosis(name)
    if not data:
        # Try to find a pod matching this prefix (deployment name)
        from core.collectors.pods import collect_pods
        pods = collect_pods()
        match = next((p for p in pods if p["name"].startswith(name)), None)
        if match:
            data = collect_diagnosis(match["name"])
            name = match["name"]
    if not data:
        return {"pod": name, "findings": [], "summary": f"No pod found matching '{name}'"}
    findings = diagnose(data)
    return {
        "pod": name,
        "findings": findings,
    }


@router.get("/trace/{name}")
def get_trace(name: str):
    data = trace_resource(name)
    return {"name": name, "trace": data}


@router.get("/investigate/{name}")
def get_investigate(name: str):
    """Full investigation report with evidence chain."""
    data = collect_diagnosis(name)
    if not data:
        from core.collectors.pods import collect_pods
        pods = collect_pods()
        match = next(
            (p for p in pods
             if p["name"].startswith(name)), None
        )
        if match:
            data = collect_diagnosis(match["name"])
            name = match["name"]
    if not data:
        raise HTTPException(
            status_code=404, detail="Pod not found"
        )

    report = investigate(data)
    if not report:
        raise HTTPException(
            status_code=500,
            detail="Investigation failed"
        )

    from core.diagnostics.validation.evidence import (
        score_report,
    )
    evidence_scores = {
        fid: s.value
        for fid, s in score_report(report).items()
    }

    from dataclasses import asdict
    from core.diagnostics.models import SCHEMA_VERSION
    import json
    from enum import Enum

    def serialize(obj):
        if isinstance(obj, Enum):
            return obj.value
        if hasattr(obj, 'isoformat'):
            return obj.isoformat()
        return str(obj)

    result = json.loads(
        json.dumps(asdict(report), default=serialize)
    )
    result["evidence_scores"] = evidence_scores

    return result


@router.get("/benchmark")
def get_benchmark():
    """Run accuracy benchmark against golden corpus."""
    from core.diagnostics.validation.benchmark import (
        run_benchmark,
    )
    return run_benchmark()


@router.post("/feedback")
def post_feedback(
    finding_type: str,
    verdict: str,
    incident_id: str = "",
    comment: str = "",
):
    """Record user feedback on a finding."""
    from core.diagnostics.validation.feedback import (
        Feedback, Verdict, record,
    )
    try:
        v = Verdict(verdict)
    except ValueError:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid verdict. Use: "
            f"correct, wrong, partial, missed"
        )

    fb = Feedback(
        finding_type=finding_type,
        verdict=v,
        incident_id=incident_id,
        comment=comment,
    )
    record(fb)
    return {"status": "recorded"}


@router.get("/feedback/summary")
def get_feedback_summary():
    """Get accuracy summary from user feedback."""
    from core.diagnostics.validation.feedback import (
        summary, false_positive_rate,
    )
    return {
        "findings": summary(),
        "overall_fp_rate": false_positive_rate(),
    }
