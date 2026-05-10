"""
YAML Diff — side-by-side comparison of deployment
revisions showing exact line changes.
"""

import subprocess
import json
import difflib

from core.context import context


def yaml_diff(deployment_name, rev_a=None, rev_b=None):
    """
    Compare two revisions of a deployment.
    If no revisions specified, compares current vs previous.
    """
    ctx = context.current_context
    ns = context.namespace

    yaml_a = _get_yaml(ctx, ns, deployment_name, rev_a)
    yaml_b = _get_yaml(ctx, ns, deployment_name, rev_b)

    if not yaml_a or not yaml_b:
        return {
            "deployment": deployment_name,
            "available": False,
            "reason": "Cannot fetch revisions",
        }

    # Generate unified diff
    lines_a = yaml_a.split("\n")
    lines_b = yaml_b.split("\n")

    diff = list(difflib.unified_diff(
        lines_a, lines_b,
        fromfile=f"revision {rev_a or 'previous'}",
        tofile=f"revision {rev_b or 'current'}",
        lineterm="",
    ))

    # Parse into structured changes
    additions = sum(
        1 for l in diff
        if l.startswith("+") and not l.startswith("+++")
    )
    deletions = sum(
        1 for l in diff
        if l.startswith("-") and not l.startswith("---")
    )

    # Side-by-side view
    side_by_side = _build_side_by_side(lines_a, lines_b)

    return {
        "deployment": deployment_name,
        "available": True,
        "diff_lines": diff,
        "additions": additions,
        "deletions": deletions,
        "total_changes": additions + deletions,
        "side_by_side": side_by_side,
        "yaml_a": yaml_a,
        "yaml_b": yaml_b,
    }


def _get_yaml(ctx, ns, deployment, revision=None):
    """Get deployment YAML at a specific revision."""
    if revision:
        cmd = (
            f"kubectl --context {ctx} "
            f"rollout history deployment/{deployment} "
            f"-n {ns} --revision={revision} "
            f"-o yaml"
        )
    else:
        cmd = (
            f"kubectl --context {ctx} "
            f"get deployment {deployment} "
            f"-n {ns} -o yaml"
        )

    result = subprocess.run(
        cmd, shell=True,
        capture_output=True, text=True,
        timeout=10,
    )
    if result.returncode != 0:
        return None
    return result.stdout


def _build_side_by_side(lines_a, lines_b):
    """Build side-by-side comparison."""
    matcher = difflib.SequenceMatcher(
        None, lines_a, lines_b
    )
    result = []

    for op, i1, i2, j1, j2 in matcher.get_opcodes():
        if op == "equal":
            for i in range(i1, i2):
                result.append({
                    "type": "equal",
                    "left": lines_a[i],
                    "right": lines_b[i - i1 + j1],
                    "line_a": i + 1,
                    "line_b": i - i1 + j1 + 1,
                })
        elif op == "replace":
            max_len = max(i2 - i1, j2 - j1)
            for k in range(max_len):
                left = lines_a[i1 + k] if i1 + k < i2 else ""
                right = lines_b[j1 + k] if j1 + k < j2 else ""
                result.append({
                    "type": "changed",
                    "left": left,
                    "right": right,
                    "line_a": i1 + k + 1 if left else None,
                    "line_b": j1 + k + 1 if right else None,
                })
        elif op == "delete":
            for i in range(i1, i2):
                result.append({
                    "type": "removed",
                    "left": lines_a[i],
                    "right": "",
                    "line_a": i + 1,
                    "line_b": None,
                })
        elif op == "insert":
            for j in range(j1, j2):
                result.append({
                    "type": "added",
                    "left": "",
                    "right": lines_b[j],
                    "line_a": None,
                    "line_b": j + 1,
                })

    return result
