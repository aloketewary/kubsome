"""
Smart Suggestions — contextual next-step hints
shown after command execution to guide users.
"""

from core.context import context


# Maps command type → suggestion generator
# Each returns a string hint or None
def get_suggestion(cmd_type, command=None, result_context=None):
    """
    Return a contextual next-step suggestion based on
    the command that just ran. Returns string or None.
    """
    gen = _SUGGESTIONS.get(cmd_type)
    if gen:
        return gen(command, result_context)
    return None


def _after_pods(cmd, ctx):
    target = context.last_target
    if target:
        return f"Try: [cyan]diagnose {target}[/cyan] or [cyan]logs {target}[/cyan]"
    return "Try: [cyan]diagnose <pod>[/cyan] for root cause or [cyan]top pods[/cyan] for usage"


def _after_overview(cmd, ctx):
    return "Try: [cyan]scorecard[/cyan] for health grade or [cyan]alerts[/cyan] for anomalies"


def _after_diagnose(cmd, ctx):
    target = cmd.get("target", "") if cmd else ""
    if target:
        return f"Try: [cyan]logs {target}[/cyan] or [cyan]fix {target}[/cyan] to auto-remediate"
    return None


def _after_events(cmd, ctx):
    return "Try: [cyan]diff-timeline[/cyan] for what changed or [cyan]correlate[/cyan] for root cause"


def _after_logs(cmd, ctx):
    target = cmd.get("target", "") if cmd else ""
    if target:
        return f"Try: [cyan]diagnose {target}[/cyan] or [cyan]inspect {target}[/cyan]"
    return None


def _after_inspect(cmd, ctx):
    target = cmd.get("target", "") if cmd else ""
    if target:
        return f"Try: [cyan]trace {target}[/cyan] for dependencies or [cyan]logs {target}[/cyan]"
    return None


def _after_alerts(cmd, ctx):
    return "Try: [cyan]playbook <issue>[/cyan] for remediation steps"


def _after_scorecard(cmd, ctx):
    return "Try: [cyan]optimize[/cyan] for right-sizing or [cyan]security[/cyan] for misconfigs"


def _after_top_pods(cmd, ctx):
    return "Try: [cyan]optimize[/cyan] for right-sizing recommendations"


def _after_security(cmd, ctx):
    return "Try: [cyan]export[/cyan] to save report or [cyan]playbook <issue>[/cyan]"


def _after_cost_estimate(cmd, ctx):
    return "Try: [cyan]optimize[/cyan] for savings or [cyan]unused[/cyan] for orphaned resources"


def _after_rollout(cmd, ctx):
    target = cmd.get("target", "") if cmd else ""
    if target:
        return f"Try: [cyan]rollback-preview {target}[/cyan] or [cyan]yaml-diff {target}[/cyan]"
    return None


def _after_trace(cmd, ctx):
    target = cmd.get("target", "") if cmd else ""
    if target:
        return f"Try: [cyan]dep-health {target}[/cyan] for upstream/downstream health"
    return None


def _after_diff_timeline(cmd, ctx):
    return "Try: [cyan]correlate[/cyan] to find cause-effect chains"


def _after_check(cmd, ctx):
    return "Try: [cyan]export[/cyan] to save report or [cyan]scorecard[/cyan] for detailed grades"


_SUGGESTIONS = {
    "pods_table": _after_pods,
    "overview": _after_overview,
    "diagnose": _after_diagnose,
    "events": _after_events,
    "logs": _after_logs,
    "inspect": _after_inspect,
    "alerts": _after_alerts,
    "scorecard": _after_scorecard,
    "top_pods": _after_top_pods,
    "top_nodes": _after_top_pods,
    "security": _after_security,
    "cost_estimate": _after_cost_estimate,
    "rollout": _after_rollout,
    "trace": _after_trace,
    "diff_timeline": _after_diff_timeline,
    "check": _after_check,
}
