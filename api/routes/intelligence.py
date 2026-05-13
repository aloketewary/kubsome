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
    last_target: str = None


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


_last_alert_count = 0

@router.get("/anomalies")
def get_anomalies():
    global _last_alert_count
    alerts = detect_anomalies()
    # Only notify webhook if alert count increased (avoid spam)
    if alerts and len(alerts) > _last_alert_count:
        from core.notify import notify_if_critical
        notify_if_critical(alerts)
    _last_alert_count = len(alerts) if alerts else 0
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
    from core.nlp.matcher import parse_query
    from core.context import context

    # Temporarily set context memory for this request if provided
    if req.last_target:
        context.last_target = req.last_target

    parsed = parse_query(req.query)

    # Check if query references an ambiguous resource
    clarification = _check_ambiguity(req.query, parsed)
    if clarification:
        return clarification

    response = handle_ai_query(req.query)
    content = response.get("content", "")

    # Convert Rich markup to HTML for the UI
    html = _rich_to_html(content)

    # Also provide plain text fallback
    plain = re.sub(r'\[/?[^\]]+\]', '', content)

    return {
        "title": response.get("title", "").replace("🤖 ", ""),
        "answer": plain,
        "html": html,
        "severity": response.get("severity", "info"),
        "last_target": context.last_target
    }


def _rich_to_html(content: str) -> str:
    """Convert Rich markup to HTML for web UI rendering."""
    import re

    html = content

    # Escape HTML entities first
    html = html.replace("&", "&amp;")
    html = html.replace("<", "&lt;")
    html = html.replace(">", "&gt;")

    # Bold
    html = re.sub(
        r'\[bold(?:\s+\w+)?\](.*?)\[/bold(?:\s+\w+)?\]',
        r'<strong>\1</strong>', html
    )
    html = re.sub(
        r'\[bold\](.*?)\[/bold\]',
        r'<strong>\1</strong>', html
    )

    # Colors → spans with class
    color_map = {
        "red": "clr-red",
        "green": "clr-green",
        "yellow": "clr-yellow",
        "cyan": "clr-cyan",
        "dim": "clr-dim",
    }
    for color, cls in color_map.items():
        # [red]...[/red] and [bold red]...[/bold red]
        html = re.sub(
            rf'\[(?:bold )?{color}\](.*?)\[/(?:bold )?{color}\]',
            rf'<span class="{cls}">\1</span>', html
        )

    # Remove any remaining Rich tags
    html = re.sub(r'\[/?[^\]]+\]', '', html)

    # Convert newlines to <br>
    html = html.replace("\n", "<br>")

    return html


def _check_ambiguity(query: str, parsed=None):
    """If query mentions a resource with multiple matches, return options."""
    from core.collectors.pods import collect_pods
    import re

    # Use target from unified NLP engine if available
    target = parsed["entities"].get("target") if parsed else None

    if not target:
        # Fallback to old patterns if needed
        lower = query.lower()
        patterns = [
            r"why is (\S+)",
            r"diagnose (\S+)",
            r"inspect (\S+)",
            r"logs for (\S+)",
            r"logs of (\S+)",
            r"trace (\S+)",
            r"describe (\S+)",
            r"what'?s wrong with (\S+)",
        ]

        for pattern in patterns:
            match = re.search(pattern, lower)
            if match:
                target = match.group(1).rstrip("?")
                break

    if not target:
        return None

    # Use substring matching to find ALL pods containing target
    pods = collect_pods()
    matching = [
        p["name"] for p in pods
        if target in p["name"].lower()
    ]

    if not matching or len(matching) <= 1:
        return None

    # Multiple matches — ask user to pick
    return {
        "title": f"Which '{target}'?",
        "answer": (
            f"Multiple pods match '{target}'. "
            f"Select one to continue:"
        ),
        "severity": "clarify",
        "options": matching[:8],
        "original_query": query,
    }
