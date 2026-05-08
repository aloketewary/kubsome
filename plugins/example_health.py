"""
Example KubeEasy Plugin

Place this file in ~/.kubeasy/plugins/
Then run: plugin health-summary
"""

NAME = "health-summary"
DESCRIPTION = "Quick one-line cluster health summary"


def run(context):
    from core.collectors.pods import collect_pods

    pods = collect_pods()
    running = sum(
        1 for p in pods if p["status"] == "Running"
    )
    total = len(pods)

    if running == total:
        return f"[green]✓ All {total} pods running[/green]"

    return (
        f"[yellow]⚠ {running}/{total} pods running "
        f"({total - running} issues)[/yellow]"
    )
