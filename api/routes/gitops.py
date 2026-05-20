"""
GitOps & Mesh API routes — ArgoCD/Flux status and
service mesh visibility endpoints.
"""

from fastapi import APIRouter

router = APIRouter(tags=["gitops", "mesh"])


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
def get_analytics():
    from core.analytics.engine import get_stats
    return get_stats()


@router.post("/analytics/collect")
def post_collect():
    from core.analytics.collector import collect_now
    return collect_now()


@router.post("/analytics/maintenance")
def post_maintenance():
    from core.analytics.aggregator import run_maintenance
    return run_maintenance()


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
    return {"alerts": check_alerts()}


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
