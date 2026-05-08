"""
Smart Suggestions — fuzzy match user input against
known commands for "did you mean?" corrections.
"""

from rapidfuzz import process

KNOWN_COMMANDS = [
    "pods", "pods watch", "overview", "events",
    "events watch", "logs", "inspect", "diagnose",
    "trace", "rollout", "rollback", "restart",
    "scale", "top pods", "top nodes", "find",
    "ns", "netcheck", "cronjobs", "jobs",
    "trigger", "config", "secret", "diff",
    "forward", "security", "optimize", "unused",
    "check", "export", "audit", "alerts",
    "correlate", "playbook", "compare",
    "incident start", "incident stop", "snapshot",
    "note", "plugins", "tui", "help",
    "switch", "use", "contexts", "services",
    "nodes", "summarize", "exit",
]


def suggest_command(user_input):
    """
    Find closest matching command for typo correction.
    Returns suggestion or None.
    """
    if not user_input:
        return None

    first_word = user_input.split()[0]

    matches = process.extract(
        first_word,
        KNOWN_COMMANDS,
        limit=3
    )

    # Only suggest if reasonably close (score > 60)
    suggestions = [
        m[0] for m in matches if m[1] > 60
    ]

    if suggestions and suggestions[0] != user_input:
        return suggestions[0]

    return None
