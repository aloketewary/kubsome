import re
from fastapi import APIRouter, Query
from pydantic import BaseModel
from typing import Optional

from core.context import context

router = APIRouter(tags=["operations"])


# ─── Incident Mode ───────────────────────────────────────────────────────────

class IncidentStartRequest(BaseModel):
    title: str = ""

class NoteRequest(BaseModel):
    text: str

@router.post("/incident/start")
def incident_start(req: IncidentStartRequest):
    from core.incident.manager import start_incident
    incident = start_incident(req.title)
    return incident

@router.post("/incident/stop")
def incident_stop():
    from core.incident.manager import stop_incident
    result = stop_incident()
    if not result:
        return {"status": "no active incident"}
    incident, path = result
    return {"incident": incident, "export_path": path}

@router.get("/incident/status")
def incident_status():
    from core.incident.manager import get_active
    return get_active() or {"status": "no active incident"}

@router.post("/incident/note")
def incident_note(req: NoteRequest):
    from core.incident.manager import add_note
    if add_note(req.text):
        return {"added": True}
    return {"added": False, "reason": "no active incident"}

@router.post("/incident/snapshot")
def incident_snapshot():
    from core.incident.manager import snapshot
    if snapshot():
        return {"captured": True}
    return {"captured": False, "reason": "no active incident"}


# ─── RBAC ─────────────────────────────────────────────────────────────────────

@router.get("/rbac")
def get_rbac():
    from core.collectors.rbac import list_role_bindings
    return {"bindings": list_role_bindings()}


# ─── CronJobs / Jobs ─────────────────────────────────────────────────────────

@router.get("/cronjobs")
def get_cronjobs():
    from core.collectors.jobs import list_cronjobs
    return {"cronjobs": list_cronjobs()}

@router.get("/jobs")
def get_jobs():
    from core.collectors.jobs import list_jobs
    return {"jobs": list_jobs()}

@router.post("/trigger/{name}")
def trigger_cronjob(name: str):
    from core.collectors.jobs import trigger_cronjob as do_trigger
    success, output = do_trigger(name)
    return {"success": success, "output": output}


# ─── Namespace Overview ───────────────────────────────────────────────────────

@router.get("/ns-overview")
def get_ns_overview():
    from core.collectors.namespace import namespace_summary
    return namespace_summary()


# ─── Compare (Multi-cluster) ─────────────────────────────────────────────────

class CompareRequest(BaseModel):
    ctx_a: str
    ctx_b: str
    ns_a: str = "default"
    ns_b: str = "default"

@router.post("/compare")
def post_compare(req: CompareRequest):
    from core.collectors.multicluster import compare_contexts
    data = compare_contexts(req.ctx_a, req.ctx_b, req.ns_a, req.ns_b)
    return data


# ─── Network ─────────────────────────────────────────────────────────────────

@router.get("/netcheck/{pod}")
def get_netcheck(pod: str):
    from core.collectors.network import netcheck
    return netcheck(pod)


# ─── ConfigMap / Secret ───────────────────────────────────────────────────────

@router.get("/configmap/{name}")
def get_configmap(name: str):
    from core.collectors.configs import get_configmap as fetch_cm
    return fetch_cm(name)

@router.get("/secret/{name}")
def get_secret(name: str):
    from core.collectors.configs import get_secret as fetch_secret
    return fetch_secret(name)


# ─── Deployment Diff ──────────────────────────────────────────────────────────

@router.get("/diff/{name}")
def get_diff(name: str):
    from core.collectors.diff import deployment_diff
    return deployment_diff(name)


# ─── Scaling: HPA, PDB, Capacity, Quota, Drain ───────────────────────────────

@router.get("/hpa")
def get_hpa():
    from core.collectors.scaling import list_hpa
    return {"hpa": list_hpa()}

@router.get("/pdb")
def get_pdb():
    from core.collectors.scaling import list_pdb
    return {"pdb": list_pdb()}

@router.get("/capacity")
def get_capacity():
    from core.collectors.scaling import cluster_capacity
    return cluster_capacity()

@router.get("/quota")
def get_quota():
    from core.collectors.scaling import namespace_quota
    return namespace_quota()

@router.get("/drain-check/{node}")
def get_drain_check(node: str):
    from core.collectors.scaling import drain_check
    return drain_check(node)


# ─── Timeline ────────────────────────────────────────────────────────────────

@router.get("/timeline")
def get_timeline(minutes: int = 60):
    from core.collectors.timeline import build_timeline
    return {"events": build_timeline(minutes=minutes)}


# ─── Ingress / Mesh / Dependencies / DNS ──────────────────────────────────────

@router.get("/ingress")
def get_ingress():
    from core.collectors.services import list_ingresses
    return {"ingresses": list_ingresses()}

@router.get("/mesh")
def get_mesh():
    from core.collectors.services import detect_mesh
    return detect_mesh()

@router.get("/deps/{name}")
def get_deps(name: str):
    from core.collectors.services import service_dependencies
    return service_dependencies(name)

@router.get("/dns/{service}")
def get_dns(service: str):
    from core.collectors.services import dns_debug
    return dns_debug(service)


# ─── Correlate / Playbook ─────────────────────────────────────────────────────

@router.get("/correlate")
def get_correlate(target: Optional[str] = None):
    from core.ai.correlation import correlate
    return {"chains": correlate(target)}

@router.get("/playbook/{issue}")
def get_playbook(issue: str):
    from core.ai.playbooks import get_playbook
    return get_playbook(issue)


# ─── Changelog / Snap ─────────────────────────────────────────────────────────

@router.get("/changelog")
def get_changelog():
    from core.collectors.changes import build_changelog
    return {"changelog": build_changelog()}

@router.post("/snap")
def post_snap():
    from core.collectors.changes import take_state_snapshot
    path = take_state_snapshot()
    return {"path": path}

@router.get("/snap-diff")
def get_snap_diff():
    from core.collectors.changes import get_latest_snapshot, diff_snapshots
    old = get_latest_snapshot()
    return diff_snapshots(old)


# ─── Labels ───────────────────────────────────────────────────────────────────

@router.get("/labels/{resource_type}")
def get_labels(resource_type: str, name: Optional[str] = None):
    from core.collectors.labels import get_labels as fetch_labels
    return {"resources": fetch_labels(resource_type, name)}


# ─── Audit ────────────────────────────────────────────────────────────────────

@router.get("/audit")
def get_audit():
    from core.audit import get_audit_log
    return {"log": get_audit_log()}


# ─── Export ───────────────────────────────────────────────────────────────────

@router.get("/export")
def get_export(format: str = "md"):
    from core.export import export_report
    path = export_report(format=format)
    return {"path": path, "format": format}


# ─── Explain / Generate ───────────────────────────────────────────────────────

class ExplainRequest(BaseModel):
    query: str

class GenerateRequest(BaseModel):
    kind: str
    name: str

@router.post("/explain")
def post_explain(req: ExplainRequest):
    from core.ai.explain import explain
    result = explain(req.query)
    # Strip Rich markup
    content = re.sub(r'\[/?[^\]]+\]', '', result.get("content", ""))
    return {"title": result.get("title", ""), "content": content}

@router.post("/generate")
def post_generate(req: GenerateRequest):
    from core.ai.generator import generate_manifest
    yaml_output = generate_manifest(req.kind, req.name, context.namespace)
    return {"yaml": yaml_output or ""}
