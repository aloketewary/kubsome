"""
Safe execution wrapper — catches kubectl failures
and returns friendly error messages instead of tracebacks.
"""

import subprocess
import json
from functools import wraps

from rich.console import Console

console = Console()


def safe_kubectl(func):
    """Decorator for collector functions that call kubectl."""
    @wraps(func)
    def wrapper(*args, **kwargs):
        try:
            return func(*args, **kwargs)
        except json.JSONDecodeError:
            console.print(
                "[red]Error: Invalid response from kubectl[/red]"
            )
            return None
        except subprocess.SubprocessError as e:
            console.print(
                f"[red]kubectl error: {e}[/red]"
            )
            return None
        except Exception as e:
            console.print(
                f"[red]Error: {e}[/red]"
            )
            return None
    return wrapper


def check_kubectl():
    """Verify kubectl is available and configured."""
    result = subprocess.run(
        ["kubectl", "version", "--client"],
        capture_output=True,
        text=True
    )

    if result.returncode != 0:
        return False, "kubectl not found in PATH"

    # Check if context is set
    result = subprocess.run(
        ["kubectl", "config", "current-context"],
        capture_output=True,
        text=True
    )

    if result.returncode != 0:
        return False, "No kubectl context configured"

    return True, result.stdout.strip()


def check_cluster_access():
    """Quick connectivity check."""
    result = subprocess.run(
        ["kubectl", "cluster-info"],
        capture_output=True,
        text=True,
        timeout=5
    )

    return result.returncode == 0
