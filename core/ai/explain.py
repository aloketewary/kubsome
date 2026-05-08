"""
Explain Mode — takes cluster data and produces
human-readable explanations using LLM or rules.
"""

from core.ai.llm import get_llm_provider
from core.collectors.inspect import (
    inspect_pod, extract_pod_details, pod_events
)
from core.collectors.events import collect_events
from core.resolver import resolve_pod_name


def explain(query):
    """
    Explain a resource, event, or concept.
    Uses LLM if available, falls back to rules.
    """
    provider = get_llm_provider()

    # Gather context
    context_data = _gather_context(query)

    # Try LLM first
    if provider.available():
        prompt = (
            f"Explain this Kubernetes situation "
            f"in simple terms and suggest fixes:\n\n"
            f"{query}"
        )
        result = provider.query(prompt, context_data)
        if result:
            return {
                "title": "🧠 Explanation",
                "content": result,
                "source": "llm",
            }

    # Fallback to rule-based
    return _rule_based_explain(query)


def _gather_context(query):
    """Try to gather relevant cluster context for the query."""
    words = query.lower().split()

    # Try to find a pod reference
    for word in words:
        if len(word) > 3:
            matches = resolve_pod_name(word)
            if matches:
                pod_data = inspect_pod(matches[0])
                if pod_data:
                    details = extract_pod_details(pod_data)
                    return (
                        f"Pod: {details['name']}\n"
                        f"Phase: {details['phase']}\n"
                        f"Containers: {len(details['containers'])}\n"
                        f"Restarts: {details['containers'][0]['restarts'] if details['containers'] else 0}"
                    )

    return ""


def _rule_based_explain(query):
    """Rule-based explanations for common K8s concepts."""
    lower = query.lower()

    explanations = {
        "crashloopbackoff": {
            "title": "🧠 CrashLoopBackOff",
            "content": (
                "The container keeps crashing and Kubernetes "
                "is backing off before restarting it.\n\n"
                "[bold]What's happening:[/bold]\n"
                "  1. Container starts\n"
                "  2. Container crashes (exit code != 0)\n"
                "  3. Kubernetes restarts it\n"
                "  4. Wait time increases exponentially\n\n"
                "[bold]Common causes:[/bold]\n"
                "  • Application error on startup\n"
                "  • Missing environment variable or config\n"
                "  • Port already in use\n"
                "  • Insufficient memory (OOM)\n\n"
                "[bold]Debug:[/bold]\n"
                "  [cyan]logs <pod> --previous[/cyan]\n"
                "  [cyan]inspect <pod>[/cyan]"
            ),
        },
        "imagepullbackoff": {
            "title": "🧠 ImagePullBackOff",
            "content": (
                "Kubernetes cannot pull the container image.\n\n"
                "[bold]Common causes:[/bold]\n"
                "  • Image name or tag is wrong\n"
                "  • Private registry without imagePullSecret\n"
                "  • Registry is down or unreachable\n"
                "  • Image was deleted from registry\n\n"
                "[bold]Debug:[/bold]\n"
                "  [cyan]inspect <pod>[/cyan] — check image name\n"
                "  Check imagePullSecrets in pod spec"
            ),
        },
        "oomkill": {
            "title": "🧠 OOMKilled",
            "content": (
                "Container was killed because it exceeded "
                "its memory limit.\n\n"
                "[bold]What happened:[/bold]\n"
                "  Container used more memory than its limit allows.\n"
                "  The kernel OOM killer terminated it.\n\n"
                "[bold]Fix:[/bold]\n"
                "  • Increase memory limit in deployment spec\n"
                "  • Fix memory leak in application\n"
                "  • Add horizontal scaling\n\n"
                "[bold]Check:[/bold]\n"
                "  [cyan]top pods[/cyan] — see actual usage\n"
                "  [cyan]optimize[/cyan] — get right-sizing suggestions"
            ),
        },
        "pending": {
            "title": "🧠 Pending Pod",
            "content": (
                "Pod cannot be scheduled to any node.\n\n"
                "[bold]Common causes:[/bold]\n"
                "  • No node has enough CPU/memory\n"
                "  • Node taints without matching tolerations\n"
                "  • NodeSelector doesn't match any node\n"
                "  • PVC cannot be bound\n\n"
                "[bold]Debug:[/bold]\n"
                "  [cyan]events[/cyan] — look for FailedScheduling\n"
                "  [cyan]top nodes[/cyan] — check capacity\n"
                "  [cyan]inspect <pod>[/cyan] — check nodeSelector"
            ),
        },
        "evicted": {
            "title": "🧠 Evicted Pod",
            "content": (
                "Pod was evicted due to node resource pressure.\n\n"
                "[bold]Causes:[/bold]\n"
                "  • Node disk pressure\n"
                "  • Node memory pressure\n"
                "  • Pod exceeded ephemeral storage limit\n\n"
                "[bold]Fix:[/bold]\n"
                "  • Set resource requests/limits\n"
                "  • Clean up disk on nodes\n"
                "  • Add more nodes to cluster"
            ),
        },
        "networkpolicy": {
            "title": "🧠 NetworkPolicy",
            "content": (
                "NetworkPolicies control traffic flow between pods.\n\n"
                "[bold]Default behavior:[/bold]\n"
                "  Without policies: all traffic allowed\n"
                "  With policies: only explicitly allowed traffic\n\n"
                "[bold]Check:[/bold]\n"
                "  [cyan]netcheck <pod>[/cyan] — test connectivity\n"
                "  kubectl get networkpolicies"
            ),
        },
    }

    for key, explanation in explanations.items():
        if key in lower:
            return explanation

    return {
        "title": "🧠 Explain",
        "content": (
            f"No built-in explanation for: {query}\n\n"
            "[dim]For AI-powered explanations, "
            "start a local LLM server:\n"
            "  ollama serve\n"
            "  ollama pull llama3\n\n"
            "Then set in ~/.kubsome/config.yaml:\n"
            "  llm:\n"
            "    provider: ollama[/dim]"
        ),
    }
