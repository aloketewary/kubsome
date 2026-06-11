"""
Diagnostics Engine — investigates pod issues and produces
an InvestigationReport with evidence-backed findings.
"""

from datetime import datetime, timezone

from core.diagnostics.models import (
    InvestigationReport,
    ResourceRef,
    Observation,
    Finding,
    Recommendation,
    ExecutionPlan,
    Severity,
    Risk,
    ObservationSource,
    make_observation_id,
)
from core.diagnostics.registry import (
    FindingType,
    get_remediation,
)


def investigate(data):
    """
    Produce a full InvestigationReport from collected
    pod diagnostic data.
    """
    if not data:
        return None

    details = data["details"]
    events = data["events"]
    logs = data["logs"]
    raw = data["raw"]

    ns = details["namespace"]
    name = details["name"]

    report = InvestigationReport(
        target=ResourceRef(
            kind="Pod",
            name=name,
            namespace=ns,
            context=raw.get("metadata", {})
            .get("annotations", {})
            .get(
                "kubectl.kubernetes.io/"
                "last-applied-configuration", ""
            ),
        ),
        generated_at=datetime.now(timezone.utc),
    )

    # Collect observations and derive findings
    _observe_init_containers(details, raw, report)
    _observe_containers(details, raw, report)
    _observe_probes(details, report)
    _observe_events(events, report)
    _observe_logs(logs, report)
    _observe_resources(details, report)
    _observe_phase(details, report)

    # Link causal relationships
    _link_related_findings(report)

    # Generate execution plans from catalog
    _generate_plans(report)

    if not report.findings:
        report.findings.append(Finding(
            id="healthy",
            severity=Severity.INFO,
            title="No issues detected",
            conclusion="Pod appears healthy",
            finding_type=FindingType.HEALTHY.value,
        ))

    report.validate()

    # Persist snapshot for timeline queries
    from core.diagnostics import snapshots
    try:
        snapshots.save(report)
    except OSError:
        pass  # Non-fatal if storage fails

    return report


def diagnose(data):
    """
    Legacy compatibility wrapper.
    Returns list[dict] matching old format.
    """
    report = investigate(data)
    if not report:
        return []

    results = []
    for f in report.findings:
        action = "No action required"
        for r in report.recommendations:
            if r.finding_id == f.id:
                action = r.action
                break

        sev = f.severity.value
        if sev == "high":
            sev = "critical"

        results.append({
            "severity": sev,
            "title": f.title,
            "detail": f.conclusion,
            "action": action,
        })

    return results


# --- Observation collectors ---

def _observe_init_containers(details, raw, report):
    """Detect failed init containers."""
    ns = details["namespace"]
    pod = details["name"]

    init_statuses = raw.get("status", {}).get(
        "initContainerStatuses", []
    )
    for cs in init_statuses:
        name = cs.get("name", "")
        state = cs.get("state", {})

        # Waiting init container
        if "waiting" in state:
            reason = state["waiting"].get("reason", "")
            msg = state["waiting"].get("message", "")
            obs_id = _add_obs(
                report,
                ObservationSource.RESOURCE,
                f"Init container {name} waiting: "
                f"{reason}",
                metadata={
                    "reason": reason or "waiting",
                    "container": name,
                    "message": msg,
                    "init": True,
                },
                raw_ref=(
                    "status.initContainerStatuses[]"
                    ".state.waiting"
                ),
            )
            _emit_finding(
                report,
                finding_type=FindingType.INIT_CONTAINER_FAILED,
                fid=f"init_failed_{name}",
                title=f"Init container failed: {name}",
                conclusion=(
                    f"Init container {name} stuck: "
                    f"{reason or 'waiting'}"
                ),
                evidence_ids=[obs_id],
                ns=ns, pod=pod, container=name,
            )

        # Terminated with error
        elif "terminated" in state:
            exit_code = state["terminated"].get(
                "exitCode", 0
            )
            reason = state["terminated"].get(
                "reason", ""
            )
            if exit_code != 0:
                obs_id = _add_obs(
                    report,
                    ObservationSource.RESOURCE,
                    f"Init container {name} exited "
                    f"with code {exit_code}",
                    metadata={
                        "reason": reason or f"exit_{exit_code}",
                        "exit_code": exit_code,
                        "container": name,
                        "init": True,
                    },
                    raw_ref=(
                        "status.initContainerStatuses[]"
                        ".state.terminated"
                    ),
                )
                _emit_finding(
                    report,
                    finding_type=FindingType.INIT_CONTAINER_FAILED,
                    fid=f"init_failed_{name}",
                    title=(
                        f"Init container failed: {name}"
                    ),
                    conclusion=(
                        f"Init container {name} exited "
                        f"with code {exit_code}"
                    ),
                    evidence_ids=[obs_id],
                    ns=ns, pod=pod, container=name,
                )

def _observe_containers(details, raw, report):
    ns = details["namespace"]
    pod = details["name"]

    for c in details["containers"]:
        if c["state"] == "waiting":
            _check_waiting(c, raw, ns, pod, report)
        elif c["state"] == "terminated":
            _check_terminated(c, raw, ns, pod, report)

        if c["restarts"] >= 5:
            obs_id = _add_obs(
                report,
                ObservationSource.RESOURCE,
                f"Container {c['name']} has "
                f"{c['restarts']} restarts",
                metadata={
                    "container": c["name"],
                    "restarts": c["restarts"],
                },
                raw_ref=(
                    "status.containerStatuses[]"
                    ".restartCount"
                ),
            )
            _emit_finding(
                report,
                finding_type=FindingType.HIGH_RESTARTS,
                fid=f"high_restarts_{c['name']}",
                title=f"High restart count: {c['name']}",
                conclusion=(
                    f"{c['restarts']} restarts — "
                    f"container is crash-looping"
                ),
                evidence_ids=[obs_id],
                ns=ns, pod=pod, container=c["name"],
            )
        elif c["restarts"] >= 2:
            obs_id = _add_obs(
                report,
                ObservationSource.RESOURCE,
                f"Container {c['name']} has "
                f"{c['restarts']} restarts",
                metadata={
                    "container": c["name"],
                    "restarts": c["restarts"],
                },
            )
            _emit_finding(
                report,
                finding_type=FindingType.RESTART_SPIKE,
                fid=f"restart_spike_{c['name']}",
                title=f"Restart spike: {c['name']}",
                conclusion=f"{c['restarts']} restarts",
                evidence_ids=[obs_id],
                ns=ns, pod=pod, container=c["name"],
            )


def _check_waiting(container, raw, ns, pod, report):
    statuses = raw["status"].get(
        "containerStatuses", []
    )
    for cs in statuses:
        if cs["name"] != container["name"]:
            continue
        waiting = cs.get("state", {}).get("waiting", {})
        reason = waiting.get("reason", "")
        msg = waiting.get("message", "")
        name = container["name"]

        if reason == "CrashLoopBackOff":
            obs_id = _add_obs(
                report,
                ObservationSource.RESOURCE,
                f"Container {name} in CrashLoopBackOff",
                metadata={
                    "reason": reason,
                    "container": name,
                    "message": msg,
                },
                raw_ref=(
                    "status.containerStatuses[]"
                    ".state.waiting"
                ),
            )
            _emit_finding(
                report,
                finding_type=FindingType.CRASH_LOOP,
                fid=f"crashloop_{name}",
                title=f"CrashLoopBackOff: {name}",
                conclusion=(
                    "Container keeps crashing and "
                    "restarting"
                ),
                evidence_ids=[obs_id],
                ns=ns, pod=pod, container=name,
            )

        elif reason == "ImagePullBackOff":
            obs_id = _add_obs(
                report,
                ObservationSource.RESOURCE,
                f"Cannot pull image: "
                f"{container['image']}",
                metadata={
                    "reason": reason,
                    "image": container["image"],
                    "container": name,
                },
                raw_ref=(
                    "status.containerStatuses[]"
                    ".state.waiting"
                ),
            )
            _emit_finding(
                report,
                finding_type=FindingType.IMAGE_PULL_ERROR,
                fid=f"image_pull_{name}",
                title=f"ImagePullBackOff: {name}",
                conclusion=(
                    f"Cannot pull image: "
                    f"{container['image']}"
                ),
                evidence_ids=[obs_id],
                ns=ns, pod=pod, container=name,
            )

        elif reason == "CreateContainerConfigError":
            obs_id = _add_obs(
                report,
                ObservationSource.CONFIG,
                f"Container config error: "
                f"{msg or reason}",
                metadata={
                    "reason": reason,
                    "container": name,
                    "message": msg,
                },
                raw_ref=(
                    "status.containerStatuses[]"
                    ".state.waiting"
                ),
            )
            _emit_finding(
                report,
                finding_type=FindingType.CONFIG_ERROR,
                fid=f"config_error_{name}",
                title=f"Config error: {name}",
                conclusion=(
                    "Container config is invalid"
                ),
                evidence_ids=[obs_id],
                ns=ns, pod=pod, container=name,
            )

        elif reason:
            obs_id = _add_obs(
                report,
                ObservationSource.RESOURCE,
                f"Container {name} waiting: {reason}",
                metadata={
                    "reason": reason,
                    "container": name,
                },
            )
            _emit_finding(
                report,
                finding_type=FindingType.CONTAINER_WAITING,
                fid=f"waiting_{name}",
                title=f"Waiting: {name}",
                conclusion=f"Reason: {reason}",
                evidence_ids=[obs_id],
                ns=ns, pod=pod, container=name,
            )


def _check_terminated(container, raw, ns, pod, report):
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
        name = container["name"]

        if reason == "OOMKilled":
            obs_id = _add_obs(
                report,
                ObservationSource.RESOURCE,
                f"Container {name} OOMKilled",
                metadata={
                    "reason": "OOMKilled",
                    "exit_code": 137,
                    "container": name,
                },
                raw_ref=(
                    "status.containerStatuses[]"
                    ".state.terminated"
                ),
            )
            _emit_finding(
                report,
                finding_type=FindingType.OOM_KILL,
                fid=f"oom_{name}",
                title=f"OOMKilled: {name}",
                conclusion=(
                    "Container exceeded memory limit "
                    "and was killed by kernel"
                ),
                evidence_ids=[obs_id],
                ns=ns, pod=pod, container=name,
            )

        elif exit_code != 0:
            obs_id = _add_obs(
                report,
                ObservationSource.RESOURCE,
                f"Container {name} exited with "
                f"code {exit_code}",
                metadata={
                    "reason": reason,
                    "exit_code": exit_code,
                    "container": name,
                },
                raw_ref=(
                    "status.containerStatuses[]"
                    ".state.terminated"
                ),
            )
            _emit_finding(
                report,
                finding_type=FindingType.EXIT_NONZERO,
                fid=f"exit_{exit_code}_{name}",
                title=(
                    f"Exit code {exit_code}: {name}"
                ),
                conclusion=(
                    f"Terminated: "
                    f"{reason or 'unknown'}"
                ),
                evidence_ids=[obs_id],
                ns=ns, pod=pod, container=name,
            )


def _observe_probes(details, report):
    ns = details["namespace"]
    pod = details["name"]
    for c in details["containers"]:
        if not c["readiness"] and not c["liveness"]:
            obs_id = _add_obs(
                report,
                ObservationSource.CONFIG,
                f"Container {c['name']} has no probes",
                metadata={"container": c["name"]},
                raw_ref="spec.containers[].livenessProbe",
            )
            _emit_finding(
                report,
                finding_type=FindingType.NO_PROBES,
                fid=f"no_probes_{c['name']}",
                title=f"No probes: {c['name']}",
                conclusion=(
                    "No liveness or readiness probe "
                    "configured"
                ),
                evidence_ids=[obs_id],
                ns=ns, pod=pod, container=c["name"],
                severity_override=Severity.INFO,
            )


def _observe_events(events, report):
    event_type_map = {
        "FailedScheduling": FindingType.FAILED_SCHEDULING,
        "FailedMount": FindingType.FAILED_MOUNT,
        "Unhealthy": FindingType.PROBE_FAILING,
        "BackOff": FindingType.CRASH_LOOP,
        "Evicted": FindingType.EVICTED,
        "NodeNotReady": FindingType.NODE_PRESSURE,
        "NodeHasDiskPressure": FindingType.NODE_PRESSURE,
        "NodeHasMemoryPressure": FindingType.NODE_PRESSURE,
        "FailedCreatePodSandBox": FindingType.DNS_FAILURE,
        "NetworkNotReady": FindingType.NETWORK_POLICY_BLOCKED,
        "FailedAttachVolume": FindingType.PVC_PENDING,
        "ProvisioningFailed": FindingType.PVC_PENDING,
        "ExceededQuota": FindingType.RESOURCE_QUOTA_EXCEEDED,
        "Forbidden": FindingType.RBAC_DENIED,
    }

    ns = ""
    pod = ""
    if report.target:
        ns = report.target.namespace
        pod = report.target.name

    seen_reasons = set()
    for ev in events:
        if ev["type"] != "Warning":
            continue
        reason = ev["reason"]
        if reason in seen_reasons:
            continue
        seen_reasons.add(reason)

        obs_id = _add_obs(
            report,
            ObservationSource.EVENT,
            ev["message"][:200],
            metadata={
                "reason": reason,
                "type": ev["type"],
                "count": ev.get("count", 1),
            },
        )

        ft = event_type_map.get(
            reason, FindingType.WARNING_EVENT
        )
        sev = (
            Severity.CRITICAL
            if reason in event_type_map
            else Severity.MEDIUM
        )

        # Detect missing secret/configmap from message
        msg_lower = ev["message"].lower()
        if ft == FindingType.WARNING_EVENT:
            if "secret" in msg_lower and (
                "not found" in msg_lower
                or "missing" in msg_lower
            ):
                ft = FindingType.MISSING_SECRET
                sev = Severity.CRITICAL
            elif "configmap" in msg_lower and (
                "not found" in msg_lower
                or "missing" in msg_lower
            ):
                ft = FindingType.MISSING_CONFIGMAP
                sev = Severity.CRITICAL
            elif (
                "forbidden" in msg_lower
                or "cannot" in msg_lower
                and "permission" in msg_lower
            ):
                ft = FindingType.RBAC_DENIED
                sev = Severity.CRITICAL

        # Split probe types from Unhealthy events
        if ft == FindingType.PROBE_FAILING:
            if "liveness" in msg_lower:
                ft = FindingType.LIVENESS_FAILING
            elif "readiness" in msg_lower:
                ft = FindingType.READINESS_FAILING

        _emit_finding(
            report,
            finding_type=ft,
            fid=f"event_{reason.lower()}",
            title=(
                f"Event: {reason}"
                if reason in event_type_map
                else f"Warning event: {reason}"
            ),
            conclusion=ev["message"][:100],
            evidence_ids=[obs_id],
            ns=ns, pod=pod,
            severity_override=sev,
        )


def _observe_logs(logs, report):
    if not logs:
        return

    ns = report.target.namespace
    pod = report.target.name

    lines = logs.strip().split("\n")
    error_keywords = [
        "error", "fatal", "exception",
        "panic", "oom", "killed",
    ]
    error_lines = [
        l for l in lines
        if any(kw in l.lower() for kw in error_keywords)
    ]

    if not error_lines:
        return

    obs_id = _add_obs(
        report,
        ObservationSource.LOG,
        f"{len(error_lines)} error lines in "
        f"last {len(lines)} log lines",
        metadata={
            "error_count": len(error_lines),
            "total_lines": len(lines),
            "sample": error_lines[:3],
        },
    )

    if len(error_lines) >= 10:
        _emit_finding(
            report,
            finding_type=FindingType.HIGH_ERROR_RATE,
            fid="high_error_rate",
            title="High error rate in logs",
            conclusion=(
                f"{len(error_lines)} error lines in "
                f"last {len(lines)} lines"
            ),
            evidence_ids=[obs_id],
            ns=ns, pod=pod,
            severity_override=Severity.CRITICAL,
        )
    else:
        _emit_finding(
            report,
            finding_type=FindingType.ERRORS_IN_LOGS,
            fid="errors_in_logs",
            title="Errors in logs",
            conclusion=(
                f"{len(error_lines)} error lines found"
            ),
            evidence_ids=[obs_id],
            ns=ns, pod=pod,
            severity_override=Severity.MEDIUM,
        )


def _observe_resources(details, report):
    ns = details["namespace"]
    pod = details["name"]
    for c in details["containers"]:
        resources = c["resources"]
        if not resources.get("requests") and \
                not resources.get("limits"):
            obs_id = _add_obs(
                report,
                ObservationSource.CONFIG,
                f"Container {c['name']} has no "
                f"resource limits",
                metadata={"container": c["name"]},
                raw_ref="spec.containers[].resources",
            )
            _emit_finding(
                report,
                finding_type=FindingType.NO_RESOURCE_LIMITS,
                fid=f"no_limits_{c['name']}",
                title=(
                    f"No resource limits: {c['name']}"
                ),
                conclusion=(
                    "No CPU/memory requests or "
                    "limits set"
                ),
                evidence_ids=[obs_id],
                ns=ns, pod=pod, container=c["name"],
                severity_override=Severity.MEDIUM,
            )


def _observe_phase(details, report):
    ns = details["namespace"]
    pod = details["name"]

    if details["phase"] == "Pending":
        obs_id = _add_obs(
            report,
            ObservationSource.RESOURCE,
            "Pod phase is Pending",
            metadata={"phase": "Pending"},
            raw_ref="status.phase",
        )
        _emit_finding(
            report,
            finding_type=FindingType.PENDING_POD,
            fid="pending_pod",
            title="Pod stuck in Pending",
            conclusion="Pod cannot be scheduled",
            evidence_ids=[obs_id],
            ns=ns, pod=pod,
        )
    elif details["phase"] == "Failed":
        # Check for eviction
        obs_id = _add_obs(
            report,
            ObservationSource.RESOURCE,
            "Pod phase is Failed",
            metadata={"phase": "Failed"},
            raw_ref="status.phase",
        )
        _emit_finding(
            report,
            finding_type=FindingType.EVICTED,
            fid="evicted_pod",
            title="Pod evicted or failed",
            conclusion="Pod was evicted or terminated",
            evidence_ids=[obs_id],
            ns=ns, pod=pod,
        )


# --- Causal linking ---

def _link_related_findings(report):
    """Link findings that have causal relationships."""
    finding_ids = {f.id for f in report.findings}
    findings_map = {f.id: f for f in report.findings}

    # OOM → probe failures
    oom_ids = [
        fid for fid in finding_ids
        if fid.startswith("oom_")
    ]
    probe_ids = [
        fid for fid in finding_ids
        if fid.startswith("event_unhealthy")
        or fid.startswith("event_liveness")
        or fid.startswith("event_readiness")
    ]
    for pid in probe_ids:
        for oid in oom_ids:
            findings_map[pid].related_finding_ids.append(
                oid
            )

    # CrashLoop → high restarts
    crash_ids = [
        fid for fid in finding_ids
        if fid.startswith("crashloop_")
    ]
    restart_ids = [
        fid for fid in finding_ids
        if fid.startswith("high_restarts_")
    ]
    for rid in restart_ids:
        for cid in crash_ids:
            findings_map[rid].related_finding_ids.append(
                cid
            )

    # Init container failed → pending/waiting
    init_ids = [
        fid for fid in finding_ids
        if fid.startswith("init_failed_")
    ]
    waiting_ids = [
        fid for fid in finding_ids
        if fid.startswith("waiting_")
        or fid == "pending_pod"
    ]
    for wid in waiting_ids:
        for iid in init_ids:
            findings_map[wid].related_finding_ids.append(
                iid
            )

    # Liveness failing → restarts
    liveness_ids = [
        fid for fid in finding_ids
        if "liveness" in fid
    ]
    for rid in restart_ids:
        for lid in liveness_ids:
            findings_map[rid].related_finding_ids.append(
                lid
            )


# --- Execution plans from catalog ---

def _generate_plans(report):
    """Generate execution plans from registry catalog."""
    ns = report.target.namespace
    pod = report.target.name

    # Group findings by type
    type_findings = {}
    for f in report.findings:
        if f.finding_type:
            ft = f.finding_type
            type_findings.setdefault(ft, []).append(f.id)

    for ft_value, fids in type_findings.items():
        try:
            ft = FindingType(ft_value)
        except ValueError:
            continue

        catalog = get_remediation(ft)
        if not catalog:
            continue

        # Only generate plan for critical/high findings
        severities = [
            f.severity for f in report.findings
            if f.id in fids
        ]
        if not any(
            s in (Severity.CRITICAL, Severity.HIGH)
            for s in severities
        ):
            continue

        plan_steps = [
            step.replace("{pod}", pod).replace(
                "{ns}", ns
            )
            for step in catalog["plan_steps"]
        ]

        report.execution_plans.append(ExecutionPlan(
            id=f"plan_{ft_value}",
            finding_ids=fids,
            steps=plan_steps,
            risk=catalog["plan_risk"],
            reversible=catalog["reversible"],
        ))


# --- Core finding emitter ---

def _emit_finding(report, finding_type, fid, title,
                  conclusion, evidence_ids, ns="",
                  pod="", container="",
                  severity_override=None):
    """
    Emit a finding and its recommendations from
    the registry catalog.
    """
    catalog = get_remediation(finding_type)

    # Determine severity from catalog or override
    severity = severity_override or Severity.CRITICAL

    # Build verification commands
    verify = _build_verify_commands(
        finding_type, ns, pod, container
    )

    report.findings.append(Finding(
        id=fid,
        severity=severity,
        title=title,
        conclusion=conclusion,
        finding_type=finding_type.value,
        evidence_ids=evidence_ids,
        verification_commands=verify,
    ))

    # Pull recommendations from catalog
    if catalog:
        for i, rec in enumerate(
            catalog["recommendations"]
        ):
            report.recommendations.append(Recommendation(
                id=f"rec_{fid}_{i}",
                finding_id=fid,
                action=rec["action"],
                risk=rec["risk"],
            ))


def _build_verify_commands(finding_type, ns, pod,
                           container=""):
    """Build verification commands per finding type."""
    cmds = []
    base = f"kubectl -n {ns}" if ns else "kubectl"

    if finding_type == FindingType.OOM_KILL:
        cmds = [
            f"{base} describe pod {pod}"
            f" | grep -A5 'Last State'",
            f"{base} top pod {pod}",
        ]
    elif finding_type == FindingType.CRASH_LOOP:
        c = f" -c {container}" if container else ""
        cmds = [
            f"{base} describe pod {pod}"
            f" | grep -A5 'State'",
            f"{base} logs {pod}{c} --previous",
        ]
    elif finding_type == FindingType.IMAGE_PULL_ERROR:
        cmds = [
            f"{base} describe pod {pod}"
            f" | grep -A3 'Events'",
            f"{base} get secret | grep docker",
        ]
    elif finding_type == FindingType.CONFIG_ERROR:
        cmds = [
            f"{base} describe pod {pod}"
            f" | grep -A10 'Events'",
            f"{base} get configmap",
            f"{base} get secret",
        ]
    elif finding_type == FindingType.PENDING_POD:
        cmds = [
            f"{base} describe pod {pod}",
            "kubectl get nodes -o wide",
        ]
    elif finding_type == FindingType.HIGH_RESTARTS:
        c = f" -c {container}" if container else ""
        cmds = [
            f"{base} describe pod {pod}"
            f" | grep -A3 'Restart Count'",
            f"{base} logs {pod}{c} --previous",
        ]
    elif finding_type in (
        FindingType.HIGH_ERROR_RATE,
        FindingType.ERRORS_IN_LOGS,
    ):
        cmds = [
            f"{base} logs {pod} --tail=100"
            f" | grep -i error",
        ]
    elif finding_type == FindingType.EXIT_NONZERO:
        c = f" -c {container}" if container else ""
        cmds = [
            f"{base} logs {pod}{c} --previous",
        ]

    return cmds


# --- Helpers ---

def _add_obs(report, source, message, metadata=None,
             raw_ref="", timestamp=None):
    """Add an observation with stable ID and return it."""
    reason = (metadata or {}).get(
        "reason", message[:30]
    )
    container = (metadata or {}).get("container", "")
    obs_id = make_observation_id(
        source, reason, container
    )
    # Deduplicate
    if any(o.id == obs_id for o in report.observations):
        return obs_id
    report.observations.append(Observation(
        id=obs_id,
        source=source,
        message=message,
        timestamp=timestamp,
        metadata=metadata or {},
        raw_ref=raw_ref,
    ))
    return obs_id
