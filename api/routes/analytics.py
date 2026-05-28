"""
Analytics API Routes — exposes DuckDB analytics engine
to the Web UI (charts, cost, alerts, predictions, SQL, export).
"""

from fastapi import APIRouter, Query

from core.context import context

router = APIRouter(tags=["analytics"])


@router.get("/analytics")
def get_analytics_stats():
    """Storage stats and collection info."""
    try:
        from core.analytics.engine import get_stats
        return get_stats()
    except ImportError:
        return {"error": "duckdb not installed"}
    except Exception as e:
        return {"error": str(e)}


@router.post("/analytics/collect")
def collect_now():
    """Trigger immediate collection cycle."""
    try:
        from core.analytics.collector import collect_now as _collect
        result = _collect()
        return {"status": "ok", **result}
    except ImportError:
        return {"error": "duckdb not installed"}
    except Exception as e:
        return {"error": str(e)}


@router.get("/analytics/cost")
def get_cost_attribution(
    days: int = Query(7, ge=1, le=90),
    model: str = Query("default"),
):
    """Cost per deployment."""
    try:
        from core.analytics.cost_model import (
            cost_by_deployment, monthly_cost_summary,
        )
        deployments = cost_by_deployment(days=days, model=model)
        summary = monthly_cost_summary(model=model)
        return {"deployments": deployments, "summary": summary}
    except ImportError:
        return {"deployments": [], "summary": None}
    except Exception as e:
        return {"deployments": [], "summary": None, "error": str(e)}


@router.get("/analytics/alerts")
def get_alerts():
    """Threshold-based alerts from analytics data."""
    try:
        from core.analytics.alerts import check_alerts
        return {"alerts": check_alerts()}
    except ImportError:
        return {"alerts": []}
    except Exception as e:
        return {"alerts": [], "error": str(e)}


@router.get("/analytics/predictions")
def get_predictions():
    """Predictive alerts (resource exhaustion forecasts)."""
    try:
        from core.analytics.predictive import check_predictive_alerts
        return {"predictions": check_predictive_alerts()}
    except ImportError:
        return {"predictions": []}
    except Exception as e:
        return {"predictions": [], "error": str(e)}


@router.get("/analytics/series/cpu-memory")
def get_cpu_memory_series(
    hours: int = Query(24, ge=1, le=168),
    deployment: str = Query(None),
):
    """Time-series CPU/memory for charting."""
    try:
        from core.analytics.timeseries import cpu_memory_series
        series = cpu_memory_series(
            deployment=deployment, hours=hours,
        )
        return {"series": series}
    except ImportError:
        return {"series": []}
    except Exception as e:
        return {"series": [], "error": str(e)}


@router.get("/analytics/series/cost")
def get_cost_series(days: int = Query(30, ge=1, le=365)):
    """Daily cost trend for bar chart."""
    try:
        from core.analytics.timeseries import cost_series
        return {"series": cost_series(days=days)}
    except ImportError:
        return {"series": []}
    except Exception as e:
        return {"series": [], "error": str(e)}


@router.get("/analytics/series/top-consumers")
def get_top_consumers(hours: int = Query(6, ge=1, le=48)):
    """Top resource consumers."""
    try:
        from core.analytics.timeseries import top_consumers
        return {"consumers": top_consumers(hours=hours)}
    except ImportError:
        return {"consumers": []}
    except Exception as e:
        return {"consumers": [], "error": str(e)}


@router.get("/analytics/series/events")
def get_event_series(hours: int = Query(24, ge=1, le=168)):
    """Event timeline bucketed by hour."""
    try:
        from core.analytics.timeseries import event_timeline
        return {"series": event_timeline(hours=hours)}
    except ImportError:
        return {"series": []}
    except Exception as e:
        return {"series": [], "error": str(e)}


@router.post("/analytics/query")
def run_sql_query(body: dict):
    """Run custom SQL against analytics DB."""
    sql = body.get("sql", "").strip()
    if not sql:
        return {"error": "No SQL provided"}
    # Safety: block destructive statements
    first_word = sql.split()[0].upper() if sql.split() else ""
    if first_word in ("DROP", "DELETE", "TRUNCATE", "ALTER", "UPDATE"):
        return {"error": f"{first_word} not allowed via API"}
    try:
        from core.analytics.export import run_custom_query
        return run_custom_query(sql)
    except ImportError:
        return {"error": "duckdb not installed"}
    except Exception as e:
        return {"error": str(e)}


@router.get("/analytics/export/{query_name}")
def export_data(
    query_name: str,
    fmt: str = Query("csv"),
    days: int = Query(7, ge=1, le=365),
):
    """Export analytics data to CSV or Parquet."""
    try:
        if fmt == "parquet":
            from core.analytics.export import export_parquet
            path = export_parquet(query_name=query_name, days=days)
        else:
            from core.analytics.export import export_csv
            path = export_csv(query_name=query_name, days=days)

        if not path:
            return {"error": f"Unknown query: {query_name}"}
        return {"path": path, "format": fmt}
    except ImportError:
        return {"error": "duckdb not installed"}
    except Exception as e:
        return {"error": str(e)}
