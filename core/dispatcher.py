"""
Command Dispatcher — maps command types to handler functions.
Keeps main.py clean and makes handlers testable.
"""

import time
import subprocess

from rich.console import Console
from rich.panel import Panel
from rich.live import Live

from config.settings import SETTINGS
from core.context import context
from core.executor import execute
from core.spinner import loading
from core.audit import log_action
from core.safety import confirm_production

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
        else:
            console.print(
                f"[red]Unhandled command type: "
                f"{cmd_type}[/red]"
            )
    except KeyboardInterrupt:
        console.print("[dim]Interrupted[/dim]")
    except Exception as e:
        console.print(f"[red]Error: {e}[/red]")


def _handle_pods_table(cmd, env):
    pods = get_pods()
    render_pods_table(pods)


def _handle_pods_watch(cmd, env):
    with Live(
        build_watch_view(get_pods(), context.namespace),
        refresh_per_second=2,
        console=console
    ) as live:
        while True:
            time.sleep(SETTINGS["refresh_interval"])
            live.update(
                build_watch_view(
                    get_pods(), context.namespace
                )
            )


def _handle_overview(cmd, env):
    with loading("Fetching cluster overview..."):
        pods = collect_pods()
        nodes = collect_nodes()
        deployments = collect_deployments()
        alerts = detect_anomalies()
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
    with Live(
        build_events_watch_view(
            collect_events(), context.namespace
        ),
        refresh_per_second=2,
        console=console
    ) as live:
        while True:
            time.sleep(SETTINGS["refresh_interval"])
            live.update(
                build_events_watch_view(
                    collect_events(), context.namespace
                )
            )


def _handle_logs(cmd, env):
    target = cmd["target"]
    if cmd["follow"]:
        console.print(
            f"[dim]Streaming {target}... Ctrl+C to stop[/dim]"
        )
        process = stream_logs(target)
        for line in process.stdout:
            render_streaming_line(line.rstrip())
    else:
        lines = fetch_logs(
            target,
            previous=cmd["previous"],
            errors_only=cmd["errors"]
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
    target = cmd["target"]
    console.print(
        f"[dim]→ kubectl rollout undo "
        f"deployment/{target} -n {context.namespace}[/dim]"
    )
    if confirm_production({"environment": env}):
        success, output = rollout_rollback(target)
        if success:
            log_action("rollback", target)
            console.print(f"[green]✓ Rolled back {target}[/green]")
        else:
            console.print("[red]Rollback failed[/red]")
    else:
        console.print("[yellow]Cancelled[/yellow]")


def _handle_restart(cmd, env):
    target = cmd["target"]
    success, output = rollout_restart(target)
    if success:
        log_action("restart", target)
        console.print(f"[green]✓ Restarted {target}[/green]")
    else:
        console.print("[red]Restart failed[/red]")


def _handle_scale(cmd, env):
    target = cmd["target"]
    replicas = cmd["replicas"]
    scale_cmd = (
        f"kubectl --context {context.current_context} "
        f"scale deployment/{target} "
        f"--replicas={replicas} -n {context.namespace}"
    )
    result = subprocess.run(
        scale_cmd, shell=True,
        capture_output=True, text=True
    )
    if result.returncode == 0:
        log_action("scale", target, f"replicas={replicas}")
        console.print(
            f"[green]✓ Scaled {target} to {replicas} replicas[/green]"
        )
    else:
        console.print(f"[red]{result.stderr}[/red]")


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


def _handle_check(cmd, env):
    with loading("Running health checks..."):
        result = run_health_check()
    render_health_check(result)


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
    fwd_cmd = (
        f"kubectl --context {context.current_context} "
        f"port-forward {target} {port} -n {context.namespace}"
    )
    console.print(
        f"[green]✓ Forwarding {target}:{port}[/green]\n"
        f"[dim]Press Ctrl+C to stop[/dim]"
    )
    subprocess.run(fwd_cmd, shell=True)


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
    with Live(console=console, refresh_per_second=1) as live:
        while True:
            resolved = resolve_command(watch_input)
            if resolved and isinstance(resolved, str):
                result = subprocess.run(
                    resolved, shell=True,
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
    shell_cmd = (
        f"kubectl --context {context.current_context} "
        f"exec -it {target} -n {context.namespace} -- "
        f"/bin/sh -c 'command -v bash && exec bash || exec sh'"
    )
    console.print(
        f"[green]✓ Shell into {target}[/green]\n"
        f"[dim]Type 'exit' to return[/dim]"
    )
    subprocess.run(shell_cmd, shell=True)


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
    apply_cmd = (
        f"kubectl --context {context.current_context} "
        f"apply -f {file_path} -n {context.namespace}"
    )
    console.print(f"[dim]→ {apply_cmd}[/dim]")
    result = subprocess.run(
        apply_cmd, shell=True,
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

    kubectl_cmd = cmd["cmd"]
    console.print(f"[dim]→ {kubectl_cmd}[/dim]")

    result = subprocess.run(
        kubectl_cmd,
        shell=True,
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


# Handler registry
HANDLERS = {
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
    "help": _handle_help,
    "find": _handle_find,
    "ns_overview": _handle_ns_overview,
    "alerts": _handle_alerts,
    "playbook": _handle_playbook,
    "correlate": _handle_correlate,
    "optimize": _handle_optimize,
    "security": _handle_security,
    "unused": _handle_unused,
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
}
