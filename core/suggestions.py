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


def _after_gitops(cmd, ctx):
    return "Try: [cyan]gitops <app>[/cyan] for detail or [cyan]diff-timeline[/cyan] for recent changes"


def _after_mesh_detail(cmd, ctx):
    return "Try: [cyan]vs[/cyan] for routing or [cyan]mtls[/cyan] for encryption status"


def _after_rightsizing(cmd, ctx):
    return "Try: [cyan]cost-query[/cyan] for cost breakdown or [cyan]analytics-export rightsizing[/cyan]"


def _after_cost_query(cmd, ctx):
    return "Try: [cyan]rightsizing[/cyan] for savings or [cyan]analytics-export cost[/cyan] for CSV"


def _after_analytics_collect(cmd, ctx):
    return "Try: [cyan]analytics[/cyan] for stats or [cyan]rightsizing[/cyan] for recommendations"


def _after_connect_list(cmd, ctx):
    return "Try: [cyan]connect --discover[/cyan] to auto-find integrations"


def _after_profile_list(cmd, ctx):
    return "Try: [cyan]profile use dev[/cyan] or [cyan]profile use oncall[/cyan]"


def _after_blast_radius(cmd, ctx):
    target = cmd.get("target", "") if cmd else ""
    return f"Try: [cyan]why-broken {target}[/cyan] if it's already failing"


def _after_change_correlation(cmd, ctx):
    target = cmd.get("target", "") if cmd else ""
    return f"Try: [cyan]helm-diff {target}[/cyan] or [cyan]diff-timeline[/cyan] for more context"


def _after_pf_list(cmd, ctx):
    return "Try: [cyan]pf <pod> <port>[/cyan] to start a new forward"


def _after_helm_list(cmd, ctx):
    return "Try: [cyan]helm-status <release>[/cyan] or [cyan]helm-diff <release>[/cyan]"


def _after_helm_status(cmd, ctx):
    release = cmd.get("release", "") if cmd else ""
    return f"Try: [cyan]helm-history {release}[/cyan] or [cyan]helm-diff {release}[/cyan]"


def _after_helm_diff(cmd, ctx):
    release = cmd.get("release", "") if cmd else ""
    return f"Try: [cyan]helm-rollback {release}[/cyan] to undo or [cyan]blast-radius {release}[/cyan]"


def _after_capacity_plan(cmd, ctx):
    return "Try: [cyan]rightsizing[/cyan] to free resources or [cyan]predict[/cyan] for alerts"


def _after_predictive(cmd, ctx):
    return "Try: [cyan]capacity-plan[/cyan] for long-term forecast or [cyan]rightsizing[/cyan] to free resources"


def _after_analytics_stats(cmd, ctx):
    return "Try: [cyan]rightsizing[/cyan] for recommendations or [cyan]sql SELECT ...[/cyan] for custom queries"


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
    "gitops": _after_gitops,
    "mesh_detail": _after_mesh_detail,
    "rightsizing": _after_rightsizing,
    "cost_query": _after_cost_query,
    "analytics_collect": _after_analytics_collect,
    "connect_list": _after_connect_list,
    "profile_list": _after_profile_list,
    "blast_radius": _after_blast_radius,
    "change_correlation": _after_change_correlation,
    "pf_list": _after_pf_list,
    "helm_list": _after_helm_list,
    "helm_status": _after_helm_status,
    "helm_diff": _after_helm_diff,
    "capacity_plan": _after_capacity_plan,
    "predictive_alerts": _after_predictive,
    "analytics_stats": _after_analytics_stats,
}
