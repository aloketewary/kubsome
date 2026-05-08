import re
import subprocess
import os
from fastapi import APIRouter
from pydantic import BaseModel
from typing import Optional, List

from core.context import context
from core.resolver import (
    resolve_pod_name, resolve_deployment_name,
    resolve_cronjob_name
)

router = APIRouter(tags=["terminal"])

PROJECT_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


class CommandRequest(BaseModel):
    command: str
    selection: Optional[str] = None


class CommandResponse(BaseModel):
    output: str = ""
    exit_code: int = 0
    needs_selection: bool = False
    choices: List[str] = []
    selection_prompt: str = ""
    original_command: str = ""


# Commands that need resource name resolution
RESOURCE_COMMANDS = {
    "logs": "pod",
    "inspect": "pod",
    "diagnose": "pod",
    "shell": "pod",
    "rollout": "deployment",
    "rollback": "deployment",
    "restart": "deployment",
    "trace": "deployment",
    "diff": "deployment",
    "trigger": "cronjob",
}


@router.post("/exec")
def exec_command(req: CommandRequest):
    """Execute a command with interactive selection support."""
    cmd = req.command.strip()

    if not cmd:
        return {"output": "", "exit_code": 0}

    # If user is sending back a selection, rebuild and execute directly (skip matching)
    if req.selection:
        cmd = _rebuild_command(cmd, req.selection)
        return _run_kubsome(cmd)

    # Direct kubectl passthrough
    if cmd.startswith("kubectl") or cmd.startswith("k "):
        actual = cmd.replace("k ", "kubectl ", 1) if cmd.startswith("k ") else cmd
        if "--context" not in actual:
            actual += f" --context {context.current_context}"
        if "-n " not in actual and "--namespace" not in actual and "get ns" not in actual and "get namespaces" not in actual:
            actual += f" -n {context.namespace}"
        return _run(actual)

    # Help
    if cmd == "help":
        return {
            "output": (
                "Kubsome Commands:\n"
                "  pods, events, overview, nodes, services, deployments\n"
                "  top pods, top nodes\n"
                "  logs <pod>, inspect <pod>, diagnose <pod>, trace <dep>\n"
                "  rollout <dep>, restart <dep>, rollback <dep>, scale <dep> <n>\n"
                "  cronjobs, jobs, trigger <cj>, hpa, pdb, capacity, quota\n"
                "  security, optimize, unused, check, audit, timeline\n"
                "  find <query>, rbac, ingress, mesh\n"
                "  why is <pod> failing, summarize, what changed\n"
                "  kubectl <any command>, k <shorthand>\n"
                "  clear (clear terminal)\n"
            ),
            "exit_code": 0,
        }

    # Check if command needs interactive selection
    tokens = cmd.split()
    if len(tokens) >= 2 and tokens[0] in RESOURCE_COMMANDS:
        resource_type = RESOURCE_COMMANDS[tokens[0]]
        query = tokens[1]

        # Resolve matches
        if resource_type == "pod":
            matches = resolve_pod_name(query)
        elif resource_type == "deployment":
            matches = resolve_deployment_name(query)
        elif resource_type == "cronjob":
            matches = resolve_cronjob_name(query)
        else:
            matches = []

        # If multiple matches, ask user to pick
        if matches and len(matches) > 1:
            return {
                "output": "",
                "exit_code": 0,
                "needs_selection": True,
                "choices": matches[:10],  # Limit to 10
                "selection_prompt": f"Multiple {resource_type}s match '{query}'. Select one:",
                "original_command": cmd,
            }

    # Run via Kubsome CLI (auto-selects first match in non-TTY)
    return _run_kubsome(cmd)


@router.get("/completions")
def get_completions(q: str = ""):
    """Return command completions for the given input."""
    from core.completer import COMMANDS, POD_COMMANDS, get_pod_names

    text = q.strip()
    words = text.split()

    # Subcommand/argument completions
    if len(words) >= 2 or (len(words) == 1 and q.endswith(" ")):
        cmd = words[0]

        # Pod name completions
        if cmd in POD_COMMANDS:
            query = words[1] if len(words) > 1 else ""
            pods = get_pod_names()
            return {"completions": [p for p in pods if query.lower() in p.lower()][:8]}

        # Deployment name completions
        if cmd in ("rollout", "rollback", "restart", "trace", "scale", "diff"):
            query = words[1] if len(words) > 1 else ""
            matches = resolve_deployment_name(query) if query else []
            return {"completions": matches[:8]}

        return {"completions": []}

    # Top-level command completions
    query = words[0] if words else ""
    matches = [c for c in COMMANDS if c.startswith(query.lower())]
    return {"completions": matches[:10]}



def _rebuild_command(original_cmd: str, selection: str) -> str:
    """Replace the fuzzy query with the exact selection."""
    tokens = original_cmd.split()
    if len(tokens) >= 2 and tokens[0] in RESOURCE_COMMANDS:
        tokens[1] = selection
    return " ".join(tokens)


def _run_kubsome(cmd: str):
    """Run a Kubsome command via main.py --exec."""
    venv_python = os.path.join(PROJECT_DIR, "venv", "bin", "python")
    python = venv_python if os.path.exists(venv_python) else "python3"
    return _run(f"{python} main.py --exec {cmd}", cwd=PROJECT_DIR, timeout=20)


def _run(command: str, timeout: int = 15, cwd: str = None):
    """Run a shell command with timeout."""
    try:
        result = subprocess.run(
            command, shell=True, capture_output=True,
            text=True, timeout=timeout, cwd=cwd,
        )
        output = result.stdout or result.stderr
        output = re.sub(r'\x1b\[[0-9;]*m', '', output)
        output = re.sub(r'\[/?[a-z ]+\]', '', output)
        return {"output": output.strip(), "exit_code": result.returncode}
    except subprocess.TimeoutExpired:
        return {"output": f"Command timed out after {timeout}s", "exit_code": 1}
    except Exception as e:
        return {"output": f"Error: {str(e)}", "exit_code": 1}
