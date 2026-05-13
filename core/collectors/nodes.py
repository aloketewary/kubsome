from core.context import context
from core.cache import cached
from core.k8s import get_raw_resources


@cached(ttl=5)
def collect_nodes():

    data = get_raw_resources(
        "nodes", context.current_context
    )

    nodes = []

    for item in data.get("items", []):

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