import re
import subprocess
from fastapi import APIRouter
from pydantic import BaseModel

from core.context import context

router = APIRouter(tags=["terminal"])


class CommandRequest(BaseModel):
    command: str


@router.post("/exec")
def exec_command(req: CommandRequest):
    """Execute a KubeEasy CLI command and return output."""
    cmd = req.command.strip()

    if not cmd:
        return {"output": ""}

    # Direct kubectl passthrough for raw commands
    if cmd.startswith("kubectl") or cmd.startswith("k "):
        actual = cmd.replace("k ", "kubectl ", 1) if cmd.startswith("k ") else cmd
        actual += f" --context {context.current_context} -n {context.namespace}"
        result = subprocess.run(actual, shell=True, capture_output=True, text=True)
        output = result.stdout or result.stderr
        return {"output": output.strip(), "exit_code": result.returncode}

    # Run via kubeasy CLI in exec mode
    result = subprocess.run(
        f"python3 main.py --exec {cmd}",
        shell=True, capture_output=True, text=True,
        cwd="/Users/atewary/PetProjects/kubeasy",
    )
    output = result.stdout or result.stderr
    # Strip ANSI/Rich color codes for clean terminal output
    output = re.sub(r'\x1b\[[0-9;]*m', '', output)
    return {"output": output.strip(), "exit_code": result.returncode}
