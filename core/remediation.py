"""
Auto-Remediation — execute playbook steps
automatically with safety guards.
"""

import subprocess

from core.context import context
from core.diagnostics.engine import diagnose
from core.collectors.diagnosis import collect_diagnosis
from core.ai.playbooks import match_playbook
from core.audit import log_action


def auto_remediate(pod_name):
    """
    Diagnose a pod and attempt automatic remediation.
    Returns actions taken and results.
    """
    ctx = context.current_context
    ns = context.namespace

    # Safety: never auto-remediate in production
    if "prd" in ctx or "prod" in ctx:
        return {
            "pod": pod_name,
            "blocked": True,
            "reason": "Auto-remediation disabled in production",
            "suggestion": "Use manual playbook steps instead",
        }

    # Diagnose
    data = collect_diagnosis(pod_name)
    if not data:
        return {
            "pod": pod_name,
            "blocked": True,
            "reason": "Could not inspect pod",
        }

    findings = diagnose(data)
    if not findings:
        return {
            "pod": pod_name,
            "actions": [],
            "result": "healthy",
            "message": "No issues found — pod is healthy",
        }

    # Match playbooks
    matched = match_playbook(findings)
    actions_taken = []

    for finding in findings:
        severity = finding["severity"]
        title = finding["title"]

        # Only auto-fix known safe patterns
        action = _safe_action(
            title, pod_name, ctx, ns
        )
        if action:
            success, output = _execute_action(action)
            actions_taken.append({
                "finding": title,
                "action": action["description"],
                "command": action["command"],
                "success": success,
                "output": output[:200],
            })
            if success:
                log_action(
                    "auto-remediate",
                    f"{pod_name}: {action['description']}"
                )

    return {
        "pod": pod_name,
        "blocked": False,
        "findings": len(findings),
        "actions": actions_taken,
        "result": (
            "fixed" if actions_taken
            else "manual_required"
        ),
        "playbooks": [
            m["playbook"]["title"] for m in matched
        ],
    }


def _safe_action(title, pod, ctx, ns):
    """
    Determine if a finding has a safe auto-fix.
    Only returns actions that are non-destructive.
    """
    lower = title.lower()

    # CrashLoopBackOff → restart deployment
    if "crashloop" in lower:
        dep = _get_deployment_for_pod(pod, ctx, ns)
        if dep:
            return {
                "description": f"Rolling restart {dep}",
                "command": (
                    f"kubectl --context {ctx} "
                    f"rollout restart deployment/{dep} "
                    f"-n {ns}"
                ),
            }

    # High restarts → restart deployment
    if "restart" in lower and "high" in lower:
        dep = _get_deployment_for_pod(pod, ctx, ns)
        if dep:
            return {
                "description": f"Rolling restart {dep}",
                "command": (
                    f"kubectl --context {ctx} "
                    f"rollout restart deployment/{dep} "
                    f"-n {ns}"
                ),
            }

    # Stuck pod → delete pod (let deployment recreate)
    if "stuck" in lower or "terminating" in lower:
        return {
            "description": f"Delete stuck pod {pod}",
            "command": (
                f"kubectl --context {ctx} "
                f"delete pod {pod} -n {ns} "
                f"--grace-period=30"
            ),
        }

    return None


def _execute_action(action):
    """Execute a remediation command."""
    result = subprocess.run(
        action["command"],
        shell=True,
        capture_output=True,
        text=True,
        timeout=30,
    )
    return (
        result.returncode == 0,
        result.stdout or result.stderr,
    )


def _get_deployment_for_pod(pod, ctx, ns):
    """Find the deployment that owns a pod."""
    # Extract deployment name from pod name
    # (pod: dep-name-replicaset-hash)
    parts = pod.split("-")
    if len(parts) > 2:
        # Try progressively shorter names
        for i in range(len(parts) - 1, 1, -1):
            candidate = "-".join(parts[:i])
            cmd = (
                f"kubectl --context {ctx} "
                f"get deployment {candidate} "
                f"-n {ns} --no-headers 2>/dev/null"
            )
            result = subprocess.run(
                cmd, shell=True,
                capture_output=True, text=True,
                timeout=5,
            )
            if result.returncode == 0:
                return candidate
    return None
