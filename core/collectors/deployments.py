from core.context import context
from core.cache import cached
from core.k8s import get_raw_resources


@cached(ttl=5)
def collect_deployments():

    data = get_raw_resources(
        "deployments", context.current_context, context.namespace
    )

    deployments = []

    for item in data.get("items", []):

        desired = item["spec"]["replicas"]

        available = item["status"].get(
            "availableReplicas",
            0
        )

        deployments.append({
            "name": item["metadata"]["name"],
            "desired": desired,
            "available": available
        })

    return deployments