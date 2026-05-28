"""
Taints Collector — fetch, apply, and remove node taints.
"""

import subprocess
import json

from core.context import context
from core.cache import cached


@cached(ttl=10)
def collect_taints():
    """Fetch all node taints. Returns list of dicts."""
    cmd = [
        "kubectl", "--context", str(context.current_context or ""),
        "get", "nodes", "-o", "json"
    ]
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        return []

    data = json.loads(result.stdout)
    nodes = []
    for item in data.get("items", []):
        name = item["metadata"]["name"]
        taints = item.get("spec", {}).get("taints") or []
        nodes.append({
            "node": name,
            "taints": [
                {
                    "key": t.get("key", ""),
                    "value": t.get("value", ""),
                    "effect": t.get("effect", ""),
                }
                for t in taints
            ],
        })
    return nodes


def apply_taint(node, taint_spec):
    """
    Apply a taint to a node.
    taint_spec: "key=value:Effect" or "key:Effect"
    """
    cmd = [
        "kubectl", "--context", str(context.current_context or ""),
        "taint", "nodes", node, taint_spec,
    ]
    result = subprocess.run(cmd, capture_output=True, text=True)
    return result.returncode == 0, result.stdout.strip() or result.stderr.strip()


def remove_taint(node, taint_spec):
    """
    Remove a taint from a node.
    taint_spec: "key:Effect-" (trailing dash)
    """
    spec = taint_spec if taint_spec.endswith("-") else taint_spec + "-"
    cmd = [
        "kubectl", "--context", str(context.current_context or ""),
        "taint", "nodes", node, spec,
    ]
    result = subprocess.run(cmd, capture_output=True, text=True)
    return result.returncode == 0, result.stdout.strip() or result.stderr.strip()
