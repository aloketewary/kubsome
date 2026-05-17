"""
Interactive Selector — choose from fuzzy matches.
Caps choices at 8 for usability in large clusters.
"""

import sys
import questionary


MAX_CHOICES = 8


def _is_interactive():
    """Check if we're running in an interactive terminal."""
    return sys.stdin.isatty()


def choose_pod(matches):
    if not matches:
        return None
    if len(matches) == 1:
        return matches[0]
    if not _is_interactive():
        return matches[0]

    choices = matches[:MAX_CHOICES]
    if len(matches) > MAX_CHOICES:
        choices.append(
            f"... ({len(matches) - MAX_CHOICES} more — "
            f"type a longer query to narrow)"
        )

    selected = questionary.select(
        f"Select Pod ({len(matches)} matches):",
        choices=choices
    ).ask()

    # If user selected the "more" hint, return first match
    if selected and selected.startswith("..."):
        return matches[0]
    return selected


def choose_deployment(matches):
    if not matches:
        return None
    if len(matches) == 1:
        return matches[0]
    if not _is_interactive():
        return matches[0]

    choices = matches[:MAX_CHOICES]
    return questionary.select(
        f"Select Deployment ({len(matches)} matches):",
        choices=choices
    ).ask()


def choose_cronjob(matches):
    if not matches:
        return None
    if len(matches) == 1:
        return matches[0]
    if not _is_interactive():
        return matches[0]

    choices = matches[:MAX_CHOICES]
    return questionary.select(
        f"Select CronJob ({len(matches)} matches):",
        choices=choices
    ).ask()


def choose_context(contexts):
    if not contexts:
        return None
    if len(contexts) == 1:
        return contexts[0]
    if not _is_interactive():
        return contexts[0]

    labels = []
    for ctx in contexts:
        labels.append(
            f"{ctx['name']} "
            f"({ctx['environment']})"
        )

    selected = questionary.select(
        "Select Context:",
        choices=labels[:MAX_CHOICES]
    ).ask()

    for ctx in contexts:
        label = (
            f"{ctx['name']} "
            f"({ctx['environment']})"
        )
        if label == selected:
            return ctx

    return None
