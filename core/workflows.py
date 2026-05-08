"""
Workflows — chain multiple commands into reusable sequences.
Stored in ~/.kubsome/workflows/

Example workflow file (~/.kubsome/workflows/deploy-check.yaml):
  name: deploy-check
  description: Post-deployment verification
  steps:
    - overview
    - pods
    - events
    - alerts
"""

import yaml
from pathlib import Path

WORKFLOWS_DIR = Path.home() / ".kubsome" / "workflows"


def ensure_dir():
    WORKFLOWS_DIR.mkdir(parents=True, exist_ok=True)


def list_workflows():
    """List available workflows."""
    ensure_dir()
    workflows = []

    for f in WORKFLOWS_DIR.glob("*.yaml"):
        try:
            with open(f, "r") as file:
                data = yaml.safe_load(file)
                workflows.append({
                    "name": data.get("name", f.stem),
                    "description": data.get(
                        "description", ""
                    ),
                    "steps": data.get("steps", []),
                    "path": str(f),
                })
        except Exception:
            pass

    return workflows


def get_workflow(name):
    """Get a workflow by name."""
    workflows = list_workflows()
    for w in workflows:
        if w["name"] == name:
            return w
    return None


def create_workflow(name, description, steps):
    """Create a new workflow."""
    ensure_dir()

    data = {
        "name": name,
        "description": description,
        "steps": steps,
    }

    path = WORKFLOWS_DIR / f"{name}.yaml"
    with open(path, "w") as f:
        yaml.dump(data, f, default_flow_style=False)

    return str(path)


def create_default_workflows():
    """Create built-in example workflows."""
    ensure_dir()

    defaults = [
        {
            "name": "health",
            "description": "Full cluster health assessment",
            "steps": [
                "overview",
                "alerts",
                "check",
            ],
        },
        {
            "name": "deploy-check",
            "description": "Post-deployment verification",
            "steps": [
                "pods",
                "events",
                "alerts",
            ],
        },
        {
            "name": "debug",
            "description": "Debugging workflow",
            "steps": [
                "events",
                "which pods are unhealthy",
                "alerts",
            ],
        },
    ]

    for wf in defaults:
        path = WORKFLOWS_DIR / f"{wf['name']}.yaml"
        if not path.exists():
            with open(path, "w") as f:
                yaml.dump(wf, f, default_flow_style=False)
