"""
ConfigMap & Secret viewer — display config data
with secrets masked for safety.
"""

import subprocess
import json
import base64

from core.context import context


def get_configmap(name):
    """Get configmap data."""
    ns = context.namespace
    ctx = context.current_context

    cmd = [
        "kubectl", "--context", str(ctx or ""),
        "get", "configmap", name, "-n", str(ns), "-o", "json"
    ]

    r = subprocess.run(
        cmd,
        capture_output=True, text=True
    )

    if r.returncode != 0:
        return None

    data = json.loads(r.stdout)

    return {
        "name": name,
        "type": "ConfigMap",
        "data": data.get("data", {}),
        "keys": list(data.get("data", {}).keys()),
    }


def get_secret(name, reveal=False):
    """
    Get secret metadata. Values are masked unless
    reveal=True (requires explicit confirmation).
    """
    ns = context.namespace
    ctx = context.current_context

    cmd = [
        "kubectl", "--context", str(ctx or ""),
        "get", "secret", name, "-n", str(ns), "-o", "json"
    ]

    r = subprocess.run(
        cmd,
        capture_output=True, text=True
    )

    if r.returncode != 0:
        return None

    data = json.loads(r.stdout)
    secret_data = data.get("data", {})

    display_data = {}
    for key, value in secret_data.items():
        if reveal:
            try:
                decoded = base64.b64decode(value).decode()
                display_data[key] = decoded
            except Exception:
                display_data[key] = "<binary>"
        else:
            display_data[key] = "••••••••"

    return {
        "name": name,
        "type": data.get("type", "Opaque"),
        "data": display_data,
        "keys": list(secret_data.keys()),
    }
