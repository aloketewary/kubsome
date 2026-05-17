"""
Doctor — pre-flight diagnostics for Kubsome.
Checks kubectl, cluster connectivity, metrics-server,
config validity, and optional dependencies.
"""

import subprocess
import shutil
from pathlib import Path

from core.config import CONFIG_PATH, load_config


def run_doctor():
    """
    Run all pre-flight checks.
    Returns list of {name, status, detail} dicts.
    status: "ok", "warn", "fail"
    """
    checks = [
        _check_kubectl(),
        _check_cluster(),
        _check_metrics_server(),
        _check_config(),
        _check_namespace(),
        _check_optional_deps(),
    ]
    return checks


def _check_kubectl():
    """Verify kubectl is installed and accessible."""
    path = shutil.which("kubectl")
    if not path:
        return {
            "name": "kubectl",
            "status": "fail",
            "detail": "Not found in PATH. Install: https://kubernetes.io/docs/tasks/tools/",
        }

    result = subprocess.run(
        ["kubectl", "version", "--client", "--short"],
        capture_output=True, text=True, timeout=5,
    )
    version = result.stdout.strip() or "unknown"
    return {
        "name": "kubectl",
        "status": "ok",
        "detail": f"{version} ({path})",
    }


def _check_cluster():
    """Verify cluster is reachable."""
    try:
        result = subprocess.run(
            ["kubectl", "cluster-info"],
            capture_output=True, text=True, timeout=10,
        )
        if result.returncode == 0:
            # Extract first line (control plane URL)
            first_line = result.stdout.strip().split("\n")[0]
            # Strip ANSI codes
            import re
            clean = re.sub(r'\x1b\[[0-9;]*m', '', first_line)
            return {
                "name": "Cluster",
                "status": "ok",
                "detail": clean[:80],
            }
        return {
            "name": "Cluster",
            "status": "fail",
            "detail": result.stderr.strip()[:100] or "Cannot reach cluster",
        }
    except subprocess.TimeoutExpired:
        return {
            "name": "Cluster",
            "status": "fail",
            "detail": "Connection timed out (10s)",
        }
    except Exception as e:
        return {
            "name": "Cluster",
            "status": "fail",
            "detail": str(e)[:80],
        }


def _check_metrics_server():
    """Check if metrics-server is available."""
    try:
        result = subprocess.run(
            ["kubectl", "top", "nodes"],
            capture_output=True, text=True, timeout=10,
        )
        if result.returncode == 0:
            return {
                "name": "metrics-server",
                "status": "ok",
                "detail": "Available (top commands will work)",
            }
        return {
            "name": "metrics-server",
            "status": "warn",
            "detail": "Not available — top pods/nodes won't work",
        }
    except Exception:
        return {
            "name": "metrics-server",
            "status": "warn",
            "detail": "Could not verify",
        }


def _check_config():
    """Verify Kubsome config exists and is valid."""
    if not CONFIG_PATH.exists():
        return {
            "name": "Config",
            "status": "warn",
            "detail": f"Not found. Run: kubsome init",
        }

    try:
        config = load_config()
        keys = len(config)
        return {
            "name": "Config",
            "status": "ok",
            "detail": f"{CONFIG_PATH} ({keys} settings)",
        }
    except Exception as e:
        return {
            "name": "Config",
            "status": "fail",
            "detail": f"Invalid YAML: {e}",
        }


def _check_namespace():
    """Verify current namespace exists."""
    from core.context import context

    ns = context.namespace
    ctx = context.current_context

    if not ctx:
        return {
            "name": "Namespace",
            "status": "warn",
            "detail": "No context set",
        }

    try:
        result = subprocess.run(
            [
                "kubectl", "--context", ctx,
                "get", "namespace", ns,
            ],
            capture_output=True, text=True, timeout=5,
        )
        if result.returncode == 0:
            return {
                "name": "Namespace",
                "status": "ok",
                "detail": f"'{ns}' exists in context '{ctx}'",
            }
        return {
            "name": "Namespace",
            "status": "warn",
            "detail": f"'{ns}' not found — commands may fail",
        }
    except Exception:
        return {
            "name": "Namespace",
            "status": "warn",
            "detail": "Could not verify",
        }


def _check_optional_deps():
    """Check optional Python dependencies."""
    missing = []

    try:
        import textual  # noqa: F401
    except ImportError:
        missing.append("textual (for TUI)")

    if not missing:
        return {
            "name": "Optional deps",
            "status": "ok",
            "detail": "All optional packages installed",
        }

    return {
        "name": "Optional deps",
        "status": "warn",
        "detail": f"Missing: {', '.join(missing)}",
    }
