def diagnose(data):
    """
    Analyze pod data and return a list of findings.
    Each finding: {severity, title, detail, action}
    """
    findings = []
    details = data["details"]
    events = data["events"]
    logs = data["logs"]
    raw = data["raw"]

    # Check container states
    for c in details["containers"]:
        if c["state"] == "waiting":
            _check_waiting(c, raw, findings)
        elif c["state"] == "terminated":
            _check_terminated(c, raw, findings)

        if c["restarts"] >= 5:
            findings.append({
                "severity": "critical",
                "title": f"High restart count: {c['name']}",
                "detail": (
                    f"{c['restarts']} restarts detected"
                ),
                "action": (
                    "Check logs for crash reason: "
                    f"logs {details['name']}"
                ),
            })
        elif c["restarts"] >= 2:
            findings.append({
                "severity": "warning",
                "title": f"Restart spike: {c['name']}",
                "detail": (
                    f"{c['restarts']} restarts"
                ),
                "action": "Monitor — may stabilize",
            })

    # Check probes
    for c in details["containers"]:
        if not c["readiness"] and not c["liveness"]:
            findings.append({
                "severity": "info",
                "title": f"No probes: {c['name']}",
                "detail": (
                    "No liveness or readiness probe "
                    "configured"
                ),
                "action": "Add probes for reliability",
            })

    # Check events
    _check_events(events, findings)

    # Check logs for errors
    _check_logs(logs, findings)

    # Check resources
    for c in details["containers"]:
        resources = c["resources"]
        if not resources.get("requests") and not resources.get("limits"):
            findings.append({
                "severity": "warning",
                "title": f"No resource limits: {c['name']}",
                "detail": "No CPU/memory requests or limits set",
                "action": "Set resource requests and limits",
            })

    # Phase check
    if details["phase"] == "Pending":
        findings.append({
            "severity": "critical",
            "title": "Pod stuck in Pending",
            "detail": "Pod cannot be scheduled",
            "action": "Check node resources and taints",
        })

    if not findings:
        findings.append({
            "severity": "healthy",
            "title": "No issues detected",
            "detail": "Pod appears healthy",
            "action": "No action required",
        })

    return findings


def _check_waiting(container, raw, findings):
    statuses = raw["status"].get(
        "containerStatuses", []
    )
    for cs in statuses:
        if cs["name"] != container["name"]:
            continue
        waiting = cs.get("state", {}).get("waiting", {})
        reason = waiting.get("reason", "")

        if reason == "CrashLoopBackOff":
            findings.append({
                "severity": "critical",
                "title": f"CrashLoopBackOff: {container['name']}",
                "detail": (
                    "Container keeps crashing and "
                    "restarting"
                ),
                "action": (
                    "Check application logs for "
                    "startup errors"
                ),
            })
        elif reason == "ImagePullBackOff":
            findings.append({
                "severity": "critical",
                "title": f"ImagePullBackOff: {container['name']}",
                "detail": (
                    f"Cannot pull image: "
                    f"{container['image']}"
                ),
                "action": (
                    "Verify image name, tag, and "
                    "registry credentials"
                ),
            })
        elif reason == "CreateContainerConfigError":
            findings.append({
                "severity": "critical",
                "title": f"Config error: {container['name']}",
                "detail": "Container config is invalid",
                "action": (
                    "Check ConfigMaps, Secrets, "
                    "and env references"
                ),
            })
        elif reason:
            findings.append({
                "severity": "warning",
                "title": f"Waiting: {container['name']}",
                "detail": f"Reason: {reason}",
                "action": "Investigate waiting state",
            })


def _check_terminated(container, raw, findings):
    statuses = raw["status"].get(
        "containerStatuses", []
    )
    for cs in statuses:
        if cs["name"] != container["name"]:
            continue
        terminated = cs.get(
            "state", {}
        ).get("terminated", {})
        reason = terminated.get("reason", "")
        exit_code = terminated.get("exitCode", 0)

        if reason == "OOMKilled":
            findings.append({
                "severity": "critical",
                "title": f"OOMKilled: {container['name']}",
                "detail": (
                    "Container killed due to memory "
                    "limit exceeded"
                ),
                "action": "Increase memory limits",
            })
        elif exit_code != 0:
            findings.append({
                "severity": "critical",
                "title": (
                    f"Exit code {exit_code}: "
                    f"{container['name']}"
                ),
                "detail": f"Terminated: {reason or 'unknown'}",
                "action": "Check logs for crash reason",
            })


def _check_events(events, findings):
    critical_reasons = {
        "FailedScheduling": (
            "Pod cannot be scheduled — "
            "check node resources/taints"
        ),
        "FailedMount": (
            "Volume mount failed — "
            "check PVC and storage"
        ),
        "Unhealthy": (
            "Probe failing — "
            "check endpoint health"
        ),
        "BackOff": (
            "Container backing off — "
            "check startup errors"
        ),
    }

    seen_reasons = set()
    for ev in events:
        if ev["type"] != "Warning":
            continue
        reason = ev["reason"]
        if reason in seen_reasons:
            continue
        seen_reasons.add(reason)

        if reason in critical_reasons:
            findings.append({
                "severity": "critical",
                "title": f"Event: {reason}",
                "detail": ev["message"][:100],
                "action": critical_reasons[reason],
            })
        else:
            findings.append({
                "severity": "warning",
                "title": f"Warning event: {reason}",
                "detail": ev["message"][:100],
                "action": "Investigate warning",
            })


def _check_logs(logs, findings):
    if not logs:
        return

    lines = logs.strip().split("\n")
    error_lines = [
        l for l in lines
        if any(
            kw in l.lower()
            for kw in [
                "error", "fatal", "exception",
                "panic", "oom", "killed"
            ]
        )
    ]

    if len(error_lines) >= 10:
        findings.append({
            "severity": "critical",
            "title": "High error rate in logs",
            "detail": (
                f"{len(error_lines)} error lines "
                f"in last {len(lines)} lines"
            ),
            "action": "Investigate application errors",
        })
    elif error_lines:
        findings.append({
            "severity": "warning",
            "title": "Errors in logs",
            "detail": (
                f"{len(error_lines)} error lines found"
            ),
            "action": "Review: logs <pod> --errors",
        })
