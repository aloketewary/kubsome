from core.context import context
from core.cache import cached
from core.k8s import get_raw_resources


@cached(ttl=5)
def collect_events(limit=50):
    data = get_raw_resources(
        "events", context.current_context, context.namespace
    )

    items = data.get("items", [])
    # Sort by lastTimestamp descending, take last N
    items.sort(
        key=lambda x: x.get("lastTimestamp") or "",
        reverse=True
    )

    events = []
    for item in items[:limit]:
        events.append({
            "type": item.get("type", "Normal"),
            "reason": item.get("reason", ""),
            "object": item.get(
                "involvedObject", {}
            ).get("name", ""),
            "kind": item.get(
                "involvedObject", {}
            ).get("kind", ""),
            "message": item.get("message", ""),
            "count": item.get("count", 1),
            "last_seen": item.get(
                "lastTimestamp", ""
            ),
        })

    return events
