import sys
import questionary


def _is_interactive():
    """Check if we're running in an interactive terminal."""
    return sys.stdin.isatty()


def choose_pod(matches):
    if len(matches) == 1:
        return matches[0]
    if not _is_interactive():
        return matches[0]
    return questionary.select(
        "Select Pod:",
        choices=matches
    ).ask()


def choose_deployment(matches):
    if len(matches) == 1:
        return matches[0]
    if not _is_interactive():
        return matches[0]
    return questionary.select(
        "Select Deployment:",
        choices=matches
    ).ask()


def choose_cronjob(matches):
    if len(matches) == 1:
        return matches[0]
    if not _is_interactive():
        return matches[0]
    return questionary.select(
        "Select CronJob:",
        choices=matches
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
        choices=labels
    ).ask()

    for ctx in contexts:
        label = (
            f"{ctx['name']} "
            f"({ctx['environment']})"
        )
        if label == selected:
            return ctx

    return None
