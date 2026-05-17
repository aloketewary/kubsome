from rapidfuzz import process

from core.kubeconfig import (
    enriched_contexts
)

import subprocess

from core.context import context
from core.state import save_state


def switch_context(ctx):

    command = [
        "kubectl", "config", "use-context", ctx["name"]
    ]

    subprocess.run(command)

    context.current_context = ctx["name"]
    context.namespace = ctx["namespace"]

    save_state(
        context.current_context,
        context.namespace
    )

    from core.cache import invalidate
    invalidate()

def find_context(query: str):
    contexts = enriched_contexts()

    names = [
        ctx["name"]
        for ctx in contexts
    ]

    matches = process.extract(
        query,
        names,
        limit=5
    )

    if not matches:
        return []

    # Strong match — return only that one
    if matches[0][1] > 80:
        ctx = next(
            c for c in contexts
            if c["name"] == matches[0][0]
        )
        return [ctx]

    results = []
    for match in matches:
        if match[1] > 40:
            ctx = next(
                c for c in contexts
                if c["name"] == match[0]
            )
            results.append(ctx)

    return results