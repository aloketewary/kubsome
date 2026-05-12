import subprocess
import threading
import queue
from concurrent.futures import ThreadPoolExecutor

from core.context import context


def fetch_containers(pod_name):
    """Get list of container names in a pod."""
    cmd = (
        f"kubectl --context {context.current_context} "
        f"get pod {pod_name} -n {context.namespace} "
        f"-o jsonpath='{{.spec.containers[*].name}}'"
    )
    result = subprocess.run(
        cmd, shell=True, capture_output=True, text=True
    )
    if result.returncode != 0:
        return []
    names = result.stdout.strip("'").split()
    return [n for n in names if n]


def fetch_logs(
    pod_name,
    tail=100,
    previous=False,
    follow=False,
    errors_only=False,
    container=None
):
    cmd = (
        f"kubectl "
        f"--context {context.current_context} "
        f"logs {pod_name} "
        f"-n {context.namespace} "
        f"--tail={tail}"
    )

    if container:
        cmd += f" -c {container}"

    if previous:
        cmd += " --previous"

    if follow:
        cmd += " --follow"

    result = subprocess.run(
        cmd,
        shell=True,
        capture_output=True,
        text=True
    )

    lines = result.stdout.strip().split("\n")

    if errors_only:
        lines = [
            line for line in lines
            if any(
                kw in line.lower()
                for kw in [
                    "error", "fatal", "exception",
                    "panic", "fail", "traceback"
                ]
            )
        ]

    return lines


def stream_logs(pod_name, container=None):
    """Returns a Popen process for live log streaming."""
    cmd = (
        f"kubectl "
        f"--context {context.current_context} "
        f"logs {pod_name} "
        f"-n {context.namespace} "
        f"--follow --tail=20"
    )

    if container:
        cmd += f" -c {container}"

    process = subprocess.Popen(
        cmd,
        shell=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True
    )

    return process


def find_pods_for_deployment(query):
    """
    Find all pods belonging to a deployment by label selector.
    Falls back to prefix matching.
    """
    ns = context.namespace
    ctx = context.current_context

    # Try to get deployment selector
    cmd = (
        f"kubectl --context {ctx} "
        f"get deployment -n {ns} -o json"
    )

    r = subprocess.run(
        cmd, shell=True,
        capture_output=True, text=True
    )

    if r.returncode != 0:
        return []

    import json
    data = json.loads(r.stdout)

    # Find matching deployment
    target_dep = None
    for item in data.get("items", []):
        name = item["metadata"]["name"]
        if query.lower() in name.lower():
            target_dep = item
            break

    if not target_dep:
        return []

    # Get pods by label selector
    labels = target_dep["spec"].get(
        "selector", {}
    ).get("matchLabels", {})

    if not labels:
        return []

    selector = ",".join(
        f"{k}={v}" for k, v in labels.items()
    )

    cmd2 = (
        f"kubectl --context {ctx} "
        f"get pods -n {ns} "
        f"-l {selector} "
        f"-o jsonpath='{{.items[*].metadata.name}}'"
    )

    r2 = subprocess.run(
        cmd2, shell=True,
        capture_output=True, text=True
    )

    pods = r2.stdout.strip("'").split()
    return [p for p in pods if p]


def fetch_combined_logs(pods, tail=50, errors_only=False):
    """
    Fetch logs from multiple pods and merge them
    with pod-name prefix (logcat style).
    """
    if not pods:
        return []

    ctx = context.current_context
    ns = context.namespace
    all_lines = []

    def fetch_single(pod):
        cmd = (
            f"kubectl "
            f"--context {ctx} "
            f"logs {pod} "
            f"-n {ns} "
            f"--tail={tail} --timestamps"
        )

        try:
            result = subprocess.run(
                cmd, shell=True,
                capture_output=True, text=True,
                timeout=15
            )
            pod_lines = []
            for line in result.stdout.strip().split("\n"):
                if line:
                    pod_lines.append({
                        "pod": pod,
                        "line": line,
                    })
            return pod_lines
        except (subprocess.SubprocessError, Exception):
            return []

    # Parallel fetch across pods
    workers = min(len(pods), 10)
    with ThreadPoolExecutor(max_workers=workers) as executor:
        results = executor.map(fetch_single, pods)

    for pod_lines in results:
        all_lines.extend(pod_lines)

    # Sort by timestamp (first part of line)
    all_lines.sort(
        key=lambda x: x["line"][:30]
    )

    if errors_only:
        all_lines = [
            line_entry for line_entry in all_lines
            if any(
                kw in line_entry["line"].lower()
                for kw in [
                    "error", "fatal", "exception",
                    "panic", "fail", "traceback"
                ]
            )
        ]

    return all_lines


def stream_combined_logs(pods):
    """
    Stream logs from multiple pods simultaneously.
    Returns a queue that receives (pod_name, line) tuples.
    """
    log_queue = queue.Queue()
    processes = []

    def _reader(pod, proc):
        for line in proc.stdout:
            log_queue.put((pod, line.rstrip()))
        log_queue.put((pod, None))  # Signal done

    for pod in pods:
        cmd = (
            f"kubectl "
            f"--context {context.current_context} "
            f"logs {pod} "
            f"-n {context.namespace} "
            f"--follow --tail=5"
        )

        proc = subprocess.Popen(
            cmd, shell=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True
        )

        processes.append(proc)

        t = threading.Thread(
            target=_reader,
            args=(pod, proc),
            daemon=True
        )
        t.start()

    return log_queue, processes
