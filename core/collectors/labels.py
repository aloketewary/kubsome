"""
Labels & Annotations viewer.
"""

import subprocess
import json

from core.context import context


def get_labels(resource_type, name=None):
    """Get labels for a resource or all resources of a type."""
    ns = context.namespace
    ctx = context.current_context

    if name:
        cmd = (
            f"kubectl --context {ctx} "
            f"get {resource_type} {name} "
            f"-n {ns} -o json"
        )
    else:
        cmd = (
            f"kubectl --context {ctx} "
            f"get {resource_type} "
            f"-n {ns} -o json"
        )

    r = subprocess.run(
        cmd, shell=True,
        capture_output=True, text=True
    )

    if r.returncode != 0:
        return []

    data = json.loads(r.stdout)

    results = []

    if "items" in data:
        for item in data["items"]:
            results.append({
                "name": item["metadata"]["name"],
                "labels": item["metadata"].get("labels", {}),
                "annotations": item["metadata"].get("annotations", {}),
            })
    else:
        results.append({
            "name": data["metadata"]["name"],
            "labels": data["metadata"].get("labels", {}),
            "annotations": data["metadata"].get("annotations", {}),
        })

    return results


def find_by_label(resource_type, label_selector):
    """Find resources matching a label selector."""
    ns = context.namespace
    ctx = context.current_context

    cmd = (
        f"kubectl --context {ctx} "
        f"get {resource_type} -n {ns} "
        f"-l {label_selector} "
        f"-o jsonpath='{{.items[*].metadata.name}}'"
    )

    r = subprocess.run(
        cmd, shell=True,
        capture_output=True, text=True
    )

    names = r.stdout.strip("'").split()
    return [n for n in names if n]
