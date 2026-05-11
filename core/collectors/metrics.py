import subprocess
import json
import re

from core.context import context
from core.cache import cached


@cached(ttl=5)
def top_pods():
    command = (
        f"kubectl "
        f"--context {context.current_context} "
        f"top pods "
        f"-n {context.namespace} "
        f"--no-headers"
    )

    result = subprocess.run(
        command,
        shell=True,
        capture_output=True,
        text=True
    )

    if result.returncode != 0:
        return []

    pods = []
    for line in result.stdout.strip().split("\n"):
        if not line.strip():
            continue
        parts = line.split()
        if len(parts) >= 3:
            pods.append({
                "name": parts[0],
                "cpu": parts[1],
                "memory": parts[2],
                "cpu_millicores": _parse_cpu(parts[1]),
                "memory_mb": _parse_memory(parts[2]),
            })

    return sorted(
        pods, key=lambda x: x["cpu_millicores"],
        reverse=True
    )


@cached(ttl=5)
def top_nodes():
    command = (
        f"kubectl "
        f"--context {context.current_context} "
        f"top nodes "
        f"--no-headers"
    )

    result = subprocess.run(
        command,
        shell=True,
        capture_output=True,
        text=True
    )

    if result.returncode != 0:
        return []

    nodes = []
    for line in result.stdout.strip().split("\n"):
        if not line.strip():
            continue
        parts = line.split()
        if len(parts) >= 5:
            nodes.append({
                "name": parts[0],
                "cpu": parts[1],
                "cpu_percent": parts[2],
                "memory": parts[3],
                "memory_percent": parts[4],
                "cpu_pct_val": _parse_percent(parts[2]),
                "mem_pct_val": _parse_percent(parts[4]),
            })

    return sorted(
        nodes, key=lambda x: x["cpu_pct_val"],
        reverse=True
    )


def _parse_cpu(val):
    """Parse cpu string like '250m' or '1' to millicores."""
    if val.endswith("m"):
        return int(val[:-1])
    if val.endswith("n"):
        return int(val[:-1]) // 1000000
    try:
        return int(float(val) * 1000)
    except ValueError:
        return 0


def _parse_memory(val):
    """Parse memory string like '128Mi' or '1Gi' to MB."""
    val = val.strip()
    if val.endswith("Mi"):
        return int(val[:-2])
    if val.endswith("Gi"):
        return int(float(val[:-2]) * 1024)
    if val.endswith("Ki"):
        return int(val[:-2]) // 1024
    try:
        return int(val) // (1024 * 1024)
    except ValueError:
        return 0


def _parse_percent(val):
    """Parse '45%' to 45."""
    try:
        return int(val.replace("%", ""))
    except ValueError:
        return 0
