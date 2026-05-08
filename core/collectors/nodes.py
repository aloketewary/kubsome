import subprocess
import json

from core.context import context


def collect_nodes():

    command = (
        f"kubectl "
        f"--context {context.current_context} "
        f"get nodes "
        f"-o json"
    )

    result = subprocess.run(
        command,
        shell=True,
        capture_output=True,
        text=True
    )

    if result.returncode != 0:
        return []

    data = json.loads(result.stdout)

    nodes = []

    for item in data["items"]:

        conditions = item["status"].get(
            "conditions",
            []
        )

        ready = False

        for cond in conditions:

            if (
                cond["type"] == "Ready"
                and cond["status"] == "True"
            ):
                ready = True

        nodes.append({
            "name": item["metadata"]["name"],
            "ready": ready
        })

    return nodes