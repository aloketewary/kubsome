from fastapi import APIRouter, HTTPException

from core.context import context
from core.collectors.inspect import inspect_pod, pod_events, extract_pod_details
from core.collectors.diagnosis import collect_diagnosis
from core.collectors.trace import trace_resource
from core.diagnostics.engine import diagnose
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
