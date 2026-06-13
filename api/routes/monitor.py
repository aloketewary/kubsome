"""
Monitor API — exposes deployment health, trends,
and incident candidates from the health engine.

Primary data source for Monitor and Health Signals UI.
"""

from fastapi import APIRouter, Query

from core.context import context

router = APIRouter(tags=["monitor"])


@router.get("/monitor/health")
def get_deployment_health():
    """
    Current deployment health snapshot.
    Primary UI source for Monitor cards.
    """
    try:
        from core.analytics.health import (
            deployment_health_current,
        )
        deployments = deployment_health_current()
        return {
            "context": context.current_context,
            "namespace": context.namespace,
            "deployments": deployments,
        }
    except ImportError:
        return {
            "deployments": [],
            "error": "duckdb not installed",
        }
    except Exception as e:
        return {"deployments": [], "error": str(e)}


@router.get("/monitor/health/{deployment}")
def get_deployment_trend(
    deployment: str,
    hours: int = Query(1, ge=1, le=168),
):
    """
    Health trend for a single deployment.
    Returns current score, previous score, and delta.
    """
    try:
        from core.analytics.health import deployment_trend
        trend = deployment_trend(
            deployment, hours=hours
        )
        if not trend:
            return {
                "deployment": deployment,
                "current": None,
                "previous": None,
                "trend": None,
            }
        return {"deployment": deployment, **trend}
    except ImportError:
        return {"error": "duckdb not installed"}
    except Exception as e:
        return {"error": str(e)}


@router.get("/monitor/incidents")
def get_incidents():
    """Open/active incident candidates."""
    try:
        from core.analytics.health import open_incidents
        incidents = open_incidents()
        return {
            "context": context.current_context,
            "namespace": context.namespace,
            "incidents": incidents,
        }
    except ImportError:
        return {
            "incidents": [],
            "error": "duckdb not installed",
        }
    except Exception as e:
        return {"incidents": [], "error": str(e)}
