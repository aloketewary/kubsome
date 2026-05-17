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
    If no revisions specified, compares previous vs current.
    """
    ctx = context.current_context
    ns = context.namespace

    # Get current YAML
    yaml_b = _get_current_yaml(ctx, ns, deployment_name)

    # Get previous revision YAML
    if rev_a:
        yaml_a = _get_revision_yaml(
            ctx, ns, deployment_name, rev_a
        )
    else:
        yaml_a = _get_previous_yaml(
            ctx, ns, deployment_name
        )

    if not yaml_a or not yaml_b:
        return {
            "deployment": deployment_name,
            "available": False,
            "reason": "Cannot fetch revisions (need at least 2)",
        }

    # Generate unified diff
    lines_a = yaml_a.split("\n")
    lines_b = yaml_b.split("\n")

    # Filter to pod template section for cleaner diff
    lines_a = _extract_pod_template(lines_a)
    lines_b = _extract_pod_template(lines_b)

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


def _get_current_yaml(ctx, ns, deployment):
    """Get current deployment YAML."""
    cmd = [
        "kubectl", "--context", str(ctx or ""),
        "get", "deployment", deployment,
        "-n", str(ns), "-o", "yaml"
    ]
    result = subprocess.run(
        cmd,
        capture_output=True, text=True,
        timeout=10,
    )
    if result.returncode != 0:
        return None
    return result.stdout


def _get_previous_yaml(ctx, ns, deployment):
    """Get the previous revision YAML."""
    # Get revision list
    hist_cmd = [
        "kubectl", "--context", str(ctx or ""),
        "rollout", "history",
        f"deployment/{deployment}",
        "-n", str(ns)
    ]
    hist_result = subprocess.run(
        hist_cmd,
        capture_output=True, text=True,
        timeout=10,
    )
    if hist_result.returncode != 0:
        return None

    # Parse revision numbers
    revisions = []
    for line in hist_result.stdout.strip().split("\n")[1:]:
        parts = line.split()
        if parts and parts[0].isdigit():
            revisions.append(int(parts[0]))

    if len(revisions) < 2:
        return None

    prev_rev = revisions[-2]
    return _get_revision_yaml(ctx, ns, deployment, prev_rev)


def _get_revision_yaml(ctx, ns, deployment, revision):
    """Get YAML for a specific revision."""
    cmd = [
        "kubectl", "--context", str(ctx or ""),
        "rollout", "history",
        f"deployment/{deployment}",
        "-n", str(ns),
        f"--revision={revision}", "-o", "yaml"
    ]
    result = subprocess.run(
        cmd,
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


def _extract_pod_template(lines):
    """Extract the spec.template section for comparison."""
    in_template = False
    indent_level = 0
    result = []

    for line in lines:
        stripped = line.lstrip()
        current_indent = len(line) - len(stripped)

        if "containers:" in stripped:
            in_template = True
            indent_level = current_indent
            result.append(line)
        elif in_template:
            if stripped and current_indent <= indent_level and "containers:" not in stripped:
                # Check if we've exited the containers block
                if current_indent < indent_level:
                    in_template = False
                    continue
            result.append(line)
        elif any(k in stripped for k in [
            "image:", "replicas:", "env:", "name:",
            "value:", "port:", "limits:", "requests:",
            "cpu:", "memory:", "liveness", "readiness",
            "command:", "args:",
        ]):
            result.append(line)

    return result if result else lines
