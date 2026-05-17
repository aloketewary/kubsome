import re
from fastapi import APIRouter, Query
from pydantic import BaseModel
from typing import Optional

from core.context import context

router = APIRouter(tags=["operations"])


# ─── Image Pull Secrets ───────────────────────────────────────────────────────

@router.get("/image-pull-secrets")
def get_image_pull_secrets(pod: Optional[str] = None):
    from core.collectors.image_pull import check_image_pull_secrets
    return check_image_pull_secrets(pod)


# ─── Incident Mode ───────────────────────────────────────────────────────────

class IncidentStartRequest(BaseModel):
    title: str = ""

class NoteRequest(BaseModel):
    text: str

class ActionRequest(BaseModel):
    action: str
    target: str = ""
    result: str = ""

class IncidentStopRequest(BaseModel):
    root_cause: str = ""
    resolution: str = ""

@router.post("/incident/start")
def incident_start(req: IncidentStartRequest):
    from core.incident.manager import start_incident
    incident = start_incident(req.title)
    return incident

@router.post("/incident/stop")
def incident_stop(req: IncidentStopRequest = IncidentStopRequest()):
    from core.incident.manager import stop_incident
    result = stop_incident(req.root_cause, req.resolution)
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

@router.post("/incident/action")
def incident_action(req: ActionRequest):
    from core.incident.manager import add_action
    if add_action(req.action, req.target, req.result):
        return {"added": True}
    return {"added": False, "reason": "no active incident"}


@router.get("/incident/report")
def incident_report(path: str = ""):
    """Read an exported incident report JSON file."""
    import json
    from pathlib import Path
    file = Path(path)
    if not file.exists() or not str(file).startswith(
        str(Path.home() / ".kubsome" / "incidents")
    ):
        return {"error": "File not found or access denied"}
    with open(file, "r") as f:
        return json.load(f)


@router.get("/incident/history")
def incident_history():
    """List all past incident reports."""
    import json
    from pathlib import Path
    incidents_dir = Path.home() / ".kubsome" / "incidents"
    if not incidents_dir.exists():
        return {"incidents": []}
    reports = []
    for f in sorted(incidents_dir.glob("incident_*.json"), reverse=True):
        try:
            data = json.loads(f.read_text())
            reports.append({
                "id": data.get("id", ""),
                "title": data.get("title", "Untitled"),
                "started": data.get("started", ""),
                "ended": data.get("ended", ""),
                "notes_count": len(data.get("notes", [])),
                "snapshots_count": len(data.get("snapshots", [])),
                "root_cause": data.get("root_cause", ""),
                "path": str(f),
            })
        except Exception:
            continue
    return {"incidents": reports}


@router.post("/incident/share")
def incident_share(incident_id: Optional[str] = None):
    """Share incident report via configured webhooks."""
    from core.incident.manager import share_incident
    success, message = share_incident(incident_id)
    return {"success": success, "message": message}


# ─── RBAC ─────────────────────────────────────────────────────────────────────

@router.get("/rbac")
def get_rbac():
    from core.collectors.rbac import list_role_bindings
    return {"bindings": list_role_bindings()}

@router.get("/rbac/check")
def rbac_check(subject: str, kind: str = "ServiceAccount"):
    """Check permissions for a subject."""
    from core.collectors.rbac import check_permissions
    return check_permissions(subject, kind)

@router.get("/rbac/service-accounts")
def rbac_service_accounts():
    from core.collectors.rbac import list_service_accounts
    return {"accounts": list_service_accounts()}

@router.get("/revision-diff/{name}")
def get_revision_diff(name: str):
    """Get deployment revision history as diffs."""
    import subprocess
    from core.context import context as ctx
    ns = ctx.namespace
    kctx = ctx.current_context

    # Get revision history
    cmd = [
        "kubectl", "--context", kctx,
        "rollout", "history", f"deployment/{name}", "-n", ns
    ]
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode != 0:
        return {"error": r.stderr.strip(), "revisions": []}

    # Parse revisions
    lines = r.stdout.strip().split("\n")
    revisions = []
    for line in lines[1:]:
        parts = line.split()
        if parts and parts[0].isdigit():
            revisions.append(int(parts[0]))

    if len(revisions) < 2:
        return {"name": name, "revisions": revisions, "diffs": []}

    # Get diff between last two revisions
    diffs = []
    for i in range(len(revisions) - 1, max(len(revisions) - 4, 0), -1):
        rev_a = revisions[i - 1]
        rev_b = revisions[i]
        cmd_a = [
            "kubectl", "--context", kctx,
            "rollout", "history", f"deployment/{name}",
            f"--revision={rev_a}", "-n", ns
        ]
        cmd_b = [
            "kubectl", "--context", kctx,
            "rollout", "history", f"deployment/{name}",
            f"--revision={rev_b}", "-n", ns
        ]
        ra = subprocess.run(cmd_a, capture_output=True, text=True)
        rb = subprocess.run(cmd_b, capture_output=True, text=True)

        if ra.returncode == 0 and rb.returncode == 0:
            # Simple line diff
            lines_a = set(ra.stdout.strip().split("\n"))
            lines_b = set(rb.stdout.strip().split("\n"))
            added = lines_b - lines_a
            removed = lines_a - lines_b
            diffs.append({
                "from_rev": rev_a,
                "to_rev": rev_b,
                "added": [l.strip() for l in added if l.strip()],
                "removed": [l.strip() for l in removed if l.strip()],
            })

    return {"name": name, "revisions": revisions, "diffs": diffs}


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

@router.get("/endpoints")
def get_endpoints():
    from core.collectors.network import _check_service_endpoints
    from core.context import context
    services = _check_service_endpoints(
        context.namespace, context.current_context
    )
    return {"services": services}

@router.get("/network-policies")
def get_network_policies():
    from core.collectors.network import _check_network_policies
    from core.context import context
    return _check_network_policies(
        context.namespace, context.current_context
    )

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


@router.get("/playbooks")
def list_playbooks():
    from core.ai.playbooks import list_all_playbooks
    all_pb = list_all_playbooks()
    return {
        "playbooks": [
            {"id": key, "title": pb["title"], "steps": pb["steps"], "source": pb.get("source", "built-in")}
            for key, pb in all_pb.items()
        ]
    }


# ─── Changelog / Snap ─────────────────────────────────────────────────────────

@router.get("/webhook/placeholders")
def get_webhook_placeholders():
    """Return placeholder hint strings for webhook URL inputs."""
    return {
        "slack": "https://hooks.slack.com/services/",
        "teams": "https://outlook.office.com/webhook/",
        "webex": "https://webexapis.com/v1/webhooks/incoming/",
        "generic": "https://your-server.com/alert",
    }


@router.post("/webhook/test")
def test_webhook():
    """Send a test notification to all configured webhooks."""
    from core.notify import notify_webhook
    from core.config import load_config
    config = load_config()
    webhooks = config.get("webhooks", [])
    count = len(webhooks)
    if count == 0:
        return {"sent_to": 0, "message": "No webhooks configured. Add them in Settings."}
    notify_webhook(
        "Test Notification",
        "This is a test from Kubsome. Webhooks are working!",
        "info"
    )
    return {"sent_to": count, "message": f"Test sent to {count} webhook(s). Check your channel."}

@router.get("/webhooks")
def get_webhooks():
    """Get configured webhooks."""
    from core.config import load_config
    config = load_config()
    return {"webhooks": config.get("webhooks", [])}

@router.post("/webhooks")
def save_webhooks(req: dict):
    """Save webhooks configuration."""
    from core.config import load_config, save_config
    config = load_config()
    config["webhooks"] = req.get("webhooks", [])
    save_config(config)
    return {"saved": True, "count": len(config["webhooks"])}

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
def get_audit(limit: int = 50, action: Optional[str] = None):
    from core.audit import get_audit_log
    entries = get_audit_log(limit=limit)
    if action:
        entries = [
            e for e in entries
            if e.get("action") == action
        ]
    # Summary stats
    actions = {}
    for e in entries:
        a = e.get("action", "unknown")
        actions[a] = actions.get(a, 0) + 1
    return {
        "log": entries,
        "total": len(entries),
        "summary": actions,
    }


# ─── Export ───────────────────────────────────────────────────────────────────

@router.get("/export")
def get_export(format: str = "md"):
    from core.export import export_report
    path = export_report(format=format)
    return {"path": path, "format": format}


@router.get("/cost-trend")
def get_cost_trend():
    from core.collectors.cost_trend import cost_trend
    return cost_trend()


@router.get("/metrics-history")
def get_metrics_history(
    pod: str = None,
    hours: int = 24,
):
    from core.collectors.metrics_history import (
        get_time_series, get_pod_history
    )
    series = get_time_series(pod_name=pod, hours=hours)
    summary = None
    if pod:
        summary = get_pod_history(pod)
    return {
        "series": series,
        "summary": summary,
        "hours": hours,
        "pod": pod,
        "points": len(series),
    }


@router.get("/policy-check")
def get_policy_check():
    from core.policy import check_policies, load_policies
    policies = load_policies()
    result = check_policies()
    return {
        "policies": [
            {"name": p["name"], "description": p.get("description", ""), "rule": p.get("rule", ""), "severity": p.get("severity", "medium")}
            for p in policies
        ],
        **result,
    }


@router.get("/doctor")
def get_doctor():
    from core.doctor import run_doctor
    return {"checks": run_doctor()}


@router.get("/schedules")
def get_schedules():
    from core.scheduler import get_scheduler
    return {"schedules": get_scheduler().list_schedules()}


class ScheduleAddRequest(BaseModel):
    name: str
    cron: str
    commands: list
    notify: bool = True


@router.post("/schedules")
def add_schedule(req: ScheduleAddRequest):
    from core.scheduler import get_scheduler
    get_scheduler().add(req.name, req.cron, req.commands, req.notify)
    return {"added": True, "name": req.name}


@router.delete("/schedules/{name}")
def delete_schedule(name: str):
    from core.scheduler import get_scheduler
    get_scheduler().remove(name)
    return {"removed": True, "name": name}


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
