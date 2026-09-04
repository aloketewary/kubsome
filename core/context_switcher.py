from rapidfuzz import process

from core.kubeconfig import enriched_contexts

import subprocess

from core.context import context
from core.state import save_state


def switch_context(ctx, persist=True):
    """Switch active context, persisting kubeconfig only for CLI usage."""
    if persist:
        command = [
            "kubectl", "config", "use-context", ctx["name"]
        ]
        try:
            result = subprocess.run(command, timeout=10)
        except subprocess.TimeoutExpired:
            return False
        if result.returncode != 0:
            return False

    context.current_context = ctx["name"]
    context.namespace = ctx["namespace"]

    if persist:
        save_state(
            context.current_context,
            context.namespace
        )

    from core.cache import invalidate
    invalidate()
    return True


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
