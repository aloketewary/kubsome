"""
Log Correlation — merge logs from multiple pods
into a single timeline with timestamps.
"""

import subprocess
import re
from concurrent.futures import ThreadPoolExecutor

from core.context import context


def correlate_logs(pod_names, tail=50):
    """
    Fetch logs from multiple pods and merge into
    a time-sorted unified timeline.
    """
    if not pod_names:
        return {
            "pods": [],
            "entries": [],
            "total": 0,
        }

    ctx = context.current_context
    ns = context.namespace
    entries = []

    def fetch_pod_logs(pod):
        cmd = (
            f"kubectl --context {ctx} "
            f"logs {pod} -n {ns} "
            f"--tail={tail} --timestamps"
        )
        try:
            result = subprocess.run(
                cmd, shell=True,
                capture_output=True, text=True,
                timeout=15,
            )
            if result.returncode != 0:
                return []

            pod_entries = []
            for line in result.stdout.strip().split("\n"):
                if not line.strip():
                    continue
                ts, msg = _parse_timestamped_line(line)
                pod_entries.append({
                    "pod": _short_name(pod),
                    "pod_full": pod,
                    "timestamp": ts,
                    "message": msg,
                    "level": _detect_level(msg),
                })
            return pod_entries
        except (subprocess.SubprocessError, Exception):
            return []

    # Parallel fetch logs from all pods
    workers = min(len(pod_names), 10)
    with ThreadPoolExecutor(max_workers=workers) as executor:
        results = executor.map(fetch_pod_logs, pod_names)

    for pod_entries in results:
        entries.extend(pod_entries)

    # Sort by timestamp
    entries.sort(key=lambda e: e["timestamp"] or "")

    return {
        "pods": pod_names,
        "entries": entries,
        "total": len(entries),
    }


def _parse_timestamped_line(line):
    """Extract timestamp and message from kubectl --timestamps output."""
    # Format: 2024-01-15T10:30:45.123456789Z message
    match = re.match(
        r"(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d+Z?)\s+(.*)",
        line
    )
    if match:
        return match.group(1)[:23], match.group(2)
    return None, line


def _short_name(pod_name):
    """Shorten pod name for display."""
    parts = pod_name.split("-")
    if len(parts) > 2:
        return "-".join(parts[:-2])
    return pod_name


def _detect_level(msg):
    """Detect log level from message content."""
    lower = msg.lower()
    if "error" in lower or "fatal" in lower or "panic" in lower:
        return "error"
    if "warn" in lower:
        return "warn"
    if "debug" in lower:
        return "debug"
    return "info"
