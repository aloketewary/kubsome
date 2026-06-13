"""
GitOps & Mesh API routes — ArgoCD/Flux status and
service mesh visibility endpoints.
"""

import time

from fastapi import APIRouter

router = APIRouter(tags=["gitops", "mesh"])

# --- Rightsizing overview cache ---
_rs_overview_cache = {"data": None, "ts": 0}
_RS_OVERVIEW_TTL = 120


@router.get("/gitops")
def get_gitops():
    from core.collectors.gitops import collect_gitops
    return collect_gitops()


@router.get("/gitops/{app_name}")
def get_gitops_app(app_name: str):
    from core.collectors.gitops import gitops_app_detail
    data = gitops_app_detail(app_name)
    if not data:
        from fastapi import HTTPException
        raise HTTPException(404, "App not found")
    return data


@router.get("/mesh/status")
def get_mesh_status():
    from core.collectors.mesh import collect_mesh_detail
    return collect_mesh_detail()


@router.get("/mesh/virtual-services")
def get_virtual_services(target: str = None):
    from core.collectors.mesh import collect_virtual_services
    return {"virtual_services": collect_virtual_services(target)}


@router.get("/mesh/destination-rules")
def get_destination_rules(target: str = None):
    from core.collectors.mesh import collect_destination_rules
    return {"destination_rules": collect_destination_rules(target)}


@router.get("/mesh/mtls")
def get_mtls():
    from core.collectors.mesh import collect_mtls_status
    return collect_mtls_status()


@router.get("/integrations")
def get_integrations():
    from core.connect import list_integrations
    return {"integrations": list_integrations()}


@router.post("/integrations/connect")
def post_connect(req: dict):
    from core.connect import connect_integration
    name = req.get("name", "")
    url = req.get("url")
    if not name:
        from fastapi import HTTPException
        raise HTTPException(400, "name required")
    return connect_integration(name, url)


@router.post("/integrations/disconnect")
def post_disconnect(req: dict):
    from core.connect import disconnect_integration
    name = req.get("name", "")
    if not name:
        from fastapi import HTTPException
        raise HTTPException(400, "name required")
    return disconnect_integration(name)


@router.get("/integrations/discover")
def get_discover():
    from core.connect import auto_discover
    return {"discovered": auto_discover()}


@router.post("/integrations/connect-all")
def post_connect_all(req: dict):
    from core.connect import connect_discovered
    discoveries = req.get("discoveries", [])
    return {"results": connect_discovered(discoveries)}


@router.get("/profiles")
def get_profiles():
    from core.profiles import list_profiles, get_active_profile
    return {
        "profiles": list_profiles(),
        "active": get_active_profile(),
    }


@router.post("/profiles/activate")
def post_activate_profile(req: dict):
    from core.profiles import activate_profile
    name = req.get("name", "")
    if not name:
        from fastapi import HTTPException
        raise HTTPException(400, "name required")
    return activate_profile(name)


@router.post("/profiles/deactivate")
def post_deactivate_profile():
    from core.profiles import deactivate_profile
    return deactivate_profile()


@router.get("/analytics")
@router.get("/analytics/stats")
def get_analytics():
    from core.analytics.engine import get_stats
    try:
        return get_stats()
    except Exception:
        return {"total_rows": 0, "db_size_mb": 0, "collections_today": 0, "last_collection": None}


@router.post("/analytics/collect")
@router.get("/analytics/collect")
def post_collect():
    from core.analytics.collector import collect_now
    return collect_now()


@router.post("/analytics/maintenance")
def post_maintenance():
    from core.analytics.aggregator import run_maintenance
    return run_maintenance()


@router.get("/analytics/rightsizing/overview")
def get_rightsizing_overview(days: int = 7, namespace: str = None):
    """Aggregated rightsizing payload — single call for UI."""
    now = time.time()
    if (
        _rs_overview_cache["data"] is not None
        and now - _rs_overview_cache["ts"] < _RS_OVERVIEW_TTL
    ):
        return _rs_overview_cache["data"]

    try:
        from core.analytics.rightsizing_overview import (
            build_rightsizing_overview,
        )
        overview = build_rightsizing_overview(days, namespace)
        payload = overview.to_dict()
        _rs_overview_cache["data"] = payload
        _rs_overview_cache["ts"] = now
        return payload
    except ImportError:
        return {
            "deployments_analyzed": 0,
            "empty_state_reason": "analytics_unavailable",
        }
    except Exception as e:
        return {
            "deployments_analyzed": 0,
            "empty_state_reason": "analytics_unavailable",
            "error": str(e),
        }


@router.get("/analytics/rightsizing")
def get_rightsizing(days: int = 7, namespace: str = None):
    from core.analytics.rightsizing import optimization_report
    return optimization_report(days, namespace)


@router.post("/analytics/rightsizing/export")
def post_rightsizing_export(req: dict = {}):
    from core.analytics.rightsizing import (
        pod_rightsizing, export_combined_patch
    )
    days = req.get("days", 7)
    namespace = req.get("namespace")
    recs = pod_rightsizing(days, namespace)
    if not recs:
        return {"path": None, "message": "No recommendations"}
    path = export_combined_patch(recs)
    return {"path": path, "count": len(recs)}


@router.get("/analytics/cost")
def get_cost_analytics(days: int = 7):
    from core.analytics.cost_model import (
        cost_by_deployment, monthly_cost_summary
    )
    return {
        "summary": monthly_cost_summary(),
        "deployments": cost_by_deployment(days),
    }


@router.get("/analytics/alerts")
def get_analytics_alerts():
    from core.analytics.alerts import check_alerts
    try:
        return {"alerts": check_alerts()}
    except Exception:
        return {"alerts": []}


@router.get("/analytics/predictions")
def get_predictions(hours: int = 12):
    from core.analytics.predictive import check_predictive_alerts
    return {"predictions": check_predictive_alerts(hours)}


@router.get("/analytics/capacity")
def get_capacity_forecast(days: int = 14):
    from core.analytics.capacity import capacity_forecast
    return capacity_forecast(days) or {}


@router.get("/analytics/capacity/namespace-growth")
def get_namespace_growth(days: int = 14):
    from core.analytics.capacity import namespace_growth
    return {"namespaces": namespace_growth(days)}


@router.get("/analytics/blast-radius/{name}")
def get_blast_radius(name: str, action: str = "restart"):
    try:
        from core.analytics.blast_radius import analyze_blast_radius
        result = analyze_blast_radius(name, action)
        if result and "error" in result:
            return result
        return result
    except Exception as e:
        return {"error": f"Blast radius analysis failed: {str(e)}"}


@router.get("/analytics/correlate-change/{name}")
def get_correlate_change(name: str, minutes: int = 10):
    from core.analytics.correlation import correlate_change
    return correlate_change(name, minutes)


@router.get("/port-forwards")
def get_port_forwards():
    from core.port_forward import list_forwards
    return {"forwards": list_forwards()}


@router.post("/port-forwards/start")
def post_start_forward(req: dict):
    from core.port_forward import start_forward
    target = req.get("target", "")
    local_port = req.get("local_port", 8080)
    remote_port = req.get("remote_port", local_port)
    if not target:
        from fastapi import HTTPException
        raise HTTPException(400, "target required")
    return start_forward(target, local_port, remote_port)


@router.post("/port-forwards/stop")
def post_stop_forward(req: dict):
    from core.port_forward import stop_forward
    return stop_forward(target=req.get("target"), local_port=req.get("port"))


@router.post("/port-forwards/stop-all")
def post_stop_all_forwards():
    from core.port_forward import stop_all
    return stop_all()


# --- Helm ---

@router.get("/helm/list")
def get_helm_list():
    from core.collectors.helm import helm_list
    return helm_list()


@router.get("/helm/status/{release}")
def get_helm_status(release: str):
    from core.collectors.helm import helm_status
    return helm_status(release)


@router.get("/helm/history/{release}")
def get_helm_history(release: str):
    from core.collectors.helm import helm_history
    return helm_history(release)


@router.get("/helm/values/{release}")
def get_helm_values(release: str):
    from core.collectors.helm import helm_values
    return helm_values(release)


@router.get("/helm/diff/{release}")
def get_helm_diff(release: str):
    from core.collectors.helm import helm_diff
    return helm_diff(release)


@router.post("/helm/rollback/{release}")
def post_helm_rollback(release: str, req: dict = {}):
    from core.collectors.helm import helm_rollback
    revision = req.get("revision")
    return helm_rollback(release, revision)


@router.post("/analytics/query")
def post_analytics_query(req: dict):
    from core.analytics.export import run_custom_query
    sql = req.get("sql", "")
    if not sql:
        from fastapi import HTTPException
        raise HTTPException(400, "sql required")
    return run_custom_query(sql)


@router.get("/analytics/export/{query_name}")
def get_analytics_export(query_name: str, days: int = 7, fmt: str = "csv"):
    from core.analytics.export import export_csv, export_parquet
    if fmt == "parquet":
        path = export_parquet(query_name, days)
    else:
        path = export_csv(query_name, days)
    if not path:
        from fastapi import HTTPException
        raise HTTPException(404, f"Unknown query: {query_name}")
    return {"path": path}


@router.get("/analytics/cost-models")
def get_cost_models_api():
    from core.analytics.cost_model import get_cost_models
    return {"models": get_cost_models()}


@router.post("/analytics/cost-models")
def post_cost_model(req: dict):
    from core.analytics.cost_model import set_cost_model
    return set_cost_model(
        name=req.get("name", "custom"),
        cpu_per_core_hour=req.get("cpu_per_core_hour", 0.0425),
        mem_per_gb_hour=req.get("mem_per_gb_hour", 0.0053),
        provider=req.get("provider", "custom"),
        instance_type=req.get("instance_type", ""),
        region=req.get("region", ""),
    )


# --- Time-Series endpoints ---

@router.get("/analytics/series/cpu-memory")
def get_cpu_memory_series(deployment: str = None, hours: int = 24):
    from core.analytics.timeseries import cpu_memory_series
    try:
        return {"series": cpu_memory_series(deployment, hours)}
    except Exception:
        return {"series": []}


@router.get("/analytics/series/nodes")
def get_node_series(node: str = None, hours: int = 24):
    from core.analytics.timeseries import node_series
    try:
        return {"series": node_series(node, hours)}
    except Exception:
        return {"series": []}


@router.get("/analytics/series/restarts")
def get_restart_series(deployment: str = None, hours: int = 48):
    from core.analytics.timeseries import restart_series
    try:
        return {"series": restart_series(deployment, hours)}
    except Exception:
        return {"series": []}


@router.get("/analytics/series/cost")
def get_cost_series(days: int = 30):
    from core.analytics.timeseries import cost_series
    try:
        return {"series": cost_series(days)}
    except Exception:
        return {"series": []}


@router.get("/analytics/series/events")
def get_event_series(hours: int = 24, event_type: str = None):
    from core.analytics.timeseries import event_timeline
    try:
        return {"series": event_timeline(hours, event_type)}
    except Exception:
        return {"series": []}


@router.get("/analytics/series/top-consumers")
def get_top_consumers(hours: int = 6, limit: int = 10):
    from core.analytics.timeseries import top_consumers
    try:
        return {"consumers": top_consumers(hours, limit)}
    except Exception:
        return {"consumers": []}


@router.post("/analytics/series/compare")
def post_compare_deployments(req: dict):
    from core.analytics.timeseries import deployment_comparison
    deployments = req.get("deployments", [])
    hours = req.get("hours", 24)
    return {"comparison": deployment_comparison(deployments, hours)}


# --- State Cache endpoints ---

@router.get("/analytics/state/pods")
def get_state_pods(search: str = None, status: str = None, limit: int = 500):
    from core.analytics.state_cache import get_pods
    from core.analytics.engine import get_conn
    from core.context import context
    conn = get_conn()
    return {
        "pods": get_pods(
            conn, context.current_context, context.namespace,
            search, status, limit
        )
    }


@router.get("/analytics/state/deployments")
def get_state_deployments():
    from core.analytics.state_cache import get_deployments
    from core.analytics.engine import get_conn
    from core.context import context
    conn = get_conn()
    return {
        "deployments": get_deployments(
            conn, context.current_context, context.namespace
        )
    }


@router.get("/analytics/state/stats")
def get_state_stats():
    from core.analytics.state_cache import state_stats
    from core.analytics.engine import get_conn
    from core.context import context
    conn = get_conn()
    return state_stats(
        conn, context.current_context, context.namespace
    )


@router.get("/analytics/events/search")
def get_events_search(
    query: str = None, event_type: str = None,
    reason: str = None, hours: int = 24, limit: int = 100
):
    from core.analytics.state_cache import search_events
    from core.analytics.engine import get_conn
    from core.context import context
    conn = get_conn()
    return {
        "events": search_events(
            conn, context.current_context, context.namespace,
            query, event_type, reason, hours, limit
        )
    }


@router.get("/analytics/events/heatmap")
def get_events_heatmap(hours: int = 24):
    from core.analytics.state_cache import event_heatmap
    from core.analytics.engine import get_conn
    from core.context import context
    conn = get_conn()
    return {
        "heatmap": event_heatmap(
            conn, context.current_context, context.namespace, hours
        )
    }


@router.get("/analytics/incidents/search")
def get_incident_search(query: str = None, days: int = 90):
    from core.analytics.incidents import search_incidents
    results = search_incidents(query, days)
    return {"incidents": results or []}


@router.get("/analytics/incidents/metrics")
def get_incident_metrics(days: int = 90):
    from core.analytics.incidents import incident_metrics
    return incident_metrics(days) or {}


@router.get("/monitor/hpa")
def get_hpa_metrics(hours: int = 24):
    """HPA scaling pressure over time."""
    try:
        from core.analytics.engine import execute
        from core.context import context
        ctx = context.current_context
        rows = execute(f"""
            SELECT ts, hpa_name, target_deployment,
                   current_replicas, desired_replicas,
                   min_replicas, max_replicas,
                   cpu_target_pct, cpu_current_pct,
                   at_max, scaling_up
            FROM hpa_metrics
            WHERE context = '{ctx}'
              AND ts >= NOW() - INTERVAL '{hours} hours'
            ORDER BY ts DESC
        """)
        return {"hpa": [
            {
                "ts": str(r[0]), "name": r[1], "target": r[2],
                "current": r[3], "desired": r[4],
                "min": r[5], "max": r[6],
                "cpu_target": r[7], "cpu_current": r[8],
                "at_max": r[9], "scaling_up": r[10],
            }
            for r in rows
        ]}
    except Exception:
        return {"hpa": []}


@router.get("/monitor/oomkills")
def get_oomkills(hours: int = 48):
    """Recent OOMKill events."""
    try:
        from core.analytics.engine import execute
        from core.context import context
        ctx = context.current_context
        rows = execute(f"""
            SELECT ts, pod, container, mem_limit_mb, killed_at
            FROM oomkill_events
            WHERE context = '{ctx}'
              AND ts >= NOW() - INTERVAL '{hours} hours'
            ORDER BY ts DESC
        """)
        return {"oomkills": [
            {
                "ts": str(r[0]), "pod": r[1], "container": r[2],
                "mem_limit_mb": r[3], "killed_at": r[4],
            }
            for r in rows
        ]}
    except Exception:
        return {"oomkills": []}


@router.get("/monitor/quotas")
def get_quota_pressure():
    """Current resource quota usage."""
    try:
        from core.analytics.engine import execute
        from core.context import context
        ctx = context.current_context
        ns = context.namespace
        rows = execute(f"""
            SELECT quota_name, resource, hard_value, used_value, used_pct
            FROM quota_metrics
            WHERE context = '{ctx}' AND namespace = '{ns}'
              AND ts = (SELECT MAX(ts) FROM quota_metrics
                        WHERE context = '{ctx}' AND namespace = '{ns}')
            ORDER BY used_pct DESC
        """)
        return {"quotas": [
            {
                "quota": r[0], "resource": r[1],
                "hard": r[2], "used": r[3], "pct": r[4],
            }
            for r in rows
        ]}
    except Exception:
        return {"quotas": []}


@router.get("/monitor/rollouts")
def get_rollout_state():
    """Current deployment rollout states."""
    try:
        from core.analytics.engine import execute
        from core.context import context
        ctx = context.current_context
        ns = context.namespace
        rows = execute(f"""
            SELECT deployment, desired, updated, available,
                   unavailable, state
            FROM rollout_metrics
            WHERE context = '{ctx}' AND namespace = '{ns}'
              AND ts = (SELECT MAX(ts) FROM rollout_metrics
                        WHERE context = '{ctx}' AND namespace = '{ns}')
            ORDER BY
                CASE state
                    WHEN 'stalled' THEN 0
                    WHEN 'degraded' THEN 1
                    WHEN 'progressing' THEN 2
                    ELSE 3
                END
        """)
        return {"rollouts": [
            {
                "deployment": r[0], "desired": r[1],
                "updated": r[2], "available": r[3],
                "unavailable": r[4], "state": r[5],
            }
            for r in rows
        ]}
    except Exception:
        return {"rollouts": []}


@router.get("/monitor/health-signals")
def get_health_signals():
    """Combined health signals — single call for dashboard widgets."""
    try:
        from core.analytics.engine import execute, execute_one
        from core.context import context
        ctx = context.current_context
        ns = context.namespace

        # OOMKills last 24h
        oom_count = execute_one(f"""
            SELECT COUNT(*) FROM oomkill_events
            WHERE context = '{ctx}' AND ts >= NOW() - INTERVAL '24 hours'
        """)

        # HPAs at max
        hpa_at_max = execute_one(f"""
            SELECT COUNT(DISTINCT hpa_name) FROM hpa_metrics
            WHERE context = '{ctx}' AND at_max = true
              AND ts = (SELECT MAX(ts) FROM hpa_metrics WHERE context = '{ctx}')
        """)

        # Quotas > 80%
        quota_pressure = execute_one(f"""
            SELECT COUNT(*) FROM quota_metrics
            WHERE context = '{ctx}' AND namespace = '{ns}'
              AND used_pct > 80
              AND ts = (SELECT MAX(ts) FROM quota_metrics
                        WHERE context = '{ctx}' AND namespace = '{ns}')
        """)

        # Stalled/degraded rollouts
        bad_rollouts = execute_one(f"""
            SELECT COUNT(*) FROM rollout_metrics
            WHERE context = '{ctx}' AND namespace = '{ns}'
              AND state IN ('stalled', 'degraded')
              AND ts = (SELECT MAX(ts) FROM rollout_metrics
                        WHERE context = '{ctx}' AND namespace = '{ns}')
        """)

        return {
            "oomkills_24h": oom_count[0] if oom_count else 0,
            "hpa_at_max": hpa_at_max[0] if hpa_at_max else 0,
            "quota_pressure": quota_pressure[0] if quota_pressure else 0,
            "stalled_rollouts": bad_rollouts[0] if bad_rollouts else 0,
        }
    except Exception:
        return {
            "oomkills_24h": 0, "hpa_at_max": 0,
            "quota_pressure": 0, "stalled_rollouts": 0,
        }


@router.post("/rightsizing/dry-run")
def post_dry_run(req: dict = {}):
    """Validate rightsizing patches against API server."""
    from core.analytics.safe_apply import dry_run
    try:
        days = req.get("days", 7)
        namespace = req.get("namespace")
        return dry_run(days=days, namespace=namespace)
    except Exception as e:
        return {"results": [], "passed": 0, "failed": 0, "error": str(e)}


@router.get("/rightsizing/diff")
def get_rightsizing_diff(days: int = 7, namespace: str = None):
    """Current vs recommended resource diff."""
    from core.analytics.safe_apply import diff
    try:
        return {"diffs": diff(days=days, namespace=namespace)}
    except Exception as e:
        return {"diffs": [], "error": str(e)}


@router.post("/rightsizing/apply")
def post_safe_apply(req: dict = {}):
    """Apply phase-1 recommendations with health monitoring."""
    from core.analytics.safe_apply import apply_safe
    from core.context import context
    ctx = context.current_context
    if ctx and ("prod" in ctx or "prd" in ctx):
        from fastapi import HTTPException
        raise HTTPException(
            403, "Safe-apply blocked in production. Use GitOps output instead."
        )
    try:
        days = req.get("days", 7)
        namespace = req.get("namespace")
        watch = req.get("watch_seconds", 300)
        return apply_safe(
            days=days, namespace=namespace, watch_seconds=watch
        )
    except Exception as e:
        return {"error": str(e)}


@router.post("/rightsizing/gitops")
def post_gitops_output(req: dict = {}):
    """Generate GitOps-ready manifests (kustomize/helm/plain)."""
    from core.analytics.safe_apply import gitops_output
    try:
        days = req.get("days", 7)
        namespace = req.get("namespace")
        fmt = req.get("format", "kustomize")
        path = gitops_output(
            days=days, namespace=namespace, format=fmt
        )
        if not path:
            return {"path": None, "message": "No recommendations"}
        return {"path": path, "format": fmt}
    except Exception as e:
        return {"path": None, "error": str(e)}


@router.get("/chargeback/by-team")
def get_cost_by_team(days: int = 7):
    try:
        from core.analytics.chargeback import cost_by_team
        return {"items": cost_by_team(days)}
    except Exception as e:
        return {"items": [], "error": str(e)}


@router.get("/chargeback/by-app")
def get_cost_by_app(days: int = 7):
    try:
        from core.analytics.chargeback import cost_by_app
        return {"items": cost_by_app(days)}
    except Exception as e:
        return {"items": [], "error": str(e)}


@router.get("/chargeback/by-namespace")
def get_cost_by_namespace(days: int = 7):
    try:
        from core.analytics.chargeback import cost_by_namespace
        return {"items": cost_by_namespace(days)}
    except Exception as e:
        return {"items": [], "error": str(e)}


@router.get("/chargeback/by-environment")
def get_cost_by_env(days: int = 7):
    try:
        from core.analytics.chargeback import cost_by_environment
        return {"items": cost_by_environment(days)}
    except Exception as e:
        return {"items": [], "error": str(e)}


@router.get("/chargeback/by-billing-tag")
def get_cost_by_billing_tag(days: int = 7):
    try:
        from core.analytics.chargeback import cost_by_billing_tag
        return {"items": cost_by_billing_tag(days)}
    except Exception as e:
        return {"items": [], "error": str(e)}


@router.post("/chargeback/report")
def post_chargeback_report(req: dict = {}):
    """Generate chargeback report (json/csv/markdown)."""
    try:
        from core.analytics.chargeback import chargeback_report
        days = req.get("days", 30)
        group_by = req.get("group_by", "team")
        fmt = req.get("format", "json")
        return chargeback_report(days, group_by, fmt)
    except Exception as e:
        return {"error": str(e)}


@router.post("/chargeback/import-opencost")
def post_import_opencost(req: dict = {}):
    """Import cost data from OpenCost API."""
    try:
        from core.analytics.chargeback import import_opencost
        url = req.get("url")
        return import_opencost(url)
    except Exception as e:
        return {"error": str(e)}


@router.post("/chargeback/import-csv")
def post_import_csv(req: dict = {}):
    """Import cloud billing CSV."""
    try:
        from core.analytics.chargeback import import_billing_csv
        path = req.get("path", "")
        if not path:
            from fastapi import HTTPException
            raise HTTPException(400, "path required")
        return import_billing_csv(path)
    except Exception as e:
        return {"error": str(e)}


@router.get("/idle-resources")
def get_idle_resources():
    """Detect idle and orphaned resources."""
    try:
        from core.collectors.idle_resources import detect_all
        return detect_all()
    except Exception as e:
        return {"items": [], "summary": {}, "error": str(e)}


@router.post("/idle-resources/dry-run")
def post_cleanup_dry_run(req: dict = {}):
    """Generate cleanup commands without executing."""
    try:
        from core.collectors.idle_resources import cleanup_dry_run
        items = req.get("items")
        return cleanup_dry_run(items)
    except Exception as e:
        return {"commands": [], "error": str(e)}


@router.post("/idle-resources/cleanup")
def post_cleanup(req: dict = {}):
    """Execute cleanup (dry_run=true by default)."""
    try:
        from core.collectors.idle_resources import cleanup_execute
        items = req.get("items", [])
        dry_run = req.get("dry_run", True)
        if not items:
            from fastapi import HTTPException
            raise HTTPException(400, "items required")
        return cleanup_execute(items, dry_run=dry_run)
    except Exception as e:
        return {"error": str(e)}
