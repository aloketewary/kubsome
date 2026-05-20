"""
Events Renderer — timeline-style cluster event display
with colored severity, relative timestamps, and grouped repeats.
"""

from rich.console import Console
from rich.panel import Panel
from rich.table import Table
from rich.console import Group
from datetime import datetime, timezone

console = Console()

from core.theme import t

# Reasons that indicate problems
CRITICAL_REASONS = {
    "BackOff", "Failed", "FailedScheduling",
    "OOMKilling", "Unhealthy", "FailedMount",
    "FailedAttachVolume", "EvictionThresholdMet",
    "NodeNotReady", "NetworkNotReady",
}

WARNING_REASONS = {
    "Pulling", "Pulled", "Killing", "Preempting",
    "FailedGetScale", "ScalingReplicaSet",
}


def _reason_style(reason):
    if reason in CRITICAL_REASONS:
        return "red"
    if reason in WARNING_REASONS:
        return "yellow"
    return ""


def _relative_time(timestamp_str):
    """Convert ISO timestamp to relative time like '2m ago'."""
    if not timestamp_str:
        return ""
    try:
        ts = timestamp_str.replace("Z", "+00:00")
        dt = datetime.fromisoformat(ts)
        now = datetime.now(timezone.utc)
        delta = (now - dt).total_seconds()

        if delta < 60:
            return "just now"
        if delta < 3600:
            return f"{int(delta // 60)}m ago"
        if delta < 86400:
            return f"{int(delta // 3600)}h ago"
        return f"{int(delta // 86400)}d ago"
    except Exception:
        return timestamp_str[:16] if timestamp_str else ""


def _truncate(text, max_len=50):
    if not text or len(text) <= max_len:
        return text or ""
    return text[:max_len - 1] + "…"


def _count_display(count):
    """Format repeat count with emphasis for high values."""
    if count <= 1:
        return ""
    if count >= 50:
        return f"[bold red]×{count}[/bold red]"
    if count >= 10:
        return f"[yellow]×{count}[/yellow]"
    return f"[dim]×{count}[/dim]"


def render_events(events):
    if not events:
        console.print("[dim]No events found[/dim]")
        return

    warnings = sum(1 for e in events if e["type"] == "Warning")
    normals = len(events) - warnings
    high_repeat = sum(1 for e in events if e.get("count", 1) >= 10)

    # Summary
    parts = [f"[bold]{len(events)}[/bold] events"]
    if warnings:
        parts.append(f"[yellow]● {warnings} warnings[/yellow]")
    if normals and not warnings:
        parts.append("[green]● all normal[/green]")
    if high_repeat:
        parts.append(f"[dim]● {high_repeat} repeating[/dim]")

    console.print(Panel.fit("  │  ".join(parts), border_style=t()["primary"]))

    # Table
    table = Table(
        show_header=True,
        header_style=t()["header"],
        border_style=t()["border"],
        expand=True,
        show_lines=False,
    )

    table.add_column("", width=2)
    table.add_column("Age", width=9, justify="right")
    table.add_column("Kind", width=10)
    table.add_column("Object", no_wrap=True)
    table.add_column("Reason", width=20)
    table.add_column("Message", ratio=1)
    table.add_column("×", justify="right", width=5)

    for ev in events:
        is_warning = ev["type"] == "Warning"
        icon = "[yellow]●[/yellow]" if is_warning else "[dim]○[/dim]"

        reason = ev.get("reason", "")
        rs = _reason_style(reason)
        reason_display = (
            f"[{rs}]{reason}[/{rs}]" if rs else reason
        )

        obj_name = ev.get("object", "")
        message = _truncate(ev.get("message", ""), 120)
        age = _relative_time(ev.get("last_seen", ""))
        count = _count_display(ev.get("count", 1))

        table.add_row(
            icon,
            f"[dim]{age}[/dim]",
            f"[dim]{ev.get('kind', '')}[/dim]",
            obj_name,
            reason_display,
            message,
            count,
        )

    console.print(table)
    console.print(
        f"[dim]{'─' * 3} {len(events)} events {'─' * 3}[/dim]"
    )


def build_events_watch_view(events, namespace):
    """Returns a renderable for Live updates."""

    warnings = sum(1 for e in events if e["type"] == "Warning")
    now = datetime.now().strftime("%H:%M:%S")

    header_parts = [
        "[bold cyan]⟳ EVENTS[/bold cyan]",
        f"[dim]{namespace}[/dim]",
        "│",
        f"[bold]{len(events)}[/bold] events",
        "│",
        f"[yellow]● {warnings} warnings[/yellow]",
        "│",
        f"[dim]{now}[/dim]",
        "│",
        "[dim italic]Ctrl+C to exit[/dim italic]",
    ]

    header_panel = Panel.fit(
        "  ".join(header_parts), border_style=t()["primary"]
    )

    table = Table(
        show_header=True,
        header_style=t()["header"],
        border_style=t()["border"],
        expand=True,
        show_lines=False,
    )

    table.add_column("", width=2)
    table.add_column("Age", width=9, justify="right")
    table.add_column("Kind", width=10)
    table.add_column("Object", no_wrap=True)
    table.add_column("Reason", width=20)
    table.add_column("Message", ratio=1)
    table.add_column("×", justify="right", width=5)

    for ev in events[-30:]:
        is_warning = ev["type"] == "Warning"
        icon = "[yellow]●[/yellow]" if is_warning else "[dim]○[/dim]"

        reason = ev.get("reason", "")
        rs = _reason_style(reason)
        reason_display = (
            f"[{rs}]{reason}[/{rs}]" if rs else reason
        )

        obj_name = ev.get("object", "")
        message = _truncate(ev.get("message", ""), 120)
        age = _relative_time(ev.get("last_seen", ""))
        count = _count_display(ev.get("count", 1))

        table.add_row(
            icon,
            f"[dim]{age}[/dim]",
            f"[dim]{ev.get('kind', '')}[/dim]",
            obj_name,
            reason_display,
            message,
            count,
        )

    return Group(header_panel, table)
