from rapidfuzz import process

from core.kubeconfig import (
    enriched_contexts
)

import subprocess

from core.context import context
from core.state import save_state


def switch_context(ctx):

    command = (
        f"kubectl "
        f"config use-context "
        f"{ctx['name']}"
    )

    subprocess.run(
        command,
        shell=True
    )

    context.current_context = ctx["name"]
    context.namespace = ctx["namespace"]

    save_state(
        context.current_context,
        context.namespace
    )

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

    results = []

    for match in matches:

        if match[1] > 40:

            ctx = next(
                c for c in contexts
                if c["name"] == match[0]
            )

            results.append(ctx)

    return results