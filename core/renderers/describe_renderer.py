"""
Describe renderer — pretty-prints kubectl describe output
into structured Rich panels.
"""

from rich.console import Console
from rich.panel import Panel
from rich.table import Table

console = Console()

from core.theme import t


def render_describe(output, resource_type=""):
    """Parse and render kubectl describe output."""
    if not output:
        console.print("[dim]No output[/dim]")
        return

    sections = _parse_sections(output)

    if resource_type in ("deployment", "deployments", "deploy"):
        _render_deployment_describe(sections, output)
    elif resource_type in ("service", "services", "svc"):
        _render_service_describe(sections, output)
    elif resource_type in ("node", "nodes", "no"):
        _render_node_describe(sections, output)
    else:
        _render_generic_describe(sections, output)


def _parse_sections(output):
    """Parse describe output into key-value dict."""
    data = {}
    current_key = None
    for line in output.split("\n"):
        if not line.strip():
            continue
        if not line.startswith(" ") and ":" in line:
            key, _, val = line.partition(":")
            key = key.strip()
            val = val.strip()
            data[key] = val
            current_key = key
        elif current_key and line.startswith(" "):
            # Continuation of previous key
            existing = data.get(current_key, "")
            data[current_key] = (
                existing + "\n" + line.rstrip()
                if existing else line.rstrip()
            )
    return data


def _render_deployment_describe(sections, raw):
    """Render deployment describe with structured panels."""
    name = sections.get("Name", "?")
    ns = sections.get("Namespace", "?")
    replicas = sections.get("Replicas", "?")
    strategy = sections.get("StrategyType", "?")
    rolling = sections.get(
        "RollingUpdateStrategy", ""
    )
    selector = sections.get("Selector", "")
    created = sections.get("CreationTimestamp", "")

    # Info panel
    info = (
        f"[bold cyan]Name:[/bold cyan]        {name}\n"
        f"[bold cyan]Namespace:[/bold cyan]   {ns}\n"
        f"[bold cyan]Replicas:[/bold cyan]    {replicas}\n"
        f"[bold cyan]Strategy:[/bold cyan]    "
        f"{strategy} ({rolling})\n"
        f"[bold cyan]Selector:[/bold cyan]    {selector}\n"
        f"[bold cyan]Created:[/bold cyan]     {created}"
    )
    console.print(Panel(
        info,
        title="[bold]📦 Deployment[/bold]",
        border_style=t()["primary"],
    ))

    # Labels & Annotations
    labels = sections.get("Labels", "")
    annotations = sections.get("Annotations", "")
    if labels or annotations:
        meta = ""
        if labels:
            meta += (
                "[bold]Labels:[/bold]\n"
                f"  {labels.replace(chr(10), chr(10) + '  ')}\n"
            )
        if annotations:
            ann_lines = annotations.split("\n")[:5]
            meta += (
                "[bold]Annotations:[/bold]\n  "
                + "\n  ".join(ann_lines)
            )
            if len(annotations.split("\n")) > 5:
                meta += "\n  [dim]...[/dim]"
        console.print(Panel(
            meta,
            title="[bold]🏷️  Metadata[/bold]",
            border_style=t()["border"],
        ))

    # Containers (parse from raw)
    _render_containers_from_raw(raw)

    # Conditions
    _render_conditions_from_raw(raw)

    # Events
    events_raw = sections.get("Events", "")
    if events_raw and events_raw != "<none>":
        console.print(Panel(
            events_raw,
            title="[bold]⚡ Events[/bold]",
            border_style=t()["warning"],
        ))


def _render_containers_from_raw(raw):
    """Extract and render container info from raw output."""
    lines = raw.split("\n")
    in_container = False
    container_name = ""
    containers = []
    current = {}

    for line in lines:
        stripped = line.strip()
        # Detect container name (indented under Containers:)
        if (
            line.startswith("   ")
            and not line.startswith("    ")
            and stripped.endswith(":")
            and in_container
        ):
            if current:
                containers.append(current)
            container_name = stripped.rstrip(":")
            current = {"name": container_name}
        elif stripped == "Containers:":
            in_container = True
        elif (
            in_container
            and not line.startswith(" ")
            and ":" in line
        ):
            if current:
                containers.append(current)
            break
        elif in_container and current:
            if "Image:" in stripped:
                current["image"] = stripped.split(
                    "Image:", 1
                )[1].strip()
            elif "Port:" in stripped and "Host" not in stripped:
                current["port"] = stripped.split(
                    "Port:", 1
                )[1].strip()
            elif "Limits:" in stripped:
                current["_section"] = "limits"
            elif "Requests:" in stripped:
                current["_section"] = "requests"
            elif "Liveness:" in stripped:
                current["liveness"] = stripped.split(
                    "Liveness:", 1
                )[1].strip()[:60]
            elif "Readiness:" in stripped:
                current["readiness"] = stripped.split(
                    "Readiness:", 1
                )[1].strip()[:60]
            elif current.get("_section") == "limits":
                if "cpu" in stripped:
                    current["limits_cpu"] = stripped.split(
                        ":"
                    )[-1].strip() if ":" in stripped else stripped
                elif "memory" in stripped:
                    current["limits_mem"] = stripped.split(
                        ":"
                    )[-1].strip() if ":" in stripped else stripped
                    current.pop("_section", None)
            elif current.get("_section") == "requests":
                if "cpu" in stripped:
                    current["requests_cpu"] = stripped.split(
                        ":"
                    )[-1].strip() if ":" in stripped else stripped
                elif "memory" in stripped:
                    current["requests_mem"] = stripped.split(
                        ":"
                    )[-1].strip() if ":" in stripped else stripped
                    current.pop("_section", None)

    if not containers:
        return

    # Clean up
    for c in containers:
        c.pop("_section", None)

    table = Table(
        show_header=True,
        header_style=t()["header"],
        border_style=t()["border"],
        expand=True,
    )
    table.add_column("Container")
    table.add_column("Image", no_wrap=True)
    table.add_column("Port")
    table.add_column("Requests")
    table.add_column("Limits")
    table.add_column("Probes")

    for c in containers:
        req = (
            f"cpu:{c.get('requests_cpu', '-')} "
            f"mem:{c.get('requests_mem', '-')}"
        )
        lim = (
            f"cpu:{c.get('limits_cpu', '-')} "
            f"mem:{c.get('limits_mem', '-')}"
        )
        probes = []
        if c.get("liveness"):
            probes.append("[green]L[/green]")
        if c.get("readiness"):
            probes.append("[green]R[/green]")
        probe_str = " ".join(probes) if probes else "[dim]none[/dim]"

        table.add_row(
            c.get("name", "?"),
            c.get("image", "?"),
            c.get("port", "-"),
            req,
            lim,
            probe_str,
        )

    console.print(Panel(
        table,
        title="[bold]📦 Containers[/bold]",
        border_style="blue",
    ))


def _render_conditions_from_raw(raw):
    """Extract and render conditions table."""
    lines = raw.split("\n")
    in_conditions = False
    cond_lines = []

    for line in lines:
        if line.startswith("Conditions:"):
            in_conditions = True
            continue
        if in_conditions:
            if not line.startswith(" ") and line.strip():
                break
            stripped = line.strip()
            if stripped and not stripped.startswith("---"):
                cond_lines.append(stripped)

    if not cond_lines:
        return

    table = Table(
        show_header=True,
        header_style=t()["header"],
        border_style=t()["border"],
        expand=True,
    )
    table.add_column("Type", width=15)
    table.add_column("Status", width=8)
    table.add_column("Reason")

    for line in cond_lines:
        if line.startswith("Type"):
            continue
        parts = line.split(None, 2)
        if len(parts) >= 2:
            status_style = (
                "green" if parts[1] == "True" else "red"
            )
            table.add_row(
                parts[0],
                f"[{status_style}]{parts[1]}"
                f"[/{status_style}]",
                parts[2] if len(parts) > 2 else "",
            )

    console.print(Panel(
        table,
        title="[bold]📋 Conditions[/bold]",
        border_style=t()["border"],
    ))


def _render_service_describe(sections, raw):
    """Render service describe."""
    name = sections.get("Name", "?")
    ns = sections.get("Namespace", "?")
    svc_type = sections.get("Type", "?")
    cluster_ip = sections.get("IP", "?")
    ports = sections.get("Port", "?")
    endpoints = sections.get("Endpoints", "?")
    selector = sections.get("Selector", "?")

    info = (
        f"[bold cyan]Name:[/bold cyan]       {name}\n"
        f"[bold cyan]Namespace:[/bold cyan]  {ns}\n"
        f"[bold cyan]Type:[/bold cyan]       {svc_type}\n"
        f"[bold cyan]ClusterIP:[/bold cyan]  {cluster_ip}\n"
        f"[bold cyan]Ports:[/bold cyan]      {ports}\n"
        f"[bold cyan]Endpoints:[/bold cyan]  "
        f"{endpoints[:80]}\n"
        f"[bold cyan]Selector:[/bold cyan]   {selector}"
    )
    console.print(Panel(
        info,
        title="[bold]🌐 Service[/bold]",
        border_style=t()["success"],
    ))
    _render_conditions_from_raw(raw)


def _render_node_describe(sections, raw):
    """Render node describe."""
    name = sections.get("Name", "?")
    roles = sections.get("Roles", "?")
    os_image = sections.get("OS Image", "?")
    kubelet = sections.get("Kubelet Version", "?")
    cpu = sections.get("cpu", "?")
    memory = sections.get("memory", "?")

    info = (
        f"[bold cyan]Name:[/bold cyan]      {name}\n"
        f"[bold cyan]Roles:[/bold cyan]     {roles}\n"
        f"[bold cyan]OS:[/bold cyan]        {os_image}\n"
        f"[bold cyan]Kubelet:[/bold cyan]   {kubelet}\n"
        f"[bold cyan]CPU:[/bold cyan]       {cpu}\n"
        f"[bold cyan]Memory:[/bold cyan]    {memory}"
    )
    console.print(Panel(
        info,
        title="[bold]🖥️  Node[/bold]",
        border_style="magenta",
    ))
    _render_conditions_from_raw(raw)


def _render_generic_describe(sections, raw):
    """Render any resource describe with highlighted keys."""
    lines = []
    for line in raw.split("\n"):
        if (
            line
            and not line.startswith(" ")
            and ":" in line
        ):
            key, _, val = line.partition(":")
            lines.append(
                f"[bold cyan]{key}[/bold cyan]:{val}"
            )
        elif line.startswith("Events:"):
            lines.append(
                f"\n[bold yellow]{line}[/bold yellow]"
            )
        elif line.startswith("Conditions:"):
            lines.append(
                f"\n[bold yellow]{line}[/bold yellow]"
            )
        else:
            lines.append(line)

    console.print(Panel(
        "\n".join(lines),
        border_style=t()["primary"],
        padding=(0, 1),
    ))
