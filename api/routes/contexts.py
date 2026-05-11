from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from core.kubeconfig import enriched_contexts
from core.context_switcher import find_context, switch_context
from core.context import context

router = APIRouter(tags=["contexts"])


class SwitchRequest(BaseModel):
    name: str


@router.get("/contexts")
def get_contexts():
    return {
        "current": context.current_context,
        "namespace": context.namespace,
        "contexts": enriched_contexts(),
    }


@router.post("/switch-context")
def post_switch_context(req: SwitchRequest):
    matches = find_context(req.name)
    if not matches:
        raise HTTPException(status_code=404, detail="No matching context")

    target = matches[0]
    switch_context(target)
    return {
        "switched_to": target["name"],
        "namespace": target["namespace"],
        "environment": target.get("environment"),
    }


class NamespaceRequest(BaseModel):
    namespace: str


@router.get("/namespaces")
def get_namespaces():
    import subprocess
    result = subprocess.run(
        [
            "kubectl", "--context", context.current_context,
            "get", "namespaces", "-o", "jsonpath={.items[*].metadata.name}"
        ],
        capture_output=True, text=True,
    )
    if result.returncode != 0:
        return {"namespaces": [], "current": context.namespace}
    raw = result.stdout.strip().strip("'")
    namespaces = sorted([ns for ns in raw.split() if ns])
    return {"namespaces": namespaces, "current": context.namespace}


@router.post("/switch-namespace")
def post_switch_namespace(req: NamespaceRequest):
    from core.state import save_state
    from core.cache import invalidate
    context.namespace = req.namespace
    save_state(context.current_context, context.namespace)
    invalidate()
    return {"namespace": context.namespace}


@router.get("/namespaces/{ctx}")
def get_namespaces_for(ctx: str):
    """Get namespaces for a specific context without switching global state."""
    import subprocess
    result = subprocess.run(
        [
            "kubectl", "--context", ctx, "get", "namespaces",
            "-o", "jsonpath={.items[*].metadata.name}"
        ],
        capture_output=True, text=True,
        timeout=10,
    )
    if result.returncode != 0:
        error = result.stderr.strip() if result.stderr else "Unknown error"
        return {
            "namespaces": [],
            "error": f"Cannot reach cluster: {error}",
        }
    raw = result.stdout.strip().strip("'")
    namespaces = sorted([ns for ns in raw.split() if ns])
    return {"namespaces": namespaces}


@router.get("/ns-for-context")
def get_ns_for_context(ctx: str = ""):
    """Get namespaces for a context using query param (handles special chars)."""
    import subprocess
    if not ctx:
        return {"namespaces": []}
    result = subprocess.run(
        ["kubectl", "--context", ctx, "get", "namespaces",
         "-o", "jsonpath={.items[*].metadata.name}"],
        capture_output=True, text=True, timeout=10,
    )
    if result.returncode != 0:
        return {"namespaces": [], "error": result.stderr.strip() or "Failed"}
    raw = result.stdout.strip().strip("'")
    namespaces = sorted([ns for ns in raw.split() if ns])
    return {"namespaces": namespaces}
