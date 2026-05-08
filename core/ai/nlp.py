"""
Natural Language Operations — parse English into
KubeEasy commands.

Examples:
  "scale payment to 5" → scale payment 5
  "show me the logs for auth" → logs auth
  "restart the gateway" → restart gateway
  "what pods are running" → pods
"""

import re


def parse_natural_language(text):
    """
    Try to parse natural language into a command.
    Returns command string or None.
    """
    lower = text.lower().strip()

    # Scale patterns
    m = re.match(
        r"scale (\S+) to (\d+)",
        lower
    )
    if m:
        return f"scale {m.group(1)} {m.group(2)}"

    m = re.match(
        r"set (\S+) replicas? to (\d+)",
        lower
    )
    if m:
        return f"scale {m.group(1)} {m.group(2)}"

    # Logs patterns
    m = re.match(
        r"(?:show|get|view)?\s*(?:me\s+)?(?:the\s+)?logs?\s+(?:for\s+|of\s+)?(\S+)",
        lower
    )
    if m:
        return f"logs {m.group(1)}"

    # Restart patterns
    m = re.match(
        r"restart\s+(?:the\s+)?(\S+)",
        lower
    )
    if m:
        return f"restart {m.group(1)}"

    # Rollback patterns
    m = re.match(
        r"(?:rollback|undo|revert)\s+(?:the\s+)?(\S+)",
        lower
    )
    if m:
        return f"rollback {m.group(1)}"

    # Inspect patterns
    m = re.match(
        r"(?:show|describe|inspect|look at)\s+(?:the\s+)?(?:pod\s+)?(\S+)",
        lower
    )
    if m and m.group(1) not in ("pods", "nodes", "events", "me"):
        return f"inspect {m.group(1)}"

    # List patterns
    if re.match(r"(?:show|list|get)\s+(?:all\s+)?pods?", lower):
        return "pods"

    if re.match(r"(?:show|list|get)\s+(?:all\s+)?events?", lower):
        return "events"

    if re.match(r"(?:show|list|get)\s+(?:all\s+)?nodes?", lower):
        return "nodes"

    if re.match(r"(?:show|list|get)\s+(?:all\s+)?services?", lower):
        return "services"

    if re.match(r"(?:show|list|get)\s+(?:all\s+)?jobs?", lower):
        return "jobs"

    if re.match(r"(?:show|list|get)\s+(?:all\s+)?cronjobs?", lower):
        return "cronjobs"

    # Switch patterns
    m = re.match(
        r"(?:switch|change|use)\s+(?:to\s+)?(?:context\s+)?(\S+)",
        lower
    )
    if m and m.group(1) not in ("namespace",):
        return f"switch {m.group(1)}"

    # Namespace patterns
    m = re.match(
        r"(?:switch|change|use)\s+namespace\s+(\S+)",
        lower
    )
    if m:
        return f"use {m.group(1)}"

    # Diagnose patterns
    m = re.match(
        r"(?:diagnose|debug|troubleshoot)\s+(?:the\s+)?(\S+)",
        lower
    )
    if m:
        return f"diagnose {m.group(1)}"

    # Forward patterns
    m = re.match(
        r"(?:forward|port.?forward)\s+(\S+)\s+(?:port\s+)?(\d+)",
        lower
    )
    if m:
        return f"forward {m.group(1)} {m.group(2)}"

    return None
