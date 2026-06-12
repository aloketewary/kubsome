"""
Command Dispatcher — maps command types to handler functions.
Keeps main.py clean and makes handlers testable.
"""

import time
import subprocess
from concurrent.futures import ThreadPoolExecutor

from rich.console import Console
from rich.panel import Panel
from rich.table import Table
from rich.live import Live

from config.settings import SETTINGS
from core.context import context
from core.executor import execute
from core.spinner import loading
from core.audit import log_action
from core.safety import confirm_production
from core.cache import invalidate_pods, invalidate_deployments

from core.k8s import get_pods
from core.formatter import render_pods_table
from core.watch_formatter import build_watch_view

from core.collectors.pods import collect_pods
from core.collectors.nodes import collect_nodes
from core.collectors.deployments import collect_deployments
from core.collectors.inspect import (
    inspect_pod, pod_events, pod_logs, extract_pod_details
)
from core.collectors.events import collect_events
from core.collectors.logs import (
    fetch_logs, stream_logs,
    find_pods_for_deployment,
    fetch_combined_logs, stream_combined_logs
)
from core.collectors.rollouts import (
    rollout_status, rollout_history,
    rollout_rollback, rollout_restart
)
from core.collectors.metrics import top_pods, top_nodes
from core.collectors.diagnosis import collect_diagnosis
from core.collectors.trace import trace_resource
from core.collectors.multicluster import compare_contexts
from core.collectors.search import search_resources
from core.collectors.namespace import namespace_summary
from core.collectors.network import netcheck
from core.collectors.jobs import (
    list_cronjobs, list_jobs, trigger_cronjob
)
from core.collectors.configs import get_configmap, get_secret
from core.collectors.diff import deployment_diff
from core.collectors.cost import (
    resource_recommendations, find_unused_resources
)
from core.collectors.security import security_scan
from core.collectors.scaling import (
    list_hpa, list_pdb, cluster_capacity,
    namespace_quota, drain_check
)

from core.analyzer import (
    analyze_pods, analyze_nodes, analyze_deployments
)
from core.overview_formatter import render_overview
from core.renderers.inspect_renderer import render_inspect
from core.renderers.events_renderer import (
    render_events, build_events_watch_view
)
from core.renderers.logs_renderer import (
    render_logs, render_streaming_line,
    render_combined_logs
)
from core.renderers.rollout_renderer import render_rollout
from core.renderers.metrics_renderer import (
    render_top_pods, render_top_nodes
)
from core.renderers.diagnosis_renderer import render_diagnosis
from core.renderers.trace_renderer import render_trace
from core.renderers.ai_renderer import render_ai_response
from core.renderers.compare_renderer import render_comparison
from core.renderers.help_renderer import render_help
from core.renderers.search_renderer import render_search_results
from core.renderers.namespace_renderer import render_namespace_summary
from core.renderers.anomaly_renderer import (
    render_anomalies, render_playbook, render_correlations
)
from core.renderers.cost_renderer import (
    render_cost_recommendations, render_security_scan,
    render_unused_resources
)
from core.renderers.report_renderer import (
    render_health_check, render_export_success, render_audit_log
)
from core.renderers.ops_renderer import (
    render_netcheck, render_cronjobs,
    render_jobs, render_config, render_diff
)
from core.renderers.scaling_renderer import (
    render_hpa, render_pdb, render_capacity,
    render_quota, render_drain_check
)
from core.collectors.node_ops import (
    cordon_node, uncordon_node, drain_node,
    wait_for, list_api_resources
)
from core.collectors.resource_ops import (
    patch_resource, annotate_resource, set_image
)
from core.renderers.node_ops_renderer import (
    render_cordon, render_uncordon, render_drain,
    render_wait, render_api_resources
)
from core.renderers.resource_ops_renderer import (
    render_patch, render_annotate, render_set_image
)

from core.diagnostics.recommendations import recommend
from core.diagnostics.engine import diagnose
from core.ai.engine import handle_ai_query
from core.ai.anomaly import detect_anomalies
from core.ai.playbooks import get_playbook, match_playbook
from core.ai.correlation import correlate
from core.ai.explain import explain
from core.ai.generator import generate_manifest
from core.plugins import run_plugin, list_plugins
from core.incident.manager import (
    start_incident, stop_incident,
    add_note, snapshot, get_active
)
from core.renderers.incident_renderer import (
    render_incident_started, render_incident_stopped,
    render_incident_status
)
from core.export import export_report
from core.audit import get_audit_log
from core.healthcheck import run_health_check
from core.bookmarks import (
    add_bookmark, remove_bookmark,
    get_bookmark, list_bookmarks
)
from core.workflows import list_workflows, get_workflow
from core.renderers.workflow_renderer import (
    render_bookmarks, render_workflows, render_workflow_step
)
from core.collectors.rbac import list_role_bindings
from core.collectors.timeline import build_timeline
from core.collectors.labels import get_labels
from core.collectors.changes import (
    take_state_snapshot, get_latest_snapshot,
    diff_snapshots, build_changelog, resource_history
)
from core.renderers.rbac_renderer import (
    render_rbac, render_timeline, render_labels
)
from core.renderers.changes_renderer import (
    render_snapshot_diff, render_changelog,
    render_resource_history
)
from core.collectors.services import (
    detect_mesh, list_ingresses,
    service_dependencies, dns_debug
)
from core.renderers.services_renderer import (
    render_mesh, render_ingresses,
    render_dependencies, render_dns
)
from core.commands import resolve_command
from core.notify import notify_if_critical
from core.suggestions import get_suggestion
from core.telemetry import track_command, track_unresolved
from core.collectors.gitops import collect_gitops, gitops_app_detail
from core.collectors.mesh import (
    collect_mesh_detail, collect_virtual_services,
    collect_destination_rules, collect_mtls_status
)
from core.renderers.gitops_renderer import (
    render_gitops, render_gitops_detail
)
from core.renderers.mesh_renderer import (
    render_mesh_detail, render_virtual_services,
    render_destination_rules, render_mtls_status
)
from core.connect import (
    list_integrations, connect_integration,
    disconnect_integration, auto_discover,
    connect_discovered
)
from core.renderers.connect_renderer import (
    render_integrations, render_connect_result,
    render_disconnect_result, render_discoveries,
    render_connect_all_results
)
from core.profiles import (
    list_profiles, activate_profile,
    deactivate_profile, get_active_profile
)

console = Console()


def dispatch(command, env="UNKNOWN"):
    """
    Execute a command dict. Returns True to continue,
    False to break the loop (only for special cases).
    """
    cmd_type = command["type"]

    try:
        handler = HANDLERS.get(cmd_type)
        if handler:
            handler(command, env)
            # Track usage
            track_command(cmd_type, command.get("target"))
            # Smart next-step suggestion
            _show_suggestion(cmd_type, command)
        else:
            console.print(
                f"[red]Unhandled command type: "
                f"{cmd_type}[/red]"
            )
    except KeyboardInterrupt:
        console.print("[dim]Interrupted[/dim]")
    except Exception as e:
        console.print(f"[red]Error: {e}[/red]")


def _show_suggestion(cmd_type, command):
    """Show contextual next-step hint after command."""
    from config.settings import SETTINGS
    if not SETTINGS.get("show_suggestions", True):
        return
    hint = get_suggestion(cmd_type, command)
    if hint:
        console.print(f"\n[dim]💡 {hint}[/dim]")


def _handle_pods_table(cmd, env):
    pods = get_pods()
    render_pods_table(pods)


def _handle_pods_watch(cmd, env):
    from core.cache import invalidate
    target = cmd.get("target")
    with Live(
        build_watch_view(get_pods(), context.namespace, target=target),
        refresh_per_second=1,
        console=console
    ) as live:
        while True:
            time.sleep(SETTINGS["refresh_interval"])
            invalidate("get_pods")
            live.update(
                build_watch_view(
                    get_pods(), context.namespace, target=target
                )
            )


def _handle_overview(cmd, env):
    with loading("Fetching cluster overview..."):
        with ThreadPoolExecutor(max_workers=3) as executor:
            f_pods = executor.submit(collect_pods)
            f_nodes = executor.submit(collect_nodes)
            f_deps = executor.submit(collect_deployments)

            pods = f_pods.result()
            nodes = f_nodes.result()
            deployments = f_deps.result()

        # Pass pre-fetched data to detect_anomalies to avoid redundant calls
        alerts = detect_anomalies(pods=pods, nodes=nodes)

    render_overview(
        analyze_pods(pods),
        analyze_nodes(nodes),
        analyze_deployments(deployments),
        context
    )
    if alerts:
        console.print()
        render_anomalies(alerts)
        notify_if_critical(alerts)


def _handle_inspect(cmd, env):
    with loading(f"Inspecting {cmd['target']}..."):
        pod_data = inspect_pod(cmd["target"])
    if not pod_data:
        console.print("[red]Pod not found[/red]")
        return
    details = extract_pod_details(pod_data)
    events = pod_events(cmd["target"])
    logs = pod_logs(cmd["target"])
    recommendation = recommend(pod_data)
    render_inspect(details, events, logs, recommendation)


def _handle_events(cmd, env):
    events = collect_events()
    render_events(events)


def _handle_events_watch(cmd, env):
    from core.cache import invalidate
    with Live(
        build_events_watch_view(
            collect_events(), context.namespace
        ),
        refresh_per_second=1,
        console=console
    ) as live:
        while True:
            time.sleep(SETTINGS["refresh_interval"])
            invalidate("collect_events")
            live.update(
                build_events_watch_view(
                    collect_events(), context.namespace
                )
            )


def _handle_logs(cmd, env):
    target = cmd["target"]
    container = cmd.get("container")
    since = cmd.get("since")
    regex = cmd.get("regex")
    if cmd["follow"]:
        console.print(
            f"[dim]Streaming {target}"
            f"{' (' + container + ')' if container else ''}"
            f"... Ctrl+C to stop[/dim]"
        )
        process = stream_logs(target, container=container)
        for line in process.stdout:
            render_streaming_line(line.rstrip())
    else:
        lines = fetch_logs(
            target,
            previous=cmd["previous"],
            errors_only=cmd["errors"],
            container=container,
            since=since,
            regex=regex,
        )
        if regex:
            console.print(
                f"[dim]Filter: /{regex}/[/dim]"
            )
        render_logs(lines, target, errors_only=cmd["errors"])


def _handle_logcat(cmd, env):
    query = cmd["query"]
    with loading(f"Finding pods for {query}..."):
        pods = find_pods_for_deployment(query)

    if not pods:
        console.print(
            f"[red]No pods found for '{query}'[/red]"
        )
        return

    from core.renderers.logs_renderer import (
        render_streaming_combined_line, POD_COLORS,
        _short_pod_name
    )

    pod_color_map = {}
    for i, pod in enumerate(pods):
        pod_color_map[pod] = {
            "color": POD_COLORS[i % len(POD_COLORS)],
            "short": _short_pod_name(pod),
        }

    # Print header
    pod_names = ", ".join(
        f"[{info['color']}]{info['short']}[/{info['color']}]"
        for pod, info in pod_color_map.items()
    )
    console.print(
        Panel.fit(
            f"[bold]{len(pods)} pods[/bold] for "
            f"[cyan]{query}[/cyan]\n"
            f"{pod_names}",
            border_style="cyan"
        )
    )

    if cmd["follow"] or cmd.get("watch"):
        # Live streaming from all pods
        console.print("[dim]Ctrl+C to stop[/dim]\n")

        log_queue, processes = stream_combined_logs(pods)

        done_count = 0
        while done_count < len(pods):
            pod, line = log_queue.get()
            if line is None:
                done_count += 1
                continue
            render_streaming_combined_line(
                pod, line, pod_color_map
            )
    else:
        # Static combined fetch
        with loading("Fetching combined logs..."):
            entries = fetch_combined_logs(
                pods, tail=50,
                errors_only=cmd["errors"]
            )
        render_combined_logs(entries, pods)


def _handle_rollout(cmd, env):
    target = cmd["target"]
    status = rollout_status(target)
    hist = rollout_history(target)
    render_rollout(status, hist)


def _handle_rollback(cmd, env):
    from core.models.plan import RemediationPlan, RiskLevel, LifecycleState
    from core.models.action import Action, ActionType
    from core.models.resource import ResourceRef
    from core.models.verification import VerificationGoal
    from core.execution.engine import ExecutionEngine
    from core.execution.kubectl import KubectlExecutor
    from core.verification.kubectl import KubectlVerifier

    target_name = cmd["target"]
    target_ref = ResourceRef(
        kind="deployment",
        name=target_name,
        namespace=context.namespace,
        cluster=context.current_context
    )

    plan = RemediationPlan(
        target=target_ref,
        risk=RiskLevel.MEDIUM,
        actions=[
            Action(
                type=ActionType.ROLLBACK,
                target=target_ref,
                description=f"Rollback deployment/{target_name}"
            )
        ],
        verification_goal=VerificationGoal(timeout_seconds=300)
    )

    console.print(Panel(
        f"[bold]Plan:[/bold] {plan.actions[0].description}\n"
        f"[bold]Risk:[/bold] {plan.risk.value}\n"
        f"[bold]Verification:[/bold] Wait for rollout completion",
        title="[bold]Proposed Remediation[/bold]",
        border_style="yellow"
    ))

    from core.safety import confirm_production
    if not confirm_production({"environment": env, "name": f"rollback {target_name}", "risk": "MEDIUM"}):
        from core.execution.state_machine import StateMachine
        from core.audit import log_plan_transition
        StateMachine.transition(plan, LifecycleState.CANCELLED)
        log_plan_transition(plan.id, "rollback_cancelled", str(plan.target), plan.state)
        console.print("[yellow]Cancelled[/yellow]")
        return

    engine = ExecutionEngine(KubectlExecutor(), KubectlVerifier())
    with loading(f"Executing and verifying rollback for {target_name}..."):
        result = engine.run(plan)

    if result.success:
        invalidate_pods()
        invalidate_deployments()
        console.print(f"[green]✓ Rollback successful and verified[/green]")
    else:
        console.print(f"[red]Rollback failed: {result.error or 'Verification timed out'}[/red]")


def _handle_restart(cmd, env):
    from core.models.plan import RemediationPlan, RiskLevel, LifecycleState
    from core.models.action import Action, ActionType
    from core.models.resource import ResourceRef
    from core.models.verification import VerificationGoal
    from core.execution.engine import ExecutionEngine
    from core.execution.kubectl import KubectlExecutor
    from core.verification.kubectl import KubectlVerifier

    target_name = cmd["target"]
    target_ref = ResourceRef(
        kind="deployment",
        name=target_name,
        namespace=context.namespace,
        cluster=context.current_context
    )

    plan = RemediationPlan(
        target=target_ref,
        risk=RiskLevel.LOW, # Default for restart
        actions=[
            Action(
                type=ActionType.ROLLING_RESTART,
                target=target_ref,
                description=f"Rolling restart {target_name}"
            )
        ],
        verification_goal=VerificationGoal(timeout_seconds=300)
    )

    # UI/CLI rendering of the plan
    console.print(Panel(
        f"[bold]Plan:[/bold] {plan.actions[0].description}\n"
        f"[bold]Risk:[/bold] {plan.risk.value}\n"
        f"[bold]Verification:[/bold] Wait for rollout completion",
        title="[bold]Proposed Remediation[/bold]",
        border_style="cyan"
    ))

    # Approval check
    from core.safety import confirm_production
    if not confirm_production({"environment": env, "name": f"restart {target_name}"}):
        from core.execution.state_machine import StateMachine
        from core.audit import log_plan_transition
        StateMachine.transition(plan, LifecycleState.CANCELLED)
        log_plan_transition(plan.id, "restart_cancelled", str(plan.target), plan.state)
        console.print("[yellow]Cancelled[/yellow]")
        return

    # Execution & Verification
    engine = ExecutionEngine(KubectlExecutor(), KubectlVerifier())

    with loading(f"Executing and verifying restart for {target_name}..."):
        result = engine.run(plan)

    if result.success:
        invalidate_pods()
        console.print(f"[green]✓ Restart successful and verified[/green]")
    else:
        console.print(f"[red]Restart failed: {result.error or 'Verification timed out'}[/red]")


def _handle_scale(cmd, env):
    from core.models.plan import RemediationPlan, RiskLevel, LifecycleState
    from core.models.action import Action, ActionType
    from core.models.resource import ResourceRef
    from core.models.verification import VerificationGoal
    from core.execution.engine import ExecutionEngine
    from core.execution.kubectl import KubectlExecutor
    from core.verification.kubectl import KubectlVerifier

    target_name = cmd["target"]
    replicas = cmd["replicas"]
    target_ref = ResourceRef(
        kind="deployment",
        name=target_name,
        namespace=context.namespace,
        cluster=context.current_context
    )

    plan = RemediationPlan(
        target=target_ref,
        risk=RiskLevel.MEDIUM,
        actions=[
            Action(
                type=ActionType.SCALE,
                target=target_ref,
                description=f"Scale deployment/{target_name} to {replicas} replicas",
                parameters={"replicas": replicas}
            )
        ],
        verification_goal=VerificationGoal(timeout_seconds=300)
    )

    console.print(Panel(
        f"[bold]Plan:[/bold] {plan.actions[0].description}\n"
        f"[bold]Risk:[/bold] {plan.risk.value}\n"
        f"[bold]Verification:[/bold] Wait for replica count to reach {replicas}",
        title="[bold]Proposed Remediation[/bold]",
        border_style="yellow"
    ))

    from core.safety import confirm_production
    if not confirm_production({"environment": env, "name": f"scale {target_name} to {replicas}", "risk": "MEDIUM"}):
        from core.execution.state_machine import StateMachine
        from core.audit import log_plan_transition
        StateMachine.transition(plan, LifecycleState.CANCELLED)
        log_plan_transition(plan.id, "scale_cancelled", str(plan.target), plan.state)
        console.print("[yellow]Cancelled[/yellow]")
        return

    engine = ExecutionEngine(KubectlExecutor(), KubectlVerifier())
    with loading(f"Scaling and verifying {target_name}..."):
        result = engine.run(plan)

    if result.success:
        invalidate_pods()
        invalidate_deployments()
        console.print(f"[green]✓ Scaling successful and verified[/green]")
    else:
        console.print(f"[red]Scaling failed: {result.error or 'Verification timed out'}[/red]")


def _handle_top_pods(cmd, env):
    pods = top_pods()
    render_top_pods(pods)


def _handle_top_nodes(cmd, env):
    nodes = top_nodes()
    render_top_nodes(nodes)


def _handle_diagnose(cmd, env):
    target = cmd["target"]
    with loading(f"Diagnosing {target}..."):
        data = collect_diagnosis(target)
    if not data:
        console.print("[red]Pod not found[/red]")
        return
    findings = diagnose(data)
    render_diagnosis(target, findings)
    matched = match_playbook(findings)
    for m in matched[:2]:
        console.print()
        render_playbook(m["playbook"])


def _handle_trace(cmd, env):
    with loading(f"Tracing {cmd['target']}..."):
        data = trace_resource(cmd["target"])
    render_trace(data)


def _handle_tui(cmd, env):
    try:
        from tui.app import run_tui
        run_tui()
    except ImportError:
        console.print(
            "[red]textual not installed.[/red] "
            "Run: pip install textual"
        )


def _handle_ai(cmd, env):
    with loading("Analyzing..."):
        response = handle_ai_query(cmd["query"])
    render_ai_response(response)


def _handle_plugin(cmd, env):
    result = run_plugin(cmd["name"], context)
    if result:
        console.print(result)
    else:
        console.print(
            f"[red]Plugin '{cmd['name']}' not found[/red]"
        )


def _handle_plugins_list(cmd, env):
    plugins = list_plugins()
    if not plugins:
        console.print(
            "[dim]No plugins. Add .py to ~/.kubsome/plugins/[/dim]"
        )
    else:
        for name, info in plugins.items():
            console.print(
                f"  [cyan]{name}[/cyan] — {info['description']}"
            )


def _handle_compare(cmd, env):
    console.print(
        f"[dim]Comparing {cmd['ctx_a']} ({cmd.get('ns_a', '')}) vs "
        f"{cmd['ctx_b']} ({cmd.get('ns_b', '')})[/dim]"
    )
    data = compare_contexts(
        cmd["ctx_a"], cmd["ctx_b"],
        cmd["ns_a"], cmd["ns_b"]
    )
    render_comparison(data)


def _handle_incident_start(cmd, env):
    incident = start_incident(cmd.get("title", ""))
    render_incident_started(incident)


def _handle_incident_stop(cmd, env):
    result = stop_incident()
    if result:
        incident, path = result
        render_incident_stopped(incident, path)
    else:
        console.print("[dim]No active incident[/dim]")


def _handle_incident_status(cmd, env):
    render_incident_status(get_active())


def _handle_incident_note(cmd, env):
    if add_note(cmd["text"]):
        console.print("[green]✓ Note added[/green]")
    else:
        console.print("[red]No active incident[/red]")


def _handle_incident_snapshot(cmd, env):
    if snapshot():
        console.print("[green]✓ Snapshot captured[/green]")
    else:
        console.print("[red]No active incident[/red]")


def _handle_incident_history(cmd, env):
    """List past incident reports."""
    import json
    from pathlib import Path
    incidents_dir = Path.home() / ".kubsome" / "incidents"
    if not incidents_dir.exists():
        console.print("[dim]No past incidents[/dim]")
        return
    reports = sorted(
        incidents_dir.glob("incident_*.json"),
        reverse=True
    )
    if not reports:
        console.print("[dim]No past incidents[/dim]")
        return
    table = Table(
        show_header=True,
        header_style="bold cyan",
        border_style="dim",
        expand=True
    )
    table.add_column("ID", width=16)
    table.add_column("Title")
    table.add_column("Started", width=12)
    table.add_column("Notes", justify="right", width=6)
    table.add_column("Snaps", justify="right", width=6)
    for f in reports[:20]:
        try:
            data = json.loads(f.read_text())
            table.add_row(
                data.get("id", ""),
                data.get("title", "Untitled"),
                data.get("started", "")[:10],
                str(len(data.get("notes", []))),
                str(len(data.get("snapshots", []))),
            )
        except Exception:
            continue
    console.print(
        Panel(table, title="[bold]\U0001f4cb Past Incidents[/bold]",
              border_style="cyan")
    )


def _handle_incident_share(cmd, env):
    from core.incident.manager import share_incident

    incident_id = cmd.get("id")
    success, message = share_incident(incident_id)
    if success:
        console.print(f"[green]\u2713 {message}[/green]")
    else:
        console.print(f"[red]{message}[/red]")


def _handle_help(cmd, env):
    render_help()


def _handle_find(cmd, env):
    results = search_resources(cmd["query"])
    render_search_results(cmd["query"], results)


def _handle_ns_overview(cmd, env):
    data = namespace_summary()
    render_namespace_summary(data)


def _handle_alerts(cmd, env):
    with loading("Scanning for anomalies..."):
        alerts = detect_anomalies()
    render_anomalies(alerts)


def _handle_playbook(cmd, env):
    render_playbook(get_playbook(cmd["issue"]))


def _handle_correlate(cmd, env):
    with loading("Correlating signals..."):
        chains = correlate(cmd.get("target"))
    render_correlations(chains)


def _handle_optimize(cmd, env):
    # Use analytics-backed rightsizing if data available
    try:
        from core.analytics.rightsizing import optimization_report
        with loading("Analyzing resource usage (analytics)..."):
            report = optimization_report()
        if report["summary"]["deployments"] > 0:
            _handle_rightsizing(cmd, env)
            return
    except Exception:
        pass

    # Fallback to basic point-in-time analysis
    with loading("Analyzing resource usage..."):
        recs = resource_recommendations()
    render_cost_recommendations(recs)


def _handle_security(cmd, env):
    with loading("Scanning security..."):
        findings = security_scan()
    render_security_scan(findings)


def _handle_unused(cmd, env):
    with loading("Finding unused resources..."):
        unused = find_unused_resources()
    render_unused_resources(unused)


def _handle_idle_resources(cmd, env):
    from core.collectors.idle_resources import detect_all

    with loading("Scanning for idle & orphaned resources..."):
        result = detect_all()

    items = result["items"]
    summary = result["summary"]

    if not items:
        console.print(
            "[green]\u2713 No idle or orphaned resources found[/green]"
        )
        return

    console.print(
        f"\n[bold]Found {summary['total']} idle/orphaned "
        f"resources[/bold]  "
        f"[green]${summary['total_savings_monthly']:.2f}/mo "
        f"potential savings[/green]\n"
    )

    # Group by category
    for cat, stats in summary.get("categories", {}).items():
        console.print(
            f"  [dim]{cat}:[/dim] {stats['count']} items"
            + (f" (${stats['savings']:.2f}/mo)" if stats['savings'] > 0 else "")
        )
    console.print()

    table = Table(
        show_header=True,
        header_style="bold cyan",
        border_style="dim",
        expand=True,
    )
    table.add_column("Kind")
    table.add_column("Name")
    table.add_column("Category")
    table.add_column("Reason")
    table.add_column("Age")
    table.add_column("$/mo", justify="right")

    for item in items[:20]:
        sev_color = {
            "high": "red", "medium": "yellow", "low": "dim"
        }.get(item.get("severity", "low"), "dim")
        savings = (
            f"[green]${item['savings_monthly']:.2f}[/green]"
            if item.get("savings_monthly", 0) > 0 else "[dim]—[/dim]"
        )
        table.add_row(
            item["kind"],
            item["name"][:40],
            f"[{sev_color}]{item['category']}[/{sev_color}]",
            item.get("reason", "")[:50],
            f"{item.get('age_days', 0)}d",
            savings,
        )

    console.print(table)

    if len(items) > 20:
        console.print(
            f"\n[dim]... and {len(items) - 20} more. "
            f"Run 'cleanup-apply' to review cleanup commands.[/dim]"
        )


def _handle_cleanup_apply(cmd, env):
    from core.collectors.idle_resources import detect_all, cleanup_dry_run
    from core.context import context as k8s_ctx

    ctx = k8s_ctx.current_context
    if ctx and ("prod" in ctx or "prd" in ctx):
        console.print(
            "[red]\u2717 Cleanup blocked in production.[/red]"
        )
        return

    with loading("Generating cleanup commands..."):
        result = cleanup_dry_run()

    commands = result["commands"]
    if not commands:
        console.print("[green]\u2713 Nothing to clean up[/green]")
        return

    console.print(
        f"\n[bold]Cleanup commands ({len(commands)}):[/bold]\n"
        f"[dim]Review and run manually:[/dim]\n"
    )

    for c in commands[:15]:
        console.print(
            f"  [cyan]{c['command']}[/cyan]\n"
            f"    [dim]{c['reason']}[/dim]"
        )

    if len(commands) > 15:
        console.print(
            f"\n[dim]... and {len(commands) - 15} more[/dim]"
        )


def _handle_check(cmd, env):
    with loading("Running health checks..."):
        result = run_health_check()
    render_health_check(result)


def _handle_doctor(cmd, env):
    from core.doctor import run_doctor

    console.print("[bold]🩺 Kubsome Doctor[/bold]\n")
    checks = run_doctor()

    all_ok = True
    for c in checks:
        status = c["status"]
        if status == "ok":
            icon = "[green]✓[/green]"
        elif status == "warn":
            icon = "[yellow]⚠[/yellow]"
            all_ok = False
        else:
            icon = "[red]✗[/red]"
            all_ok = False

        console.print(
            f"  {icon} [bold]{c['name']}[/bold]\n"
            f"    [dim]{c['detail']}[/dim]"
        )

    console.print()
    if all_ok:
        console.print("[green]All checks passed. Ready to go![/green]")
    else:
        console.print("[yellow]Some checks need attention.[/yellow]")


def _handle_stats(cmd, env):
    from core.telemetry import get_stats, is_enabled

    if not is_enabled():
        console.print(
            "[dim]Telemetry is disabled. Enable in config:[/dim]\n"
            "  [cyan]telemetry: true[/cyan]"
        )
        return

    stats = get_stats()

    lines = [
        f"[bold]Commands:[/bold] {stats['total_commands']} "
        f"over {stats['days_tracked']} days\n",
    ]

    if stats["top_commands"]:
        lines.append("[bold]Most Used:[/bold]")
        for cmd_name, count in stats["top_commands"][:10]:
            bar = "\u2588" * min(count // 2, 20)
            lines.append(
                f"  {cmd_name:18} {count:>4}  [cyan]{bar}[/cyan]"
            )

    if stats["top_unresolved"]:
        lines.append(
            f"\n[bold]Unresolved Queries "
            f"({stats['unresolved_count']}):[/bold]"
        )
        for query, count in stats["top_unresolved"]:
            lines.append(
                f"  [yellow]{query}[/yellow] ({count}x)"
            )

    console.print(
        Panel(
            "\n".join(lines),
            title="[bold]\U0001f4ca Usage Stats[/bold]",
            border_style="cyan",
        )
    )


def _handle_schedule_list(cmd, env):
    from core.scheduler import get_scheduler

    schedules = get_scheduler().list_schedules()
    if not schedules:
        console.print(
            "[dim]No schedules. Use: "
            "schedule add <name> <cron> <cmd1,cmd2,...>[/dim]"
        )
        return

    lines = [f"[bold]Schedules ({len(schedules)}):[/bold]\n"]
    for s in schedules:
        cmds = ", ".join(s["commands"][:3])
        last = (
            s["last_run"][:16] if s["last_run"] else "never"
        )
        lines.append(
            f"  [cyan]{s['name']}[/cyan] \u2014 {s['cron']}\n"
            f"    Commands: {cmds}\n"
            f"    Next: {s['next_run']}  "
            f"Last: [dim]{last}[/dim]"
        )

    console.print(
        Panel(
            "\n".join(lines),
            title="[bold]\u23f0 Schedules[/bold]",
            border_style="cyan",
        )
    )


def _handle_schedule_add(cmd, env):
    from core.scheduler import get_scheduler

    name = cmd["name"]
    cron = cmd["cron"]
    commands = cmd["commands"]

    get_scheduler().add(name, cron, commands, notify=True)
    console.print(
        f"[green]\u2713 Schedule added:[/green] "
        f"{name} ({cron})\n"
        f"  Commands: {', '.join(commands)}"
    )


def _handle_schedule_rm(cmd, env):
    from core.scheduler import get_scheduler

    get_scheduler().remove(cmd["name"])
    console.print(f"[green]\u2713 Removed:[/green] {cmd['name']}")


def _handle_cost_trend(cmd, env):
    from core.collectors.cost_trend import cost_trend

    with loading("Analyzing cost trend..."):
        data = cost_trend()

    if data["current_monthly"] == 0:
        console.print("[dim]No deployments found[/dim]")
        return

    trend_icon = {
        "growing": "[red]\u2191[/red]",
        "stable": "[green]\u2192[/green]",
        "shrinking": "[cyan]\u2193[/cyan]",
    }.get(data["trend"], "\u2192")

    lines = [
        f"[bold]Current:[/bold]   "
        f"${data['current_monthly']:.2f}/month",
        f"[bold]Projected:[/bold] "
        f"${data['projected_monthly']:.2f}/month "
        f"{trend_icon} {data['trend']}",
        f"[bold]Savings:[/bold]   "
        f"[green]${data['savings_opportunity']:.2f}"
        f"/month[/green] possible\n",
    ]

    if data["deployments"]:
        lines.append("[bold]Top savings opportunities:[/bold]")
        for d in data["deployments"][:8]:
            if d["savings"] > 0:
                util = (
                    f" ({d['utilization_pct']}% util)"
                    if d.get("utilization_pct") else ""
                )
                lines.append(
                    f"  ${d['savings']:.2f}  {d['name']}{util}"
                )

    lines.append(f"\n[dim]{data['note']}[/dim]")

    console.print(
        Panel(
            "\n".join(lines),
            title="[bold]\U0001f4c8 Cost Trend & Forecast[/bold]",
            border_style="green",
        )
    )


def _handle_export(cmd, env):
    with loading("Generating report..."):
        path = export_report(format=cmd["format"])
    render_export_success(path)


def _handle_audit(cmd, env):
    render_audit_log(get_audit_log())


def _handle_netcheck(cmd, env):
    with loading(f"Checking network for {cmd['target']}..."):
        data = netcheck(cmd["target"])
    render_netcheck(data)


def _handle_cronjobs(cmd, env):
    render_cronjobs(list_cronjobs())


def _handle_jobs(cmd, env):
    render_jobs(list_jobs())


def _handle_trigger(cmd, env):
    success, output = trigger_cronjob(cmd["target"])
    if success:
        log_action("trigger", cmd["target"])
        console.print(f"[green]✓ Triggered {cmd['target']}[/green]")
    else:
        console.print(f"[red]{output}[/red]")


def _handle_configmap(cmd, env):
    render_config(get_configmap(cmd["name"]))


def _handle_secret(cmd, env):
    render_config(get_secret(cmd["name"]))


def _handle_diff(cmd, env):
    with loading(f"Comparing revisions for {cmd['target']}..."):
        data = deployment_diff(cmd["target"])
    render_diff(data)


def _handle_forward(cmd, env):
    target = cmd["target"]
    port = cmd["port"]
    fwd_cmd = [
        "kubectl", "--context", context.current_context,
        "port-forward", target, str(port), "-n", context.namespace
    ]
    console.print(
        f"[green]✓ Forwarding {target}:{port}[/green]\n"
        f"[dim]Press Ctrl+C to stop[/dim]"
    )
    subprocess.run(fwd_cmd, shell=False)


def _handle_explain(cmd, env):
    with loading("Thinking..."):
        result = explain(cmd["query"])
    console.print(
        Panel(
            result["content"],
            title=f"[bold]{result['title']}[/bold]",
            border_style="cyan",
            padding=(1, 2)
        )
    )


def _handle_generate(cmd, env):
    yaml_output = generate_manifest(
        cmd["kind"], cmd["name"], context.namespace
    )
    if yaml_output:
        console.print(
            Panel(
                yaml_output,
                title=(
                    f"[bold]📝 {cmd['kind']}: {cmd['name']}[/bold]"
                ),
                border_style="green"
            )
        )
    else:
        console.print("[red]Could not generate manifest[/red]")


def _handle_hpa(cmd, env):
    render_hpa(list_hpa())


def _handle_pdb(cmd, env):
    render_pdb(list_pdb())


def _handle_capacity(cmd, env):
    with loading("Calculating capacity..."):
        data = cluster_capacity()
    render_capacity(data)


def _handle_quota(cmd, env):
    render_quota(namespace_quota())


def _handle_drain_check(cmd, env):
    with loading(f"Checking {cmd['node']}..."):
        data = drain_check(cmd["node"])
    render_drain_check(data)


def _handle_bookmark_add(cmd, env):
    add_bookmark(cmd["name"], cmd["command"])
    console.print(
        f"[green]✓ Bookmarked:[/green] "
        f"[cyan]{cmd['name']}[/cyan] → {cmd['command']}"
    )


def _handle_bookmark_rm(cmd, env):
    remove_bookmark(cmd["name"])
    console.print(f"[green]✓ Removed:[/green] {cmd['name']}")


def _handle_bookmarks_list(cmd, env):
    render_bookmarks(list_bookmarks())


def _handle_run_bookmark(cmd, env):
    bm_cmd = get_bookmark(cmd["name"])
    if bm_cmd:
        console.print(f"[dim]→ {bm_cmd}[/dim]")
        resolved = resolve_command(bm_cmd)
        if resolved and isinstance(resolved, str):
            execute(resolved)
        elif resolved:
            dispatch(resolved, env)
    else:
        console.print(
            f"[red]Bookmark '{cmd['name']}' not found[/red]"
        )


def _handle_workflows_list(cmd, env):
    render_workflows(list_workflows())


def _handle_workflow_run(cmd, env):
    wf = get_workflow(cmd["name"])
    if not wf:
        console.print(
            f"[red]Workflow '{cmd['name']}' not found[/red]"
        )
        return
    console.print(
        f"[bold cyan]▶ Running: {wf['name']}[/bold cyan]"
    )
    for i, step in enumerate(wf["steps"], 1):
        render_workflow_step(i, len(wf["steps"]), step)
        step_cmd = resolve_command(step)
        if step_cmd and isinstance(step_cmd, str):
            execute(step_cmd)
        elif step_cmd:
            dispatch(step_cmd, env)
        console.print()
    console.print("[green]✓ Workflow complete[/green]")


def _handle_watch_cmd(cmd, env):
    watch_input = cmd["command"]
    from datetime import datetime
    from core.cache import invalidate
    import shlex
    with Live(console=console, refresh_per_second=1) as live:
        while True:
            invalidate()
            resolved = resolve_command(watch_input)
            if resolved and isinstance(resolved, str):
                result = subprocess.run(
                    shlex.split(resolved), shell=False,
                    capture_output=True, text=True
                )
                now = datetime.now().strftime("%H:%M:%S")
                live.update(
                    Panel(
                        result.stdout or result.stderr,
                        title=(
                            f"[bold]⟳ {watch_input}[/bold] "
                            f"[dim]{now}[/dim]"
                        ),
                        subtitle="[dim]Ctrl+C to stop[/dim]",
                        border_style="cyan"
                    )
                )
            time.sleep(SETTINGS["refresh_interval"])


def _handle_rbac(cmd, env):
    with loading("Fetching RBAC..."):
        bindings = list_role_bindings()
    render_rbac(bindings)


def _handle_shell(cmd, env):
    target = cmd["target"]
    shell_cmd = [
        "kubectl", "--context", context.current_context,
        "exec", "-it", target, "-n", context.namespace, "--",
        "/bin/sh", "-c", "command -v bash && exec bash || exec sh"
    ]
    console.print(
        f"[green]✓ Shell into {target}[/green]\n"
        f"[dim]Type 'exit' to return[/dim]"
    )
    subprocess.run(shell_cmd, shell=False)


def _handle_timeline(cmd, env):
    with loading("Building timeline..."):
        events = build_timeline(minutes=60)
    render_timeline(events)


def _handle_labels(cmd, env):
    resources = get_labels(
        cmd["resource_type"], cmd.get("name")
    )
    render_labels(resources)


def _handle_apply(cmd, env):
    file_path = cmd["file"]
    apply_cmd = [
        "kubectl", "--context", context.current_context,
        "apply", "-f", file_path, "-n", context.namespace
    ]
    console.print(f"[dim]→ {' '.join(apply_cmd)}[/dim]")
    result = subprocess.run(
        apply_cmd, shell=False,
        capture_output=True, text=True
    )
    if result.returncode == 0:
        console.print(f"[green]✓ {result.stdout.strip()}[/green]")
    else:
        console.print(f"[red]{result.stderr}[/red]")


def _handle_snap(cmd, env):
    with loading("Capturing state..."):
        path = take_state_snapshot()
    console.print(
        f"[green]✓ Snapshot saved:[/green] [dim]{path}[/dim]"
    )


def _handle_snap_diff(cmd, env):
    with loading("Comparing state..."):
        old = get_latest_snapshot()
        diff_data = diff_snapshots(old)
    render_snapshot_diff(diff_data)


def _handle_changelog(cmd, env):
    with loading("Building changelog..."):
        changelog = build_changelog()
    render_changelog(changelog)


def _handle_resource_history(cmd, env):
    events = resource_history(cmd["name"])
    render_resource_history(events, cmd["name"])


def _handle_mesh(cmd, env):
    with loading("Detecting service mesh..."):
        data = detect_mesh()
    render_mesh(data)


def _handle_ingress(cmd, env):
    ingresses = list_ingresses()
    render_ingresses(ingresses)


def _handle_deps(cmd, env):
    with loading(f"Mapping dependencies for {cmd['target']}..."):
        deps = service_dependencies(cmd["target"])
    render_dependencies(deps)


def _handle_dns(cmd, env):
    data = dns_debug(cmd["service"])
    render_dns(data)


def _handle_kubectl_pretty(cmd, env):
    """Run kubectl command with pretty-printed output."""
    from core.renderers.describe_renderer import (
        render_describe
    )
    import shlex

    kubectl_cmd = cmd["cmd"]
    console.print(f"[dim]→ {kubectl_cmd}[/dim]")

    result = subprocess.run(
        shlex.split(kubectl_cmd),
        shell=False,
        capture_output=True,
        text=True
    )

    if result.returncode != 0:
        err = result.stderr.strip()
        console.print(
            Panel(
                f"[red]{err}[/red]",
                title="[red]Error[/red]",
                border_style="red",
            )
        )
        return

    output = result.stdout.strip()
    if not output:
        console.print("[dim]No output[/dim]")
        return

    # Detect action and resource type
    parts = kubectl_cmd.split()
    action = ""
    resource = ""
    for i, p in enumerate(parts):
        if p in ("describe", "get", "delete"):
            action = p
            if i + 1 < len(parts):
                resource = parts[i + 1]
            break

    if action == "describe":
        render_describe(output, resource)
    elif action == "get":
        _render_get(output)
    elif action == "delete":
        console.print(
            f"[green]✓[/green] {output}"
        )
    else:
        console.print(output)



def _render_get(output):
    """Pretty-print kubectl get output as a table."""
    from rich.table import Table

    lines = output.strip().split("\n")
    if not lines:
        return

    # First line is header
    headers = lines[0].split()
    table = Table(show_header=True, border_style="dim")

    for h in headers:
        style = None
        if h == "STATUS":
            style = "cyan"
        elif h == "NAME":
            style = "bold"
        table.add_column(h, style=style)

    for line in lines[1:]:
        if not line.strip():
            continue
        cols = line.split(None, len(headers) - 1)
        # Color status column
        styled = []
        for i, col in enumerate(cols):
            if i < len(headers) and headers[i] == "STATUS":
                if col in ("Running", "Active", "Bound", "Available"):
                    styled.append(f"[green]{col}[/green]")
                elif col in ("Pending", "Terminating"):
                    styled.append(f"[yellow]{col}[/yellow]")
                elif col in (
                    "CrashLoopBackOff", "Error",
                    "Failed", "ImagePullBackOff"
                ):
                    styled.append(f"[red]{col}[/red]")
                else:
                    styled.append(col)
            else:
                styled.append(col)
        table.add_row(*styled)

    console.print(table)

def _handle_uptime(cmd, env):
    from core.collectors.uptime import collect_uptime

    with loading("Checking cluster uptime..."):
        data = collect_uptime()

    if not data["api_reachable"]:
        border = "red"
        status = "[bold red]⬤ UNREACHABLE[/bold red]"
    elif data["cluster_down"]:
        border = "yellow"
        status = "[bold yellow]⬤ DOWN[/bold yellow]"
    else:
        border = "green"
        status = "[bold green]⬤ UP[/bold green]"

    info = (
        f"[bold cyan]Context:[/bold cyan]  "
        f"{data['context']}\n"
        f"[bold cyan]Status:[/bold cyan]   {status}\n"
        f"[bold cyan]Day:[/bold cyan]      "
        f"{data['day']}\n"
    )

    if data["downtime_hint"]:
        info += (
            f"\n[yellow]⚠ {data['downtime_hint']}"
            f"[/yellow]\n"
        )

    if data["nodes"]:
        info += f"\n[bold]Nodes ({len(data['nodes'])}):[/bold]\n"
        for n in data["nodes"]:
            icon = (
                "[green]●[/green]"
                if n["ready"]
                else "[red]●[/red]"
            )
            info += (
                f"  {icon} {n['name']}  "
                f"uptime: {n['uptime_human']}\n"
            )

    pods = data["pods"]
    if pods["total"] > 0:
        info += (
            f"\n[bold]Pods:[/bold] "
            f"{pods['running']}/{pods['total']} running"
        )
        if pods["down"] > 0:
            info += (
                f"  [red]({pods['down']} down)[/red]"
            )

    console.print(
        Panel(
            info,
            title="[bold]⏱ Cluster Uptime[/bold]",
            border_style=border,
        )
    )


def _handle_correlate_logs(cmd, env):
    from core.collectors.log_correlation import correlate_logs
    from core.resolver import resolve_pod_name
    from core.selector import choose_pod

    pods = cmd.get("pods", [])
    resolved = []
    for p in pods:
        matches = resolve_pod_name(p)
        if matches:
            resolved.append(choose_pod(matches) or matches[0])
        else:
            resolved.append(p)

    with loading(f"Correlating logs from {len(resolved)} pods..."):
        data = correlate_logs(resolved, tail=50)

    if not data["entries"]:
        console.print("[dim]No log entries found[/dim]")
        return

    from rich.table import Table
    table = Table(show_header=True, border_style="dim", expand=True)
    table.add_column("Time", width=12, style="dim")
    table.add_column("Pod", width=18, style="cyan")
    table.add_column("Message")

    for entry in data["entries"][-80:]:
        ts = entry["timestamp"][-12:] if entry["timestamp"] else ""
        style = "red" if entry["level"] == "error" else "yellow" if entry["level"] == "warn" else ""
        table.add_row(ts, entry["pod"], f"[{style}]{entry['message']}[/{style}]" if style else entry["message"])

    console.print(Panel(table, title=f"[bold]Log Correlation ({data['total']} entries)[/bold]", border_style="cyan"))


def _handle_diff_timeline(cmd, env):
    from core.collectors.diff_timeline import collect_diff_timeline

    hours = cmd.get("hours", 24)
    with loading(f"Scanning changes in last {hours}h..."):
        data = collect_diff_timeline(hours)

    if not data["changes"]:
        console.print("[green]No changes detected[/green]")
        return

    lines = [f"[bold]{data['total']} changes in last {hours}h:[/bold]\n"]
    icons = {
        "image_changes": "📦", "scaling": "⚖️",
        "restarts": "🔄", "new_deployments": "🆕",
        "deletions": "🗑️", "config_changes": "⚙️",
        "other": "•",
    }
    for category, events in data["changes"].items():
        icon = icons.get(category, "•")
        label = category.replace("_", " ").title()
        lines.append(f"  {icon} [bold]{label}[/bold] ({len(events)})")
        for ev in events[:5]:
            lines.append(f"     [dim]{ev['name']}[/dim] — {ev['message'][:60]}")

    console.print(Panel("\n".join(lines), title="[bold]📅 Diff Timeline[/bold]", border_style="cyan"))


def _handle_dep_health(cmd, env):
    from core.collectors.dep_health import dependency_health
    from core.resolver import resolve_deployment_name
    from core.selector import choose_deployment

    target = cmd["target"]
    matches = resolve_deployment_name(target)
    if matches:
        target = choose_deployment(matches) or target

    with loading(f"Mapping dependencies for {target}..."):
        data = dependency_health(target)

    lines = [f"[bold]{target}[/bold] dependency health:\n"]
    for node in data["nodes"]:
        icon = "[green]●[/green]" if node["healthy"] else "[red]●[/red]"
        lines.append(f"  {icon} {node['name']} [{node['type']}] — {node['detail']}")

    if data["root_cause"]:
        lines.append(f"\n[bold red]⚠ Likely root cause:[/bold red]")
        lines.append(f"  {data['root_cause']['suggestion']}")

    console.print(Panel("\n".join(lines), title="[bold]🔗 Dependency Health[/bold]", border_style="cyan"))


def _handle_rollback_preview(cmd, env):
    from core.collectors.rollback_preview import rollback_preview
    from core.resolver import resolve_deployment_name
    from core.selector import choose_deployment

    target = cmd["target"]
    matches = resolve_deployment_name(target)
    if matches:
        target = choose_deployment(matches) or target

    with loading(f"Fetching rollback preview for {target}..."):
        data = rollback_preview(target)

    if not data["available"]:
        console.print(f"[red]{data.get('reason', 'Cannot preview')}[/red]")
        return

    if not data["has_changes"]:
        console.print(f"[dim]No differences between current and previous revision[/dim]")
        return

    from rich.table import Table
    table = Table(show_header=True, border_style="dim")
    table.add_column("Field", style="cyan")
    table.add_column("Current", style="red")
    table.add_column("Rollback To", style="green")

    for diff in data["diffs"]:
        table.add_row(diff["field"], diff["current"][:50], diff["rollback_to"][:50])

    console.print(Panel(table, title=f"[bold]↩ Rollback Preview: {target}[/bold]", border_style="yellow"))


def _handle_watch_alert(cmd, env):
    from core.watch_alert import (
        get_watcher, pod_crash_condition,
        pod_restart_condition, pod_count_condition,
        pod_oom_condition, pod_pending_condition,
        pod_ready_condition,
    )

    target = cmd["target"]
    condition = cmd.get("condition", "crash")
    threshold = cmd.get("threshold")
    interval = cmd.get("interval", 30)
    watcher = get_watcher()

    # Sub-commands: rm, mute, unmute, history
    if target == "rm" and condition:
        watcher.remove(condition)
        console.print(f"[green]✓ Removed watch:[/green] {condition}")
        return
    if target == "mute" and condition:
        if watcher.mute(condition):
            console.print(f"[yellow]🔇 Muted:[/yellow] {condition}")
        else:
            console.print(f"[red]Watch not found:[/red] {condition}")
        return
    if target == "unmute" and condition:
        if watcher.unmute(condition):
            console.print(f"[green]🔔 Unmuted:[/green] {condition}")
        else:
            console.print(f"[red]Watch not found:[/red] {condition}")
        return
    if target == "history":
        _render_watch_history(watcher)
        return
    if target == "clear":
        watcher.clear_all()
        console.print("[green]✓ All watches cleared[/green]")
        return

    # Build condition
    conditions = {
        "crash": lambda: pod_crash_condition(target),
        "restart": lambda: pod_restart_condition(
            target, int(threshold) if threshold else 5
        ),
        "count": lambda: pod_count_condition(
            target, int(threshold) if threshold else 1
        ),
        "oom": lambda: pod_oom_condition(target),
        "pending": lambda: pod_pending_condition(
            target, int(threshold) if threshold else 120
        ),
        "ready": lambda: pod_ready_condition(
            target, int(threshold) if threshold else 1
        ),
    }

    if condition not in conditions:
        console.print(
            f"[red]Unknown condition:[/red] {condition}\n"
            f"[dim]Available: {', '.join(conditions.keys())}[/dim]"
        )
        return

    check_fn = conditions[condition]()
    name = f"{target}-{condition}"
    watcher.add(name, check_fn, interval=interval)
    watcher.start()

    console.print(
        Panel(
            f"[green]✓ Watch created[/green]\n"
            f"\n"
            f"  Name:       [bold]{name}[/bold]\n"
            f"  Target:     {target}\n"
            f"  Condition:  {condition}"
            f"{'  (threshold: ' + str(threshold) + ')' if threshold else ''}\n"
            f"  Interval:   {interval}s\n"
            f"\n"
            f"[dim]  Desktop notification on trigger + recovery.\n"
            f"  Run: watch-status to see all watches\n"
            f"  Run: watch-alert rm {name} to remove[/dim]",
            title="[bold]👁 Watch Alert[/bold]",
            border_style="cyan",
        )
    )


def _render_watch_history(watcher):
    history = watcher.history(20)
    if not history:
        console.print("[dim]No alert history yet[/dim]")
        return

    from rich.table import Table
    table = Table(
        show_header=True,
        header_style="bold cyan",
        border_style="dim",
        expand=True,
        show_lines=False,
    )
    table.add_column("", width=2)
    table.add_column("Time", width=8)
    table.add_column("Watch", width=25)
    table.add_column("Message", ratio=1)

    for entry in reversed(history):
        is_recovery = entry["type"] == "recovered"
        icon = "[green]✓[/green]" if is_recovery else "[red]●[/red]"
        time_str = entry["time"][11:19]

        table.add_row(
            icon,
            f"[dim]{time_str}[/dim]",
            entry["watch"],
            entry["message"],
        )

    console.print(
        Panel(table, title="[bold]📜 Alert History[/bold]", border_style="cyan")
    )


def _handle_watch_status(cmd, env):
    from core.watch_alert import get_watcher

    status = get_watcher().status()
    if not status["watches"]:
        console.print(
            Panel(
                "[dim]No active watches.\n\n"
                "Usage:\n"
                "  [cyan]watch-alert <pod> crash[/cyan]      — alert on CrashLoopBackOff\n"
                "  [cyan]watch-alert <pod> restart 10[/cyan] — alert on 10+ restarts\n"
                "  [cyan]watch-alert <pod> oom[/cyan]        — alert on OOMKilled\n"
                "  [cyan]watch-alert <pod> pending[/cyan]    — alert if stuck Pending\n"
                "  [cyan]watch-alert <pod> count 3[/cyan]    — alert if < 3 running\n"
                "  [cyan]watch-alert <pod> ready 2[/cyan]    — alert if < 2 ready[/dim]",
                title="[bold]👁 Watch Status[/bold]",
                border_style="dim",
            )
        )
        return

    from rich.table import Table
    table = Table(
        show_header=True,
        header_style="bold cyan",
        border_style="dim",
        expand=True,
        show_lines=False,
    )

    table.add_column("", width=2)
    table.add_column("Watch", ratio=2)
    table.add_column("State", width=12, justify="center")
    table.add_column("Alerts", width=6, justify="right")
    table.add_column("Checks", width=7, justify="right")
    table.add_column("Interval", width=8, justify="right")
    table.add_column("Last", width=20, style="dim")

    for w in status["watches"]:
        if w["triggered"]:
            icon = "[red]🔔[/red]"
            state = "[red]FIRING[/red]"
        elif w["muted"]:
            icon = "[yellow]🔇[/yellow]"
            state = "[yellow]muted[/yellow]"
        else:
            icon = "[green]●[/green]"
            state = "[green]OK[/green]"

        alert_count = str(w["alert_count"])
        if w["alert_count"] > 0:
            alert_count = f"[red]{w['alert_count']}[/red]"

        last_msg = w["last_message"][:20] if w["last_message"] else "—"

        table.add_row(
            icon,
            w["name"],
            state,
            alert_count,
            str(w["check_count"]),
            f"{w['interval']}s",
            last_msg,
        )

    running = status["running"]
    footer = (
        f"[green]● Running[/green]" if running
        else "[red]● Stopped[/red]"
    )

    console.print(
        Panel(table, title="[bold]👁 Watch Status[/bold]", border_style="cyan")
    )
    console.print(f"  {footer}  │  [dim]{len(status['watches'])} watches[/dim]")
    console.print(
        f"[dim]  Commands: watch-alert rm <name> │ "
        f"watch-alert mute <name> │ watch-alert history[/dim]\n"
    )


def _handle_scorecard(cmd, env):
    from core.collectors.scorecard import cluster_scorecard

    with loading("Generating cluster scorecard..."):
        data = cluster_scorecard()

    grade = data["overall_grade"]
    score = data["overall_score"]
    grade_color = "green" if grade in ("A", "B") else "yellow" if grade == "C" else "red"

    lines = [
        f"[bold]Overall: [{grade_color}]{grade}[/{grade_color}] ({score}/100)[/bold]\n",
        f"[dim]{data['summary']}[/dim]\n",
    ]

    for cat, info in data["categories"].items():
        g = info["grade"]
        gc = "green" if g in ("A", "B") else "yellow" if g == "C" else "red"
        lines.append(f"  [{gc}]{g}[/{gc}] {cat.title():15} ({info['score']}/100)")
        for issue in info["issues"]:
            lines.append(f"     [dim]• {issue}[/dim]")

    if data["recommendations"]:
        lines.append("\n[bold]Recommendations:[/bold]")
        for rec in data["recommendations"][:5]:
            lines.append(f"  → {rec['issue']}")
            lines.append(f"    [cyan]{rec['action']}[/cyan]")

    console.print(Panel("\n".join(lines), title="[bold]🏆 Cluster Scorecard[/bold]", border_style=grade_color))


def _handle_cost_estimate(cmd, env):
    from core.collectors.cost_estimate import estimate_costs

    with loading("Estimating costs..."):
        data = estimate_costs()

    if not data["deployments"]:
        console.print("[dim]No deployments found[/dim]")
        return

    from rich.table import Table
    table = Table(show_header=True, border_style="dim", expand=True)
    table.add_column("Deployment")
    table.add_column("Replicas", justify="center")
    table.add_column("CPU", justify="right")
    table.add_column("Memory", justify="right")
    table.add_column("$/pod/mo", justify="right")
    table.add_column("$/total/mo", justify="right", style="bold")

    for d in data["deployments"][:15]:
        table.add_row(
            d["name"], str(d["replicas"]),
            d["cpu_request"], d["memory_request"],
            f"${d['cost_per_pod']:.2f}",
            f"${d['cost_total']:.2f}",
        )

    console.print(Panel(table, title=f"[bold]💰 Cost Estimate — ${data['total']:.2f}/month[/bold]", border_style="green"))
    console.print(f"[dim]{data['pricing']['note']}[/dim]")


def _handle_remediate(cmd, env):
    from core.remediation import auto_remediate
    from core.resolver import resolve_pod_name
    from core.selector import choose_pod

    target = cmd["target"]
    matches = resolve_pod_name(target)
    if matches:
        target = choose_pod(matches) or target

    with loading(f"Auto-remediating {target}..."):
        data = auto_remediate(target)

    if data.get("blocked"):
        console.print(f"[yellow]⚠ {data['reason']}[/yellow]")
        if data.get("suggestion"):
            console.print(f"[dim]{data['suggestion']}[/dim]")
        return

    if data["result"] == "healthy":
        console.print(f"[green]✓ {data['message']}[/green]")
        return

    if data["actions"]:
        for a in data["actions"]:
            icon = "[green]✓[/green]" if a["success"] else "[red]✗[/red]"
            console.print(f"  {icon} {a['action']}")
            if a["output"]:
                console.print(f"    [dim]{a['output'][:100]}[/dim]")
    else:
        console.print("[yellow]Manual intervention required[/yellow]")
        if data.get("playbooks"):
            console.print(f"[dim]Suggested playbooks: {', '.join(data['playbooks'])}[/dim]")


def _handle_yaml_diff(cmd, env):
    from core.collectors.yaml_diff import yaml_diff
    from core.resolver import resolve_deployment_name
    from core.selector import choose_deployment

    target = cmd["target"]
    matches = resolve_deployment_name(target)
    if matches:
        target = choose_deployment(matches) or target

    with loading(f"Comparing revisions for {target}..."):
        data = yaml_diff(target)

    if not data.get("available"):
        console.print(f"[red]{data.get('reason', 'Cannot diff')}[/red]")
        return

    if data["total_changes"] == 0:
        console.print("[dim]No differences between revisions[/dim]")
        return

    lines = [
        f"[green]+{data['additions']}[/green] "
        f"[red]-{data['deletions']}[/red] changes\n"
    ]
    for line in data["diff_lines"][:60]:
        if line.startswith("+") and not line.startswith("+++"):
            lines.append(f"[green]{line}[/green]")
        elif line.startswith("-") and not line.startswith("---"):
            lines.append(f"[red]{line}[/red]")
        elif line.startswith("@@"):
            lines.append(f"[cyan]{line}[/cyan]")
        else:
            lines.append(f"[dim]{line}[/dim]")

    console.print(Panel("\n".join(lines), title=f"[bold]YAML Diff: {target}[/bold]", border_style="cyan"))


def _handle_save_query(cmd, env):
    from core.saved_queries import save_query

    name = cmd.get("name", "")
    query = cmd.get("query", "")
    if not name:
        console.print("[red]Usage: pin <name> <query>[/red]")
        return
    if not query:
        console.print("[red]Usage: pin <name> <query>[/red]")
        return

    save_query(name, query)
    console.print(f"[green]✓ Pinned:[/green] {name} → [cyan]{query}[/cyan]")


def _handle_list_queries(cmd, env):
    from core.saved_queries import list_queries

    queries = list_queries()
    if not queries:
        console.print("[dim]No pinned queries. Use: pin <name> <query>[/dim]")
        return

    lines = [f"[bold]Pinned Queries ({len(queries)}):[/bold]\n"]
    for q in queries:
        lines.append(f"  ● [cyan]{q['name']}[/cyan] → {q['query']}")
        if q.get("last_run"):
            lines.append(f"    [dim]Last run: {q['last_run'][:16]}[/dim]")

    console.print(Panel("\n".join(lines), title="[bold]📌 Saved Queries[/bold]", border_style="cyan"))


def _handle_policy_check(cmd, env):
    from core.policy import check_policies, load_policies

    policies = load_policies()
    if not policies:
        console.print(
            "[dim]No policies defined. Create "
            "~/.kubsome/policies.yaml or "
            ".kubsome/policies.yaml[/dim]"
        )
        return

    with loading("Checking policies..."):
        result = check_policies()

    violations = result["violations"]
    passed = result["passed"]
    total = result["total"]

    lines = [
        f"[bold]Policy Check:[/bold] "
        f"{passed}/{total} passed\n",
    ]

    if not violations:
        lines.append("[green]\u2713 All policies pass![/green]")
    else:
        lines.append(
            f"[red]{len(violations)} violation(s):[/red]\n"
        )
        for v in violations:
            sev_color = (
                "red" if v["severity"] == "high"
                else "yellow" if v["severity"] == "medium"
                else "dim"
            )
            lines.append(
                f"  [{sev_color}]\u2717[/{sev_color}] "
                f"[bold]{v['policy']}[/bold] \u2014 "
                f"{v['resource']}\n"
                f"    [dim]{v['detail']}[/dim]"
            )

    console.print(
        Panel(
            "\n".join(lines),
            title="[bold]\U0001f6e1 Policy Check[/bold]",
            border_style="cyan",
        )
    )


def _handle_plugin_install(cmd, env):
    from core.plugins import install_plugin

    name = cmd["name"]
    with loading(f"Installing plugin '{name}'..."):
        success, message = install_plugin(name)

    if success:
        console.print(f"[green]\u2713 {message}[/green]")
    else:
        console.print(f"[red]{message}[/red]")


def _handle_plugin_uninstall(cmd, env):
    from core.plugins import uninstall_plugin

    name = cmd["name"]
    success, message = uninstall_plugin(name)
    if success:
        console.print(f"[green]\u2713 {message}[/green]")
    else:
        console.print(f"[red]{message}[/red]")


def _handle_gitops(cmd, env):
    with loading("Checking GitOps status..."):
        data = collect_gitops()
    render_gitops(data)


def _handle_gitops_detail(cmd, env):
    app_name = cmd["target"]
    with loading(f"Fetching {app_name}..."):
        data = gitops_app_detail(app_name)
    render_gitops_detail(data)


def _handle_mesh_detail(cmd, env):
    with loading("Scanning service mesh..."):
        data = collect_mesh_detail()
    render_mesh_detail(data)


def _handle_virtual_services(cmd, env):
    target = cmd.get("target")
    with loading("Fetching VirtualServices..."):
        vs = collect_virtual_services(target)
    render_virtual_services(vs)


def _handle_destination_rules(cmd, env):
    target = cmd.get("target")
    with loading("Fetching DestinationRules..."):
        dr = collect_destination_rules(target)
    render_destination_rules(dr)


def _handle_mtls(cmd, env):
    with loading("Checking mTLS status..."):
        data = collect_mtls_status()
    render_mtls_status(data)


def _handle_connect_list(cmd, env):
    integrations = list_integrations()
    render_integrations(integrations)


def _handle_connect(cmd, env):
    name = cmd["target"]
    url = cmd.get("url")
    with loading(f"Connecting {name}..."):
        result = connect_integration(name, url)
    render_connect_result(result)


def _handle_disconnect(cmd, env):
    name = cmd["target"]
    result = disconnect_integration(name)
    render_disconnect_result(result)


def _handle_connect_discover(cmd, env):
    with loading("Auto-discovering integrations..."):
        discoveries = auto_discover()
    render_discoveries(discoveries)
    if discoveries:
        console.print()
        from questionary import confirm
        try:
            if confirm("Connect all discovered?").ask():
                results = connect_discovered(discoveries)
                render_connect_all_results(results)
        except Exception:
            pass


def _handle_profile_list(cmd, env):
    profiles = list_profiles()
    active = get_active_profile()

    lines = []
    if active:
        lines.append(
            f"[bold]Active:[/bold] [cyan]{active}[/cyan]\n"
        )

    for p in profiles:
        icon = (
            "[green]●[/green]" if p["active"]
            else "[dim]○[/dim]"
        )
        source = (
            f" [dim]({p['source']})[/dim]"
            if p["source"] == "custom" else ""
        )
        lines.append(
            f"  {icon} [bold]{p['name']}[/bold]{source}"
            f"\n    [dim]{p['description']}[/dim]"
        )

    console.print(
        Panel(
            "\n".join(lines),
            title="[bold]👤 Profiles[/bold]",
            border_style="cyan",
        )
    )
    console.print(
        "[dim]  Activate: profile use <name>\n"
        "  Reset:    profile reset[/dim]"
    )


def _handle_profile_use(cmd, env):
    name = cmd["name"]
    result = activate_profile(name)
    if result["success"]:
        console.print(
            f"[green]✓ {result['message']}[/green]"
        )
        overrides = result.get("overrides", {})
        if overrides:
            for k, v in overrides.items():
                console.print(f"  [dim]{k}: {v}[/dim]")
        # Reload settings
        from config.settings import SETTINGS
        from core.config import load_config
        new_config = load_config()
        SETTINGS.update(new_config)
    else:
        console.print(
            f"[red]✗ {result['message']}[/red]"
        )
        if result.get("available"):
            console.print(
                f"  [dim]Available: "
                f"{', '.join(result['available'])}[/dim]"
            )


def _handle_profile_reset(cmd, env):
    result = deactivate_profile()
    console.print(f"[green]✓ {result['message']}[/green]")
    # Reload settings
    from config.settings import SETTINGS
    from core.config import load_config
    new_config = load_config()
    SETTINGS.update(new_config)


def _handle_guided(cmd, env):
    from core.guided import run_guided_mode
    result = run_guided_mode()
    if result:
        console.print(f"[dim]→ {result}[/dim]")
        resolved = resolve_command(result)
        if resolved and isinstance(resolved, str):
            from core.executor import execute
            execute(resolved)
        elif resolved:
            dispatch(resolved, env)


def _handle_env_info(cmd, env):
    from core.env_switch import detect_environment, DEFAULT_ENV_RULES
    from core.profiles import get_active_profile

    current = detect_environment()
    active_profile = get_active_profile()

    lines = [
        f"[bold cyan]Context:[/bold cyan]     "
        f"{current['context']}",
        f"[bold cyan]Environment:[/bold cyan] "
        f"[{current['color']}]{current['icon']} "
        f"{current['name']}[/{current['color']}]",
        f"[bold cyan]Safety:[/bold cyan]      "
        f"{'✓ Confirmations required' if current['confirm_destructive'] else '✗ No confirmations'}",
        f"[bold cyan]Profile:[/bold cyan]     "
        f"{active_profile or current.get('profile') or 'none'}",
    ]

    blocked = current.get("blocked_commands", [])
    if blocked:
        lines.append(
            f"[bold cyan]Blocked:[/bold cyan]     "
            f"[red]{', '.join(blocked)}[/red]"
        )

    lines.append("\n[bold]Environment Rules:[/bold]")
    for name, rules in DEFAULT_ENV_RULES.items():
        patterns = ", ".join(rules["patterns"][:4])
        color = rules["color"]
        icon = (
            "[green]●[/green]" if name == current["key"]
            else "[dim]○[/dim]"
        )
        lines.append(
            f"  {icon} [{color}]{name.upper():10}[/{color}] "
            f"[dim]patterns: {patterns}[/dim]"
        )

    console.print(
        Panel(
            "\n".join(lines),
            title="[bold]🌍 Environment[/bold]",
            border_style=current["color"],
        )
    )
    console.print(
        "[dim]  Customize in ~/.kubsome/config.yaml "
        "under 'environments:'[/dim]"
    )


def _handle_analytics_stats(cmd, env):
    from core.analytics.engine import get_stats

    with loading("Loading analytics..."):
        stats = get_stats()

    lines = [
        f"[bold cyan]Database:[/bold cyan]  {stats['db_path']}",
        f"[bold cyan]Size:[/bold cyan]      {stats['db_size_mb']} MB",
        "",
        "[bold]Storage Levels:[/bold]",
        f"  Raw:        {stats['raw_rows']:,} rows",
    ]
    if stats['raw_from']:
        lines.append(
            f"              [dim]{stats['raw_from'][:16]} "
            f"\u2192 {stats['raw_to'][:16]}[/dim]"
        )
    lines.append(f"  Hourly:     {stats['hourly_rows']:,} rows")
    if stats['hourly_from']:
        lines.append(
            f"              [dim]{stats['hourly_from'][:16]} "
            f"\u2192 {stats['hourly_to'][:16]}[/dim]"
        )
    lines.append(f"  Daily:      {stats['daily_rows']:,} rows")

    console.print(
        Panel(
            "\n".join(lines),
            title="[bold]\U0001f4ca Analytics Engine[/bold]",
            border_style="cyan",
        )
    )


def _handle_rightsizing(cmd, env):
    from core.analytics.rightsizing import (
        optimization_report
    )

    with loading("Analyzing resource usage..."):
        report = optimization_report()

    summary = report["summary"]
    if summary["deployments"] == 0:
        console.print(
            "[dim]No analytics data yet. "
            "Run 'collect' to start, or wait for "
            "auto-collection.[/dim]"
        )
        return

    lines = [
        f"[bold]Cluster Utilization (7d):[/bold]",
        f"  CPU: {summary['cpu_util_pct']}%  "
        f"  Memory: {summary['mem_util_pct']}%  "
        f"  Deployments: {summary['deployments']}",
        f"  CPU waste: {summary['cpu_waste_m']}m  "
        f"  Memory waste: {summary['mem_waste_mb']}Mi",
        "",
    ]

    recs = report["recommendations"]
    at_risk = report["at_risk"]

    # Under-provisioned (urgent)
    if at_risk:
        lines.append(
            f"[bold red]\u26a0 {len(at_risk)} AT RISK "
            f"(usage > 85% of request):[/bold red]\n"
        )
        for r in at_risk[:5]:
            lines.append(
                f"  [red]\u25cf[/red] [bold]{r['deployment']}[/bold] "
                f"[dim]({r['namespace']})[/dim]  "
                f"CPU:{r['cpu_util_pct']}%  "
                f"Mem:{r['mem_util_pct']}%  "
                f"[dim]{r['action']}[/dim]"
            )
        lines.append("")

    # Over-provisioned (savings)
    if not recs:
        lines.append("[green]\u2713 All deployments well-sized[/green]")
    else:
        total = report["total_monthly_savings_usd"]
        lines.append(
            f"[bold]{len(recs)} over-provisioned "
            f"(save [green]${total:.2f}/mo[/green]):[/bold]\n"
        )
        for r in recs[:8]:
            risk_icon = {
                "low": "[green]\u25cf[/green]",
                "medium": "[yellow]\u25cf[/yellow]",
                "high": "[red]\u25cf[/red]",
            }.get(r["risk"], "\u25cf")

            current = r["current"]
            recommended = r["recommended"]
            usage = r["usage"]

            lines.append(
                f"  {risk_icon} [bold]{r['deployment']}[/bold] "
                f"[dim]({r['namespace']}, {r['pods']} pods)[/dim]  "
                f"confidence:{r['confidence']}%  "
                f"risk:{r['risk']}"
            )
            lines.append(
                f"    CPU: {current['cpu_request']}m \u2192 "
                f"[cyan]{recommended['cpu_request']}m[/cyan] req, "
                f"[cyan]{recommended['cpu_limit']}m[/cyan] lim  "
                f"[dim](P95={usage['cpu_p95']}m, "
                f"avg={usage['cpu_avg']}m)[/dim]"
            )
            lines.append(
                f"    Mem: {current['mem_request']}Mi \u2192 "
                f"[cyan]{recommended['mem_request']}Mi[/cyan] req, "
                f"[cyan]{recommended['mem_limit']}Mi[/cyan] lim  "
                f"[dim](P95={usage['mem_p95']}Mi, "
                f"avg={usage['mem_avg']}Mi)[/dim]"
            )
            lines.append(
                f"    [green]Save ${r['total_savings_monthly']:.2f}/mo[/green]  "
                f"[dim]{r['reason'][:60]}[/dim]"
            )
            lines.append("")

    # Methodology
    m = report["methodology"]
    lines.append("[dim]Methodology:[/dim]")
    lines.append(
        f"[dim]  Request={m['request_formula']}, "
        f"Limit={m['limit_formula']}, "
        f"Min samples={m['min_samples']}h[/dim]"
    )

    console.print(
        Panel(
            "\n".join(lines),
            title="[bold]\U0001f4cf Right-Sizing Recommendations[/bold]",
            border_style="cyan",
        )
    )


def _handle_rightsizing_dryrun(cmd, env):
    from core.analytics.safe_apply import dry_run

    with loading("Validating patches (dry-run=server)..."):
        result = dry_run()

    if not result["results"]:
        console.print("[dim]No recommendations to validate[/dim]")
        return

    console.print(
        f"\n[bold]Dry Run Results:[/bold] "
        f"[green]{result['passed']} passed[/green] · "
        f"[red]{result['failed']} failed[/red] / "
        f"{result['total']} total\n"
    )

    for r in result["results"]:
        icon = "[green]\u2713[/green]" if r["passed"] else "[red]\u2717[/red]"
        console.print(
            f"  {icon} [bold]{r['deployment']}[/bold] "
            f"[dim]({r['namespace']})[/dim]  "
            f"{r['message'][:80]}"
        )


def _handle_rightsizing_diff(cmd, env):
    from core.analytics.safe_apply import diff

    with loading("Computing diff..."):
        diffs = diff()

    if not diffs:
        console.print("[dim]No recommendations[/dim]")
        return

    table = Table(
        title="Current vs Recommended",
        show_header=True,
        header_style="bold cyan",
        border_style="dim",
    )
    table.add_column("Deployment")
    table.add_column("CPU req")
    table.add_column("Mem req")
    table.add_column("CPU lim")
    table.add_column("Mem lim")
    table.add_column("Risk")
    table.add_column("$/mo")

    for d in diffs:
        risk_color = {
            "low": "green", "medium": "yellow", "high": "red"
        }.get(d["risk"], "white")
        table.add_row(
            d["deployment"],
            f"{d['current']['cpu_request']} \u2192 {d['recommended']['cpu_request']}",
            f"{d['current']['mem_request']} \u2192 {d['recommended']['mem_request']}",
            f"{d['current']['cpu_limit']} \u2192 {d['recommended']['cpu_limit']}",
            f"{d['current']['mem_limit']} \u2192 {d['recommended']['mem_limit']}",
            f"[{risk_color}]{d['risk']}[/{risk_color}]",
            f"[green]${d['savings_monthly']:.2f}[/green]",
        )

    console.print(table)


def _handle_rightsizing_apply(cmd, env):
    from core.analytics.safe_apply import apply_safe
    from core.context import context as k8s_ctx

    ctx = k8s_ctx.current_context
    if ctx and ("prod" in ctx or "prd" in ctx):
        console.print(
            "[red]\u2717 Blocked in production.[/red] "
            "Use [cyan]rightsizing-gitops[/cyan] instead."
        )
        return

    console.print(
        "[yellow]\u26a0 This will apply phase-1 (low-risk) "
        "changes with 5-min health watch.[/yellow]\n"
        "[dim]Auto-rollback on failure. "
        "Ctrl+C to abort.[/dim]\n"
    )

    with loading("Applying safe recommendations..."):
        result = apply_safe(watch_seconds=300)

    s = result["summary"]
    console.print(
        f"\n[bold]Results:[/bold] "
        f"[green]{s['applied']} applied[/green] · "
        f"[red]{s['rolled_back']} rolled back[/red] · "
        f"[dim]{s['skipped']} skipped[/dim]\n"
    )

    for a in result["applied"]:
        console.print(
            f"  [green]\u2713[/green] {a['deployment']} "
            f"[dim](${a.get('savings', 0):.2f}/mo saved)[/dim]"
        )
    for r in result["rolled_back"]:
        console.print(
            f"  [red]\u21ba[/red] {r['deployment']} "
            f"[dim]({r['reason']})[/dim]"
        )
    for sk in result["skipped"]:
        console.print(
            f"  [dim]\u2013 {sk['deployment']}: {sk['reason']}[/dim]"
        )


def _handle_rightsizing_gitops(cmd, env):
    from core.analytics.safe_apply import gitops_output

    fmt = cmd.get("format", "kustomize")

    with loading(f"Generating GitOps output ({fmt})..."):
        path = gitops_output(format=fmt)

    if not path:
        console.print("[dim]No recommendations to export[/dim]")
        return

    console.print(
        f"[green]\u2713 GitOps output ready:[/green] {path}\n"
    )
    console.print(f"  Format: [cyan]{fmt}[/cyan]")
    if fmt == "kustomize":
        console.print(
            f"  Apply:  [dim]kubectl apply -k {path}[/dim]"
        )
        console.print(
            f"  Verify: [dim]kubectl apply -k {path} "
            f"--dry-run=server[/dim]"
        )
    console.print(
        f"\n  [dim]Includes README.md for PR description[/dim]"
    )


def _handle_cost_query(cmd, env):
    from core.analytics.cost_model import (
        cost_by_deployment, monthly_cost_summary
    )

    with loading("Querying cost data..."):
        summary = monthly_cost_summary()
        deployments = cost_by_deployment()

    if not deployments:
        console.print(
            "[dim]No cost data yet. Analytics needs "
            "at least 1 day of collection.[/dim]"
        )
        return

    lines = [
        f"[bold]Monthly Estimate:[/bold] "
        f"${summary['monthly_usd']:.2f}/mo "
        f"[dim]({summary['days_tracked']}d tracked, "
        f"{summary['deployments']} deployments)[/dim]\n",
        "[bold]Cost by Deployment (7d):[/bold]\n",
    ]

    total_savings = 0
    for d in deployments[:12]:
        savings = d["savings_usd"]
        total_savings += savings
        waste = f" [yellow]({d['waste_pct']}% waste)[/yellow]" if d["waste_pct"] > 20 else ""
        lines.append(
            f"  ${d['cost_requested_usd']:>7.2f}  "
            f"{d['deployment'][:30]}"
            f"{waste}"
        )

    if total_savings > 0:
        lines.append(
            f"\n[green]  Total savings potential: "
            f"${total_savings:.2f}/week[/green]"
        )

    console.print(
        Panel(
            "\n".join(lines),
            title="[bold]\U0001f4b0 Cost Analytics[/bold]",
            border_style="green",
        )
    )


def _handle_chargeback(cmd, env):
    from core.analytics.chargeback import chargeback_report

    group_by = cmd.get("group_by", "team")

    with loading(f"Generating chargeback by {group_by}..."):
        report = chargeback_report(days=30, group_by=group_by)

    if isinstance(report, str):
        console.print(f"[green]\u2713 Exported:[/green] {report}")
        return

    if not report.get("items"):
        console.print(
            "[dim]No cost data. Need 24h+ of collection "
            "and labeled deployments.[/dim]"
        )
        return

    console.print(
        f"\n[bold]Chargeback by {group_by} "
        f"(30d):[/bold]  "
        f"Total: [green]${report['total_estimated_usd']:.2f}[/green]"
    )
    if report.get("cloud_actual_usd"):
        console.print(
            f"  Cloud actual: ${report['cloud_actual_usd']:.2f} "
            f"[dim](scale: {report['scale_factor']}x)[/dim]"
        )
    console.print()

    table = Table(
        show_header=True,
        header_style="bold cyan",
        border_style="dim",
        expand=True,
    )
    table.add_column(group_by.capitalize())
    table.add_column("Cost", justify="right")
    table.add_column("%", justify="right")
    table.add_column("Deployments", justify="right")
    table.add_column("CPU avg", justify="right")
    table.add_column("Mem avg", justify="right")

    for item in report["items"][:15]:
        name = item.get(
            group_by,
            item.get("team", item.get("app", "?"))
        )
        table.add_row(
            name,
            f"[green]${item['adjusted_cost_usd']:.2f}[/green]",
            f"{item['pct_of_total']}%",
            str(item.get("deployments", "—")),
            f"{item.get('cpu_avg_m', 0)}m",
            f"{item.get('mem_avg_mb', 0)}Mi",
        )

    console.print(table)


def _handle_analytics_collect(cmd, env):
    from core.analytics.collector import collect_now

    with loading("Collecting metrics..."):
        result = collect_now()

    console.print(
        f"[green]\u2713 Collected:[/green] "
        f"{result['pods']} pods, {result['nodes']} nodes "
        f"[dim]({result['duration_ms']}ms)[/dim]"
    )


def _handle_analytics_export(cmd, env):
    from core.analytics.export import export_csv, export_parquet

    query = cmd.get("query", "hourly")
    fmt = cmd.get("format", "csv")

    with loading(f"Exporting {query} as {fmt}..."):
        if fmt == "parquet":
            path = export_parquet(query)
        else:
            path = export_csv(query)

    if path:
        console.print(f"[green]\u2713 Exported:[/green] {path}")
    else:
        console.print(
            f"[red]Unknown query: {query}[/red]\n"
            "[dim]Available: raw_pods, raw_nodes, hourly, "
            "daily, rightsizing, cost[/dim]"
        )


def _handle_predictive_alerts(cmd, env):
    from core.analytics.predictive import check_predictive_alerts

    with loading("Running predictive analysis..."):
        predictions = check_predictive_alerts()

    if not predictions:
        console.print(
            "[green]\u2713 No resource exhaustion predicted "
            "in the next 24h[/green]\n"
            "[dim]Based on linear regression of "
            "12h usage trends[/dim]"
        )
        return

    lines = [
        f"[bold]{len(predictions)} prediction(s):[/bold]\n"
    ]

    for p in predictions:
        sev = p["severity"]
        icon = {
            "critical": "[red]\u25cf[/red]",
            "high": "[red]\u25cf[/red]",
            "medium": "[yellow]\u25cf[/yellow]",
        }.get(sev, "[dim]\u25cf[/dim]")

        lines.append(f"  {icon} [{sev}]{p['message']}[/{sev}]")
        if p.get("hours_remaining"):
            lines.append(
                f"    [dim]ETA: {p.get('time_to_event', '')} "
                f"(confidence: {p.get('confidence', 0)}%)[/dim]"
            )
        if p.get("recommendation"):
            lines.append(
                f"    [cyan]\u2192 {p['recommendation']}[/cyan]"
            )
        lines.append("")

    console.print(
        Panel(
            "\n".join(lines),
            title="[bold]\U0001f52e Predictive Alerts[/bold]",
            border_style="yellow",
        )
    )


def _handle_capacity_plan(cmd, env):
    from core.analytics.capacity import capacity_forecast, namespace_growth

    with loading("Forecasting capacity..."):
        forecast = capacity_forecast()
        ns_growth = namespace_growth()

    if not forecast or "error" in forecast:
        console.print(
            f"[dim]{forecast.get('error', 'No data') if forecast else 'DuckDB unavailable'}[/dim]"
        )
        return

    cluster = forecast["cluster"]
    usage = forecast["current_usage"]
    growth = forecast["growth_rate"]
    fc = forecast["forecast"]

    # Utilization bars
    cpu_bar = _cap_bar(usage["cpu_util_pct"])
    mem_bar = _cap_bar(usage["mem_util_pct"])

    lines = [
        f"[bold]Cluster ({cluster['nodes']} nodes):[/bold]\n",
        f"  CPU:  {cpu_bar}  {usage['cpu_used_m']}m / {cluster['total_cpu_m']}m",
        f"  Mem:  {mem_bar}  {usage['mem_used_mb']}Mi / {cluster['total_mem_mb']}Mi",
        "",
        f"[bold]Growth Rate ({forecast['data_points']}d data):[/bold]",
        f"  CPU: {'+' if growth['cpu_per_day_m'] > 0 else ''}{growth['cpu_per_day_m']}m/day ({growth['cpu_direction']})",
        f"  Mem: {'+' if growth['mem_per_day_mb'] > 0 else ''}{growth['mem_per_day_mb']}Mi/day ({growth['mem_direction']})",
        "",
        "[bold]Forecast (to 80% capacity):[/bold]",
    ]

    if fc["cpu_days_to_80pct"]:
        urgency = "[red]" if fc["cpu_days_to_80pct"] < 7 else "[yellow]" if fc["cpu_days_to_80pct"] < 14 else "[green]"
        lines.append(f"  CPU: {urgency}{fc['cpu_days_to_80pct']} days[/{urgency[1:]}")
    else:
        lines.append("  CPU: [green]No exhaustion predicted[/green]")

    if fc["mem_days_to_80pct"]:
        urgency = "[red]" if fc["mem_days_to_80pct"] < 7 else "[yellow]" if fc["mem_days_to_80pct"] < 14 else "[green]"
        lines.append(f"  Mem: {urgency}{fc['mem_days_to_80pct']} days[/{urgency[1:]}")
    else:
        lines.append("  Mem: [green]No exhaustion predicted[/green]")

    if fc["action_needed"]:
        lines.append(
            f"\n[bold red]\u26a0 Action needed:[/bold red] "
            f"Bottleneck is {fc['bottleneck']} — "
            f"add nodes or right-size workloads"
        )

    # Namespace growth
    if ns_growth:
        lines.append("\n[bold]Fastest Growing Namespaces:[/bold]")
        for ns in ns_growth[:5]:
            cpu_g = ns["cpu_growth_pct"] or 0
            icon = "[red]\u2191[/red]" if cpu_g > 30 else "[yellow]\u2191[/yellow]" if cpu_g > 10 else "[dim]\u2192[/dim]"
            lines.append(
                f"  {icon} {ns['namespace']}: "
                f"CPU {'+' if cpu_g > 0 else ''}{cpu_g}%  "
                f"Mem {'+' if (ns['mem_growth_pct'] or 0) > 0 else ''}{ns['mem_growth_pct'] or 0}%"
            )

    console.print(
        Panel(
            "\n".join(lines),
            title="[bold]\U0001f4c8 Capacity Forecast[/bold]",
            border_style="cyan",
        )
    )


def _handle_blast_radius(cmd, env):
    from core.analytics.blast_radius import analyze_blast_radius

    target = cmd["target"]
    action = cmd.get("action", "restart")

    with loading(f"Analyzing blast radius for {target}..."):
        result = analyze_blast_radius(target, action)

    if "error" in result:
        console.print(f"[red]{result['error']}[/red]")
        return

    risk = result["risk_score"]
    level = result["risk_level"]
    risk_color = {
        "critical": "red", "high": "red",
        "medium": "yellow", "low": "green",
    }.get(level, "dim")

    lines = [
        f"[bold]Target:[/bold] {target} ({result['pod_count']} pods)",
        f"[bold]Action:[/bold] {action}",
        f"[bold]Risk:[/bold]   [{risk_color}]{risk}/10 ({level})[/{risk_color}]",
        "",
    ]

    # Warnings
    for w in result.get("warnings", []):
        lines.append(f"  [yellow]{w}[/yellow]")
    if result["warnings"]:
        lines.append("")

    # Affected resources
    lines.append(
        f"[bold]Affected Resources ({result['affected_count']}):[/bold]"
    )
    for a in result["affected"]:
        sev_icon = {
            "critical": "[red]\u25cf[/red]",
            "high": "[red]\u25cf[/red]",
            "medium": "[yellow]\u25cf[/yellow]",
            "low": "[green]\u25cf[/green]",
            "info": "[dim]\u25cf[/dim]",
        }.get(a["severity"], "\u25cf")
        lines.append(
            f"  {sev_icon} [{a['severity']}]{a['type']}[/{a['severity']}] "
            f"{a['name']}  [dim]{a['impact']}[/dim]"
        )

    # Recommendation
    lines.append(
        f"\n[bold]Recommendation:[/bold] {result['recommendation']}"
    )

    border = risk_color
    console.print(
        Panel(
            "\n".join(lines),
            title=f"[bold]\U0001f4a5 Blast Radius: {target}[/bold]",
            border_style=border,
        )
    )


def _cap_bar(pct, width=20):
    pct = min(100, max(0, pct))
    filled = int(pct * width / 100)
    color = "red" if pct > 80 else "yellow" if pct > 60 else "green"
    return (
        f"[{color}]" + "\u2588" * filled + f"[/{color}]"
        + "[dim]" + "\u2591" * (width - filled) + "[/dim]"
        + f" [{color}]{pct}%[/{color}]"
    )


def _handle_change_correlation(cmd, env):
    from core.analytics.correlation import correlate_change

    target = cmd["target"]
    with loading(f"Correlating changes for {target}..."):
        result = correlate_change(target)

    if "error" in result:
        console.print(f"[red]{result['error']}[/red]")
        return

    changes = result["all_changes"]
    cause = result["probable_cause"]

    lines = [
        f"[bold]Target:[/bold] {target}",
        f"[bold]Failure:[/bold] {result['failure_time'][:19]}",
        f"[bold]Window:[/bold] {result['window_minutes']} min lookback",
        f"[bold]Changes:[/bold] {result['changes_found']} found",
        "",
    ]

    if cause:
        lines.append(
            f"[bold green]\u2192 Probable Cause:[/bold green] "
            f"{cause['type'].replace('_', ' ')} on "
            f"[cyan]{cause['resource']}[/cyan] "
            f"(score: {cause['score']}%)"
        )
        lines.append(f"  [dim]{cause['detail']}[/dim]")
        lines.append("")

    if changes:
        lines.append("[bold]Timeline:[/bold]")
        for c in changes:
            score_color = (
                "red" if c['score'] > 70
                else "yellow" if c['score'] > 40
                else "dim"
            )
            time_str = c['time'][:19] if c.get('time') else '?'
            lines.append(
                f"  [{score_color}]{c['score']:>3}%[/{score_color}] "
                f"[dim]{time_str}[/dim]  "
                f"{c['type'].replace('_', ' ')}  "
                f"[cyan]{c['resource']}[/cyan]"
            )
            lines.append(f"       [dim]{c['detail'][:70]}[/dim]")
    else:
        lines.append(
            "[dim]No changes found in the time window. "
            "Try: why-broken {target} with a longer window.[/dim]"
        )

    lines.append(f"\n[dim]{result['summary']}[/dim]")

    console.print(
        Panel(
            "\n".join(lines),
            title=f"[bold]\U0001f50d Change Correlation: {target}[/bold]",
            border_style="cyan",
        )
    )


def _handle_analytics_sql(cmd, env):
    from core.analytics.export import run_custom_query

    sql = cmd["query"]
    with loading("Running query..."):
        result = run_custom_query(sql)

    if "error" in result:
        console.print(f"[red]{result['error']}[/red]")
        return

    if not result["rows"]:
        console.print("[dim]No results[/dim]")
        return

    table = Table(
        show_header=True,
        header_style="bold cyan",
        border_style="dim",
        expand=True,
    )
    for col in result["columns"]:
        table.add_column(col)

    for row in result["rows"][:50]:
        table.add_row(*[str(v) for v in row.values()])

    console.print(table)
    console.print(f"[dim]{result['count']} rows[/dim]")


def _handle_pf_list(cmd, env):
    from core.port_forward import list_forwards
    forwards = list_forwards()
    if not forwards:
        console.print(
            "[dim]No active port-forwards.\n"
            "  Start: pf <pod/svc> <port>\n"
            "  Example: pf payment-api 8080[/dim]"
        )
        return

    lines = [f"[bold]{len(forwards)} active forward(s):[/bold]\n"]
    for f in forwards:
        icon = "[green]\u25cf[/green]" if f["alive"] else "[red]\u25cf[/red]"
        lines.append(
            f"  {icon} localhost:{f['local_port']} \u2192 "
            f"{f['target']}:{f['remote_port']}  "
            f"[dim]pid:{f['pid']} since {f['started'][:16]}[/dim]"
        )

    console.print(
        Panel(
            "\n".join(lines),
            title="[bold]\U0001f517 Port Forwards[/bold]",
            border_style="cyan",
        )
    )
    console.print("[dim]  Stop: pf stop <target> | pf stop-all[/dim]")


def _handle_pf_start(cmd, env):
    from core.port_forward import start_forward

    target = cmd["target"]
    port = cmd["port"]

    # Parse port spec (local:remote or just port)
    if ":" in port:
        local, remote = port.split(":", 1)
    else:
        local = remote = port

    result = start_forward(target, int(local), int(remote))
    if result["success"]:
        console.print(
            f"[green]\u2713 {result['message']}[/green]\n"
            f"  [dim]URL: http://localhost:{result['local_port']}  "
            f"pid:{result['pid']}[/dim]"
        )
    else:
        console.print(f"[red]\u2717 {result['message']}[/red]")


def _handle_pf_stop(cmd, env):
    from core.port_forward import stop_forward
    result = stop_forward(target=cmd["target"])
    if result["success"]:
        console.print(f"[green]\u2713 {result['message']}[/green]")
    else:
        console.print(f"[red]{result['message']}[/red]")


def _handle_pf_stop_all(cmd, env):
    from core.port_forward import stop_all
    result = stop_all()
    console.print(
        f"[green]\u2713 Stopped {result['stopped']} forward(s)[/green]"
    )


def _handle_helm_list(cmd, env):
    from core.collectors.helm import helm_list
    with loading("Fetching Helm releases..."):
        data = helm_list()
    if "error" in data:
        console.print(f"[red]{data['error']}[/red]")
        return
    releases = data["releases"]
    if not releases:
        console.print("[dim]No Helm releases found[/dim]")
        return
    table = Table(show_header=True, header_style="bold cyan", border_style="dim", expand=True)
    table.add_column("Release", style="bold")
    table.add_column("Chart")
    table.add_column("Version")
    table.add_column("Status")
    table.add_column("Rev", width=4)
    table.add_column("Updated", style="dim")
    for rel in releases:
        status = rel["status"]
        s_color = "green" if status == "deployed" else "yellow" if status == "pending" else "red"
        table.add_row(
            rel["name"], rel["chart"], rel["app_version"],
            f"[{s_color}]{status}[/{s_color}]",
            rel["revision"], rel["updated"][:16],
        )
    console.print(Panel(table, title=f"[bold]\u2388 Helm Releases ({len(releases)})[/bold]", border_style="cyan"))


def _handle_helm_status(cmd, env):
    from core.collectors.helm import helm_status
    release = cmd["release"]
    with loading(f"Fetching {release}..."):
        data = helm_status(release)
    if "error" in data:
        console.print(f"[red]{data['error']}[/red]")
        return
    lines = [
        f"[bold cyan]Release:[/bold cyan]  {data['name']}",
        f"[bold cyan]Status:[/bold cyan]   {data['status']}",
        f"[bold cyan]Revision:[/bold cyan] {data['version']}",
        f"[bold cyan]Deployed:[/bold cyan] {data['last_deployed'][:19]}",
    ]
    if data.get("description"):
        lines.append(f"[bold cyan]Desc:[/bold cyan]     {data['description']}")
    console.print(Panel("\n".join(lines), title=f"[bold]\u2388 {release}[/bold]", border_style="cyan"))


def _handle_helm_history(cmd, env):
    from core.collectors.helm import helm_history
    release = cmd["release"]
    with loading(f"Fetching history for {release}..."):
        data = helm_history(release)
    if "error" in data:
        console.print(f"[red]{data['error']}[/red]")
        return
    revisions = data["revisions"]
    if not revisions:
        console.print("[dim]No history[/dim]")
        return
    table = Table(show_header=True, header_style="bold cyan", border_style="dim", expand=True)
    table.add_column("Rev", width=4)
    table.add_column("Status")
    table.add_column("Chart")
    table.add_column("Description")
    table.add_column("Updated", style="dim")
    for rev in reversed(revisions):
        table.add_row(
            str(rev["revision"]), rev["status"],
            rev["chart"], rev["description"][:40],
            rev["updated"][:16],
        )
    console.print(Panel(table, title=f"[bold]\u2388 History: {release}[/bold]", border_style="cyan"))


def _handle_helm_values(cmd, env):
    from core.collectors.helm import helm_values
    import yaml
    release = cmd["release"]
    with loading(f"Fetching values for {release}..."):
        data = helm_values(release)
    if "error" in data:
        console.print(f"[red]{data['error']}[/red]")
        return
    values = data.get("values", {})
    if not values:
        console.print("[dim]No custom values (using chart defaults)[/dim]")
        return
    yaml_str = yaml.dump(values, default_flow_style=False)
    console.print(Panel(yaml_str, title=f"[bold]\u2388 Values: {release}[/bold]", border_style="cyan"))


def _handle_helm_rollback(cmd, env):
    from core.collectors.helm import helm_rollback
    from core.safety import confirm_production
    release = cmd["release"]
    revision = cmd.get("revision")
    if not confirm_production({"environment": env}):
        console.print("[yellow]Cancelled[/yellow]")
        return
    with loading(f"Rolling back {release}..."):
        result = helm_rollback(release, revision)
    if result["success"]:
        log_action("helm_rollback", release)
        console.print(f"[green]\u2713 {result['message']}[/green]")
    else:
        console.print(f"[red]{result['message']}[/red]")


def _handle_helm_diff(cmd, env):
    from core.collectors.helm import helm_diff
    release = cmd["release"]
    with loading(f"Diffing {release}..."):
        data = helm_diff(release)
    if "error" in data:
        console.print(f"[red]{data['error']}[/red]")
        return
    changes = data.get("changes", [])
    if not changes:
        console.print(f"[dim]{data.get('message', 'No changes')}[/dim]")
        return
    lines = [
        f"[bold]Rev {data['previous_revision']} \u2192 {data['current_revision']}[/bold]  "
        f"({len(changes)} changes)\n"
    ]
    for c in changes:
        if c["type"] == "added":
            lines.append(f"  [green]+ {c['path']}[/green] = {c['new']}")
        elif c["type"] == "removed":
            lines.append(f"  [red]- {c['path']}[/red] = {c['old']}")
        else:
            lines.append(f"  [yellow]~ {c['path']}[/yellow]: {c['old']} \u2192 {c['new']}")
    console.print(Panel("\n".join(lines), title=f"[bold]\u2388 Helm Diff: {release}[/bold]", border_style="cyan"))


def _handle_taints_list(cmd, env):
    from core.collectors.taints import collect_taints
    from core.renderers.taints_renderer import render_taints

    with loading("Fetching node taints..."):
        nodes = collect_taints()
    render_taints(nodes)


def _handle_taint(cmd, env):
    from core.collectors.taints import apply_taint

    node = cmd["node"]
    spec = cmd["spec"]

    if not confirm_production({"environment": env}):
        console.print("[yellow]Cancelled[/yellow]")
        return

    success, output = apply_taint(node, spec)
    if success:
        log_action("taint", node, spec)
        console.print(
            f"[green]\u2713 Tainted {node} with {spec}[/green]"
        )
    else:
        console.print(f"[red]{output}[/red]")


def _handle_untaint(cmd, env):
    from core.collectors.taints import remove_taint

    node = cmd["node"]
    spec = cmd["spec"]

    if not confirm_production({"environment": env}):
        console.print("[yellow]Cancelled[/yellow]")
        return

    success, output = remove_taint(node, spec)
    if success:
        log_action("untaint", node, spec)
        console.print(
            f"[green]\u2713 Removed taint {spec} from {node}[/green]"
        )
    else:
        console.print(f"[red]{output}[/red]")


def _handle_cordon(cmd, env):
    node = cmd["node"]
    if not confirm_production({"environment": env, "name": f"cordon {node}"}):
        console.print("[yellow]Cancelled[/yellow]")
        return
    with loading(f"Cordoning {node}..."):
        result = cordon_node(node)
    render_cordon(result)
    if result["success"]:
        log_action("cordon", node)


def _handle_uncordon(cmd, env):
    node = cmd["node"]
    with loading(f"Uncordoning {node}..."):
        result = uncordon_node(node)
    render_uncordon(result)
    if result["success"]:
        log_action("uncordon", node)


def _handle_drain(cmd, env):
    node = cmd["node"]
    if not confirm_production({"environment": env, "name": f"drain {node}", "risk": "HIGH"}):
        console.print("[yellow]Cancelled[/yellow]")
        return
    with loading(f"Draining {node}..."):
        result = drain_node(
            node,
            force=cmd.get("force", False),
            delete_emptydir=cmd.get("delete_emptydir", False),
        )
    render_drain(result)
    if result["success"]:
        log_action("drain", node)


def _handle_wait(cmd, env):
    resource = cmd["resource"]
    name = cmd["name"]
    condition = cmd.get("condition", "condition=Available")
    timeout = cmd.get("timeout", 120)
    with loading(f"Waiting for {resource}/{name} ({condition})..."):
        result = wait_for(resource, name, condition, timeout)
    render_wait(result)


def _handle_patch(cmd, env):
    resource = cmd["resource"]
    name = cmd["name"]
    patch_data = cmd.get("patch_data")
    if not patch_data:
        console.print("[red]Missing patch data (-p flag)[/red]")
        return
    import json as _json
    try:
        parsed = _json.loads(patch_data)
    except (ValueError, _json.JSONDecodeError):
        console.print("[red]Invalid JSON patch data[/red]")
        return
    if not confirm_production({"environment": env, "name": f"patch {resource}/{name}"}):
        console.print("[yellow]Cancelled[/yellow]")
        return
    result = patch_resource(resource, name, parsed, cmd.get("patch_type", "strategic"))
    render_patch(result)
    if result["success"]:
        log_action("patch", f"{resource}/{name}")


def _handle_annotate(cmd, env):
    resource = cmd["resource"]
    name = cmd["name"]
    annotations = cmd.get("annotations", {})
    if not annotations:
        console.print("[red]No annotations specified[/red]")
        return
    result = annotate_resource(resource, name, annotations, cmd.get("remove", False))
    render_annotate(result)
    if result["success"]:
        action = "annotate-remove" if cmd.get("remove") else "annotate"
        log_action(action, f"{resource}/{name}")


def _handle_set_image(cmd, env):
    deployment = cmd["deployment"]
    image = cmd["image"]
    container = cmd.get("container") or deployment
    if not confirm_production({"environment": env, "name": f"set-image {deployment}"}):
        console.print("[yellow]Cancelled[/yellow]")
        return
    with loading(f"Updating image for {deployment}..."):
        result = set_image(deployment, container, image)
    render_set_image(result)
    if result["success"]:
        log_action("set-image", deployment, image)
        invalidate_deployments()


def _handle_api_resources(cmd, env):
    with loading("Fetching API resources..."):
        resources = list_api_resources()
    render_api_resources(resources)


# Handler registry
HANDLERS = {
    "noop": lambda cmd, env: None,
    "pods_table": _handle_pods_table,
    "pods_watch": _handle_pods_watch,
    "overview": _handle_overview,
    "inspect": _handle_inspect,
    "events": _handle_events,
    "events_watch": _handle_events_watch,
    "logs": _handle_logs,
    "logcat": _handle_logcat,
    "rollout": _handle_rollout,
    "rollback": _handle_rollback,
    "restart": _handle_restart,
    "scale": _handle_scale,
    "top_pods": _handle_top_pods,
    "top_nodes": _handle_top_nodes,
    "diagnose": _handle_diagnose,
    "trace": _handle_trace,
    "tui": _handle_tui,
    "ai": _handle_ai,
    "plugin": _handle_plugin,
    "plugins_list": _handle_plugins_list,
    "compare": _handle_compare,
    "incident_start": _handle_incident_start,
    "incident_stop": _handle_incident_stop,
    "incident_status": _handle_incident_status,
    "incident_note": _handle_incident_note,
    "incident_snapshot": _handle_incident_snapshot,
    "incident_history": _handle_incident_history,
    "incident_share": _handle_incident_share,
    "help": _handle_help,
    "find": _handle_find,
    "ns_overview": _handle_ns_overview,
    "alerts": _handle_alerts,
    "playbook": _handle_playbook,
    "correlate": _handle_correlate,
    "optimize": _handle_optimize,
    "security": _handle_security,
    "unused": _handle_unused,
    "idle_resources": _handle_idle_resources,
    "cleanup_apply": _handle_cleanup_apply,
    "check": _handle_check,
    "export": _handle_export,
    "audit": _handle_audit,
    "netcheck": _handle_netcheck,
    "cronjobs": _handle_cronjobs,
    "jobs": _handle_jobs,
    "trigger": _handle_trigger,
    "configmap": _handle_configmap,
    "secret": _handle_secret,
    "diff": _handle_diff,
    "forward": _handle_forward,
    "explain": _handle_explain,
    "generate": _handle_generate,
    "hpa": _handle_hpa,
    "pdb": _handle_pdb,
    "capacity": _handle_capacity,
    "quota": _handle_quota,
    "drain_check": _handle_drain_check,
    "bookmark_add": _handle_bookmark_add,
    "bookmark_rm": _handle_bookmark_rm,
    "bookmarks_list": _handle_bookmarks_list,
    "run_bookmark": _handle_run_bookmark,
    "workflows_list": _handle_workflows_list,
    "workflow_run": _handle_workflow_run,
    "watch_cmd": _handle_watch_cmd,
    "rbac": _handle_rbac,
    "shell": _handle_shell,
    "timeline": _handle_timeline,
    "labels": _handle_labels,
    "apply": _handle_apply,
    "snap": _handle_snap,
    "snap_diff": _handle_snap_diff,
    "changelog": _handle_changelog,
    "resource_history": _handle_resource_history,
    "mesh": _handle_mesh,
    "ingress": _handle_ingress,
    "deps": _handle_deps,
    "dns": _handle_dns,
    "kubectl_pretty": _handle_kubectl_pretty,
    "uptime": _handle_uptime,
    "correlate_logs": _handle_correlate_logs,
    "diff_timeline": _handle_diff_timeline,
    "dep_health": _handle_dep_health,
    "rollback_preview": _handle_rollback_preview,
    "watch_alert": _handle_watch_alert,
    "watch_status": _handle_watch_status,
    "scorecard": _handle_scorecard,
    "cost_estimate": _handle_cost_estimate,
    "remediate": _handle_remediate,
    "yaml_diff": _handle_yaml_diff,
    "save_query": _handle_save_query,
    "list_queries": _handle_list_queries,
    "doctor": _handle_doctor,
    "stats": _handle_stats,
    "schedule_list": _handle_schedule_list,
    "schedule_add": _handle_schedule_add,
    "schedule_rm": _handle_schedule_rm,
    "cost_trend": _handle_cost_trend,
    "policy_check": _handle_policy_check,
    "plugin_install": _handle_plugin_install,
    "plugin_uninstall": _handle_plugin_uninstall,
    "gitops": _handle_gitops,
    "gitops_detail": _handle_gitops_detail,
    "mesh_detail": _handle_mesh_detail,
    "virtual_services": _handle_virtual_services,
    "destination_rules": _handle_destination_rules,
    "mtls": _handle_mtls,
    "connect_list": _handle_connect_list,
    "connect": _handle_connect,
    "disconnect": _handle_disconnect,
    "connect_discover": _handle_connect_discover,
    "profile_list": _handle_profile_list,
    "profile_use": _handle_profile_use,
    "profile_reset": _handle_profile_reset,
    "guided": _handle_guided,
    "env_info": _handle_env_info,
    "analytics_stats": _handle_analytics_stats,
    "rightsizing": _handle_rightsizing,
    "rightsizing_dryrun": _handle_rightsizing_dryrun,
    "rightsizing_diff": _handle_rightsizing_diff,
    "rightsizing_apply": _handle_rightsizing_apply,
    "rightsizing_gitops": _handle_rightsizing_gitops,
    "cost_query": _handle_cost_query,
    "chargeback": _handle_chargeback,
    "analytics_collect": _handle_analytics_collect,
    "analytics_export": _handle_analytics_export,
    "analytics_sql": _handle_analytics_sql,
    "predictive_alerts": _handle_predictive_alerts,
    "capacity_plan": _handle_capacity_plan,
    "blast_radius": _handle_blast_radius,
    "change_correlation": _handle_change_correlation,
    "pf_list": _handle_pf_list,
    "pf_start": _handle_pf_start,
    "pf_stop": _handle_pf_stop,
    "pf_stop_all": _handle_pf_stop_all,
    "helm_list": _handle_helm_list,
    "helm_status": _handle_helm_status,
    "helm_history": _handle_helm_history,
    "helm_values": _handle_helm_values,
    "helm_rollback": _handle_helm_rollback,
    "helm_diff": _handle_helm_diff,
    "taints_list": _handle_taints_list,
    "taint": _handle_taint,
    "untaint": _handle_untaint,
    "cordon": _handle_cordon,
    "uncordon": _handle_uncordon,
    "drain": _handle_drain,
    "wait": _handle_wait,
    "patch": _handle_patch,
    "annotate": _handle_annotate,
    "set_image": _handle_set_image,
    "api_resources": _handle_api_resources,
}
