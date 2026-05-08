import subprocess
import json


def compare_contexts(ctx_a, ctx_b, ns_a, ns_b):
    """
    Compare deployments between two contexts
    using each context's own namespace.
    """
    deps_a = _get_deployments(ctx_a, ns_a)
    deps_b = _get_deployments(ctx_b, ns_b)

    names_a = {d["name"] for d in deps_a}
    names_b = {d["name"] for d in deps_b}

    only_a = names_a - names_b
    only_b = names_b - names_a
    common = names_a & names_b

    diffs = []

    for name in sorted(common):
        dep_a = next(
            d for d in deps_a if d["name"] == name
        )
        dep_b = next(
            d for d in deps_b if d["name"] == name
        )

        changes = []

        if dep_a["image"] != dep_b["image"]:
            changes.append({
                "field": "image",
                "a": dep_a["image"],
                "b": dep_b["image"],
            })

        if dep_a["replicas"] != dep_b["replicas"]:
            changes.append({
                "field": "replicas",
                "a": str(dep_a["replicas"]),
                "b": str(dep_b["replicas"]),
            })

        if changes:
            diffs.append({
                "name": name,
                "changes": changes,
            })

    return {
        "ctx_a": ctx_a,
        "ctx_b": ctx_b,
        "ns_a": ns_a,
        "ns_b": ns_b,
        "only_a": sorted(only_a),
        "only_b": sorted(only_b),
        "diffs": diffs,
        "in_sync": len(diffs) == 0 and not only_a and not only_b,
    }


def _get_deployments(ctx, namespace):
    cmd = (
        f"kubectl --context {ctx} "
        f"get deployments -n {namespace} -o json"
    )

    result = subprocess.run(
        cmd, shell=True,
        capture_output=True, text=True
    )

    if result.returncode != 0:
        return []

    data = json.loads(result.stdout)
    deployments = []

    for item in data.get("items", []):
        containers = item["spec"].get(
            "template", {}
        ).get("spec", {}).get("containers", [])

        image = (
            containers[0].get("image", "")
            if containers else ""
        )

        deployments.append({
            "name": item["metadata"]["name"],
            "replicas": item["spec"].get("replicas", 0),
            "image": image,
        })

    return deployments
