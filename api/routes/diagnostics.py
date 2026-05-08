from fastapi import APIRouter, HTTPException

from core.context import context
from core.collectors.inspect import inspect_pod, pod_events, extract_pod_details
from core.collectors.diagnosis import collect_diagnosis
from core.collectors.trace import trace_resource
from core.diagnostics.engine import diagnose
from core.diagnostics.recommendations import recommend

router = APIRouter(tags=["diagnostics"])


@router.get("/inspect/{pod}")
def get_inspect(pod: str):
    pod_data = inspect_pod(pod)
    if not pod_data:
        raise HTTPException(status_code=404, detail="Pod not found")
    details = extract_pod_details(pod_data)
    events = pod_events(pod)
    recommendation = recommend(pod_data)
    return {
        "pod": pod,
        "details": details,
        "events": events,
        "recommendation": recommendation,
    }


@router.get("/diagnose/{pod}")
def get_diagnose(pod: str):
    data = collect_diagnosis(pod)
    if not data:
        raise HTTPException(status_code=404, detail="Pod not found")
    findings = diagnose(data)
    return {
        "pod": pod,
        "findings": findings,
    }


@router.get("/trace/{name}")
def get_trace(name: str):
    data = trace_resource(name)
    return {"name": name, "trace": data}
