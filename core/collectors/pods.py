import subprocess
import json

from core.context import context
from core.cache import cached


@cached(ttl=5)
def collect_pods():
    """Collect pod summary data using custom-columns for speed."""
    cmd = (
        f"kubectl --context {context.current_context} "
        f"get pods -n {context.namespace} "
        f"-o jsonpath='"
        f'{{range .items}}'
        f'{{.metadata.name}}\t'
        f'{{.status.phase}}\t'
        f'{{range .status.containerStatuses}}'
        f'{{.restartCount}}{{end}}\n'
        f"{{end}}'"
    )

    result = subprocess.run(
        cmd, shell=True,
        capture_output=True, text=True
    )

    if result.returncode != 0 or not result.stdout.strip("'").strip():
        return []

    pods = []
    for line in result.stdout.strip("'").strip().split("\n"):
        if not line.strip():
            continue
        parts = line.split("\t")
        if len(parts) < 2:
            continue
        name = parts[0]
        status = parts[1]
        restarts = int(parts[2]) if len(parts) > 2 and parts[2].isdigit() else 0
        pods.append({
            "name": name,
            "status": status,
            "restarts": restarts,
        })

    return pods