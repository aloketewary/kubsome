"""
Inspect Renderer — deep pod inspection with visual resource bars,
probe status, container health, and event timeline.
"""

from rich.console import Console
from rich.panel import Panel
from rich.table import Table
from rich.columns import Columns
from rich.text import Text

console = Console()


def render_inspect(details, events, logs, recommendation):
    # ─── Header: Pod identity + status ───
    phase = details["phase"]
    phase_display = _styled_phase(phase)

    header = (
        f"[bold]{details['name']}[/bold]\n"
        f"[dim]namespace:[/dim] {details['namespace']}  "
        f"[dim]node:[/dim] {details['node']}  "
        f"[dim]age:[/dim] {details['age']}\n"
        f"[dim]pod-ip:[/dim] {details['pod_ip']}  "
        f"[dim]host-ip:[/dim] {details['host_ip']}  "
        f"[dim]phase:[/dim] {phase_display}\n"
        f"[dim]restart-policy:[/dim] {details['restart_policy']}  "
        f"[dim]service-account:[/dim] {details['service_account']}"
    )

    border = (
        "green" if phase == "Running"
        else "yellow" if phase == "Pending"
        else "red"
    )

    console.print(
        Panel(
            header,
            title="[bold]🔍 Pod Inspect[/bold]",
            border_style=border,
        )
    )

    # ─── Containers ───
    ct = Table(
        show_header=True,
        header_style="bold cyan",
        border_style="dim",
        expand=True,
        show_lines=False,
    )
    ct.add_column("", width=2)
    ct.add_column("Container")
    ct.add_column("Image", no_wrap=True, max_width=50)
    ct.add_column("State", justify="center")
    ct.add_column("Ready", justify="center", width=5)
    ct.add_column("Restarts", justify="right")
    ct.add_column("Ports")
    ct.add_column("CPU", justify="right")
    ct.add_column("MEM", justify="right")

    for c in details["containers"]:
        state_style = "green" if c["state"] == "running" else "red"
        ready_icon = (
            "[green]✓[/green]" if c["ready"]
            else "[red]✗[/red]"
        )
        restart_display = _colored_restarts(c["restarts"])

        # Resources
        requests = c["resources"].get("requests", {})
        limits = c["resources"].get("limits", {})
        cpu = requests.get("cpu", limits.get("cpu", ""))
        mem = requests.get("memory", limits.get("memory", ""))

        icon = (
            "[green]●[/green]" if c["state"] == "running"
            else "[red]●[/red]"
        )

        ct.add_row(
            icon,
            f"[bold]{c['name']}[/bold]",
            f"[dim]{c['image']}[/dim]",
            f"[{state_style}]{c['state']}[/{state_style}]",
            ready_icon,
            restart_display,
            ", ".join(c["ports"]) if c["ports"] else "[dim]-[/dim]",
            f"[dim]{cpu}[/dim]" if cpu else "[dim]-[/dim]",
            f"[dim]{mem}[/dim]" if mem else "[dim]-[/dim]",
        )

    console.print(
        Panel(ct, title="[bold]📦 Containers[/bold]", border_style="blue")
    )

    # ─── Probes ───
    has_probes = any(
        c.get("liveness") or c.get("readiness") or c.get("startup")
        for c in details["containers"]
    )

    if has_probes:
        pt = Table(
            show_header=True,
            header_style="bold cyan",
            border_style="dim",
            expand=True,
            show_lines=False,
        )
        pt.add_column("Container")
        pt.add_column("Liveness", justify="center")
        pt.add_column("Readiness", justify="center")
        pt.add_column("Startup", justify="center")

        for c in details["containers"]:
            pt.add_row(
                c["name"],
                _probe_icon(c.get("liveness")),
                _probe_icon(c.get("readiness")),
                _probe_icon(c.get("startup")),
            )

        console.print(
            Panel(pt, title="[bold]🩺 Probes[/bold]", border_style="magenta")
        )
    else:
        console.print(
            "[dim]  ⚠ No probes configured[/dim]"
        )

    # ─── Resources ───
    res_table = Table(
        show_header=True,
        header_style="bold cyan",
        border_style="dim",
        expand=True,
        show_lines=False,
    )
    res_table.add_column("Container")
    res_table.add_column("CPU Request")
    res_table.add_column("CPU Limit")
    res_table.add_column("MEM Request")
    res_table.add_column("MEM Limit")

    has_resources = False
    for c in details["containers"]:
        requests = c["resources"].get("requests", {})
        limits = c["resources"].get("limits", {})

        cpu_req = requests.get("cpu", "")
        cpu_lim = limits.get("cpu", "")
        mem_req = requests.get("memory", "")
        mem_lim = limits.get("memory", "")

        if cpu_req or cpu_lim or mem_req or mem_lim:
            has_resources = True

        res_table.add_row(
            c["name"],
            cpu_req or "[dim]-[/dim]",
            cpu_lim or "[yellow]unbounded[/yellow]",
            mem_req or "[dim]-[/dim]",
            mem_lim or "[yellow]unbounded[/yellow]",
        )

    if has_resources:
        console.print(
            Panel(
                res_table,
                title="[bold]📊 Resources[/bold]",
                border_style="green"
            )
        )
    else:
        console.print(
            "[dim]  ⚠ No resource requests/limits set[/dim]"
        )

    # ─── Volumes ───
    if details.get("volumes"):
        vol_lines = []
        for v in details["volumes"]:
            vol_lines.append(f"  [dim]•[/dim] {v}")
        console.print(
            Panel(
                "\n".join(vol_lines),
                title="[bold]💾 Volumes[/bold]",
                border_style="dim",
            )
        )

    # ─── Events (last 10) ───
    if events:
        ev_table = Table(
            show_header=True,
            header_style="bold cyan",
            border_style="dim",
            expand=True,
            show_lines=False,
        )
        ev_table.add_column("", width=2)
        ev_table.add_column("Reason", width=20)
        ev_table.add_column("Message", ratio=1)
        ev_table.add_column("×", justify="right", width=4)

        for ev in events[-10:]:
            is_warn = ev["type"] == "Warning"
            icon = "[yellow]●[/yellow]" if is_warn else "[dim]○[/dim]"

            reason = ev.get("reason", "")
            reason_style = (
                "red" if reason in (
                    "BackOff", "Failed", "OOMKilling", "Unhealthy"
                ) else "yellow" if is_warn else ""
            )
            reason_display = (
                f"[{reason_style}]{reason}[/{reason_style}]"
                if reason_style else reason
            )

            count = ev.get("count", 1)
            count_display = (
                f"[red]×{count}[/red]" if count >= 10
                else f"[dim]×{count}[/dim]" if count > 1
                else ""
            )

            ev_table.add_row(
                icon,
                reason_display,
                ev.get("message", "")[:80],
                count_display,
            )

        console.print(
            Panel(
                ev_table,
                title="[bold]⚡ Events[/bold]",
                border_style="yellow",
            )
        )

    # ─── Recent Logs (last 15 lines) ───
    if logs:
        log_lines = logs.strip().split("\n")[-15:]
        colored = "\n".join(_color_log_line(l) for l in log_lines)
        console.print(
            Panel(
                colored,
                title=f"[bold]📜 Logs[/bold] [dim](last {len(log_lines)})[/dim]",
                border_style="dim",
            )
        )

    # ─── Recommendation ───
    if recommendation and recommendation != "Healthy":
        console.print(
            Panel(
                f"[bold yellow]💡 {recommendation}[/bold yellow]",
                title="[bold]🧠 Recommendation[/bold]",
                border_style="yellow",
            )
        )
    elif not events or all(e["type"] == "Normal" for e in events):
        console.print(
            "[green]  ✓ Pod appears healthy — no issues detected[/green]"
        )


def _styled_phase(phase):
    styles = {
        "Running": "[green]Running[/green]",
        "Pending": "[yellow]Pending[/yellow]",
        "Failed": "[red]Failed[/red]",
        "Succeeded": "[dim]Succeeded[/dim]",
        "CrashLoopBackOff": "[bold red]CrashLoopBackOff[/bold red]",
    }
    return styles.get(phase, phase)


def _probe_icon(probe):
    if not probe:
        return "[dim]—[/dim]"
    return f"[green]✓[/green] [dim]{probe}[/dim]"


def _colored_restarts(count):
    if count == 0:
        return "[dim]0[/dim]"
    if count >= 20:
        return f"[bold red]{count}[/bold red]"
    if count >= 5:
        return f"[yellow]{count}[/yellow]"
    return str(count)


def _color_log_line(line):
    lower = line.lower()
    if "error" in lower or "fatal" in lower or "panic" in lower:
        return f"[red]{line}[/red]"
    if "warn" in lower:
        return f"[yellow]{line}[/yellow]"
    if "info" in lower:
        return f"[dim]{line}[/dim]"
    return line
