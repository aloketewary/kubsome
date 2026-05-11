from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from core.context import context
from core.collectors.deployments import collect_deployments
from core.collectors.rollouts import (
    rollout_status, rollout_history,
    rollout_rollback, rollout_restart,
)

import subprocess

router = APIRouter(tags=["deployments"])


class ScaleRequest(BaseModel):
    replicas: int
    relative: bool = False


@router.get("/deployments")
def get_deployments():
    return {
        "context": context.current_context,
        "namespace": context.namespace,
        "deployments": collect_deployments(),
    }


@router.get("/rollout/{name}")
def get_rollout(name: str):
    status = rollout_status(name)
    history = rollout_history(name)
    return {"name": name, "status": status, "history": history}


@router.post("/restart/{name}")
def post_restart(name: str):
    success, output = rollout_restart(name)
    if not success:
        raise HTTPException(status_code=500, detail="Restart failed")
    return {"restarted": name}


@router.post("/rollback/{name}")
def post_rollback(name: str):
    success, output = rollout_rollback(name)
    if not success:
        raise HTTPException(status_code=500, detail="Rollback failed")
    return {"rolled_back": name}


@router.post("/scale/{name}")
def post_scale(name: str, req: ScaleRequest):
    replicas = req.replicas
    if req.relative:
        # Get current replica count
        get_cmd = [
            "kubectl", "--context", str(context.current_context),
            "get", f"deployment/{name}", "-n", str(context.namespace),
            "-o", "jsonpath={.spec.replicas}"
        ]
        r = subprocess.run(get_cmd, capture_output=True, text=True)
        current = int(r.stdout.strip()) if r.returncode == 0 and r.stdout.strip().isdigit() else 1
        replicas = max(0, current + req.replicas)
    cmd = [
        "kubectl", "--context", str(context.current_context),
        "scale", f"deployment/{name}",
        f"--replicas={replicas}", "-n", str(context.namespace)
    ]
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        raise HTTPException(status_code=500, detail=result.stderr.strip())
    return {"scaled": name, "replicas": replicas}
