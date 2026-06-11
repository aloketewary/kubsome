"""
Service Investigation — correlates signals across multiple
pods to explain system-level failures.

Pipeline:
    Service → Pods → investigate() per pod
    → correlate_logs() → Cross-Service Observations
    → Deduplicate → Findings → Narrative

This is where Kubsome becomes an outage investigation tool.
"""

import re
from dataclasses import dataclass, field
from datetime import datetime, timezone

from core.diagnostics.models import (
    ServiceInvestigationReport,
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


# Confidence for inferred correlations
class Confidence:
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"


@dataclass
class Correlation:
    """An inferred relationship between events."""
    source_pod: str
    target_pod: str
    source_event: str
    target_event: str
    confidence: str
    lag_seconds: float = 0.0


# Patterns
_TIMEOUT_PATTERNS = [
    r"timeout", r"timed out", r"deadline exceeded",
    r"connection refused", r"connection reset",
    r"ETIMEDOUT", r"ECONNREFUSED", r"ECONNRESET",
    r"context deadline exceeded", r"i/o timeout",
]
_DEPENDENCY_PATTERNS = [
    r"redis.*(?:timeout|connection|refused)",
    r"postgres.*connection", r"mysql.*connection",
    r"database.*unavailable", r"upstream.*error",
    r"service.*unavailable", r"503", r"502",
    r"connect.*failed",
]
_COMPILED_TIMEOUT = [
    re.compile(p, re.IGNORECASE)
    for p in _TIMEOUT_PATTERNS
]
_COMPILED_DEPENDENCY = [
    re.compile(p, re.IGNORECASE)
    for p in _DEPENDENCY_PATTERNS
]


def investigate_service(correlated_data,
                        pod_reports=None):
    """
    Investigate a service by correlating logs from
    multiple pods and detecting cross-service patterns.

    Args:
        correlated_data: Output from correlate_logs()
        pod_reports: Optional per-pod InvestigationReports

    Returns:
        ServiceInvestigationReport
    """
    pods = correlated_data.get("pods", [])
    entries = correlated_data.get("entries", [])

    report = ServiceInvestigationReport(
        target=ResourceRef(
            kind="Service",
            name=_derive_service_name(pods),
            namespace="",
            context="",
        ),
        generated_at=datetime.now(timezone.utc),
        affected_pods=[
            ResourceRef(
                kind="Pod", name=p,
                namespace="", context=""
            )
            for p in pods
        ],
        child_reports=pod_reports or [],
    )

    correlations = []

    # Phase 1: Observe error patterns per pod
    pod_errors = _collect_pod_errors(entries, report)

    # Phase 2: Detect timeout patterns
    _detect_timeouts(entries, report)

    # Phase 3: Detect upstream failures
    _detect_upstream_failures(
        entries, pod_errors, report, correlations
    )

    # Phase 4: Detect cascading failure
    _detect_cascade(pod_errors, report, correlations)

    # Phase 5: Incorporate pod-level findings
    if pod_reports:
        _incorporate_pod_findings(pod_reports, report)

    # Phase 6: Deduplicate findings
    _deduplicate_findings(report)

    # Phase 7: Generate plans
    _generate_service_plans(report)

    if not report.findings:
        report.findings.append(Finding(
            id="healthy",
            severity=Severity.INFO,
            title="No cross-service issues detected",
            conclusion="Service appears healthy",
            finding_type=FindingType.HEALTHY.value,
        ))

    report.validate()
    return report


# --- Deduplication ---

def _deduplicate_findings(report):
    """
    Collapse duplicate findings across pods into one.
    Example: 3 pods with DOWNSTREAM_TIMEOUT → 1 finding.
    """
    seen_types = {}
    deduped = []
    removed_ids = set()

    for f in report.findings:
        if f.id == "healthy":
            deduped.append(f)
            continue

        key = f.finding_type or f.id
        if key in seen_types:
            # Merge evidence into existing finding
            existing = seen_types[key]
            existing.evidence_ids.extend(f.evidence_ids)
            # Update conclusion with count
            removed_ids.add(f.id)
        else:
            seen_types[key] = f
            deduped.append(f)

    report.findings = deduped

    # Remove recommendations for removed findings
    report.recommendations = [
        r for r in report.recommendations
        if r.finding_id not in removed_ids
    ]


# --- Observation collectors ---

def _collect_pod_errors(entries, report):
    """Collect error entries per pod."""
    pod_errors = {}
    for entry in entries:
        if entry["level"] != "error":
            continue
        pod = entry["pod"]
        pod_errors.setdefault(pod, []).append(entry)

    for pod, errors in pod_errors.items():
        if len(errors) >= 5:
            _add_service_obs(
                report,
                ObservationSource.CORRELATED_LOG,
                f"Pod {pod}: {len(errors)} errors "
                f"in correlated window",
                metadata={
                    "pod": pod,
                    "reason": f"error_cluster_{pod}",
                    "error_count": len(errors),
                    "sample": [
                        e["message"][:80]
                        for e in errors[:3]
                    ],
                    "first_ts": errors[0]["timestamp"],
                    "last_ts": errors[-1]["timestamp"],
                },
            )

    return pod_errors


def _detect_timeouts(entries, report):
    """Detect timeout patterns across correlated logs."""
    timeout_pods = {}
    for entry in entries:
        msg = entry["message"]
        if any(p.search(msg) for p in _COMPILED_TIMEOUT):
            pod = entry["pod"]
            timeout_pods.setdefault(pod, []).append(
                entry
            )

    for pod, timeouts in timeout_pods.items():
        if not timeouts:
            continue

        obs_id = _add_service_obs(
            report,
            ObservationSource.CORRELATED_LOG,
            f"Pod {pod}: {len(timeouts)} timeout events",
            metadata={
                "pod": pod,
                "reason": "timeout",
                "count": len(timeouts),
                "sample": [
                    t["message"][:80]
                    for t in timeouts[:3]
                ],
                "first_ts": timeouts[0]["timestamp"],
            },
        )

        _emit_service_finding(
            report,
            finding_type=FindingType.DOWNSTREAM_TIMEOUT,
            fid=f"timeout_{pod}",
            title=f"Timeout pattern: {pod}",
            conclusion=(
                f"{len(timeouts)} timeout events "
                f"detected in {pod}"
            ),
            evidence_ids=[obs_id],
        )


def _detect_upstream_failures(entries, pod_errors,
                              report, correlations):
    """Detect upstream dependency failures."""
    dependency_signals = {}
    for entry in entries:
        msg = entry["message"]
        if any(p.search(msg) for p in _COMPILED_DEPENDENCY):
            pod = entry["pod"]
            dependency_signals.setdefault(
                pod, []
            ).append(entry)

    for pod, signals in dependency_signals.items():
        if not signals:
            continue

        upstream = _extract_service_name(
            signals[0]["message"]
        )

        obs_id = _add_service_obs(
            report,
            ObservationSource.CROSS_SERVICE_EVENT,
            f"Pod {pod}: dependency failure "
            f"({upstream or 'unknown'})",
            metadata={
                "pod": pod,
                "reason": "upstream_dependency_failure",
                "upstream": upstream or "unknown",
                "count": len(signals),
                "sample": [
                    s["message"][:80]
                    for s in signals[:3]
                ],
                "first_ts": signals[0]["timestamp"],
            },
        )

        _emit_service_finding(
            report,
            finding_type=FindingType.UPSTREAM_DEPENDENCY_FAILURE,
            fid=f"upstream_{pod}_{upstream or 'unknown'}",
            title=(
                f"Upstream failure: "
                f"{upstream or 'unknown'} → {pod}"
            ),
            conclusion=(
                f"{pod} experiencing failures due to "
                f"upstream {upstream or 'unknown service'}"
            ),
            evidence_ids=[obs_id],
        )

        if upstream:
            correlations.append(Correlation(
                source_pod=upstream,
                target_pod=pod,
                source_event="service failure/restart",
                target_event=(
                    f"{len(signals)} dependency errors"
                ),
                confidence=Confidence.HIGH
                if len(signals) >= 5
                else Confidence.MEDIUM,
            ))


def _detect_cascade(pod_errors, report, correlations):
    """Detect cascading failure across pods."""
    if len(pod_errors) < 2:
        return

    pod_first_error = {}
    for pod, errors in pod_errors.items():
        if errors and errors[0]["timestamp"]:
            pod_first_error[pod] = (
                errors[0]["timestamp"]
            )

    if len(pod_first_error) < 2:
        return

    sorted_pods = sorted(
        pod_first_error.items(), key=lambda x: x[1]
    )

    first_ts = sorted_pods[0][1]
    last_ts = sorted_pods[-1][1]

    if first_ts and last_ts and first_ts != last_ts:
        affected = [p[0] for p in sorted_pods]

        obs_id = _add_service_obs(
            report,
            ObservationSource.CROSS_SERVICE_EVENT,
            f"Cascading errors across {len(affected)} "
            f"pods: {', '.join(affected)}",
            metadata={
                "reason": "cascading_failure",
                "affected_pods": affected,
                "first_failure_pod": sorted_pods[0][0],
                "first_ts": first_ts,
                "last_ts": last_ts,
            },
        )

        _emit_service_finding(
            report,
            finding_type=FindingType.CASCADING_FAILURE,
            fid="cascading_failure",
            title=(
                f"Cascading failure across "
                f"{len(affected)} pods"
            ),
            conclusion=(
                f"Errors spread from "
                f"{sorted_pods[0][0]} to "
                f"{len(affected)} pods"
            ),
            evidence_ids=[obs_id],
            severity_override=Severity.CRITICAL,
        )

        root = sorted_pods[0][0]
        for pod, _ in sorted_pods[1:]:
            correlations.append(Correlation(
                source_pod=root,
                target_pod=pod,
                source_event="first failure",
                target_event="subsequent failure",
                confidence=Confidence.HIGH,
            ))


def _incorporate_pod_findings(pod_reports, report):
    """Incorporate critical pod findings as observations."""
    for pod_report in pod_reports:
        for f in pod_report.findings:
            if f.severity != Severity.CRITICAL:
                continue
            if f.id == "healthy":
                continue

            _add_service_obs(
                report,
                ObservationSource.CROSS_SERVICE_EVENT,
                f"Pod {pod_report.target.name}: "
                f"{f.title}",
                metadata={
                    "reason": f.finding_type or f.title,
                    "pod": pod_report.target.name,
                    "finding_id": f.id,
                    "finding_type": f.finding_type,
                },
            )


def _generate_service_plans(report):
    """Generate plans from catalog."""
    type_findings = {}
    for f in report.findings:
        if f.finding_type:
            type_findings.setdefault(
                f.finding_type, []
            ).append(f.id)

    for ft_value, fids in type_findings.items():
        try:
            ft = FindingType(ft_value)
        except ValueError:
            continue

        catalog = get_remediation(ft)
        if not catalog:
            continue

        severities = [
            f.severity for f in report.findings
            if f.id in fids
        ]
        if not any(
            s in (Severity.CRITICAL, Severity.HIGH)
            for s in severities
        ):
            continue

        report.execution_plans.append(ExecutionPlan(
            id=f"plan_{ft_value}",
            finding_ids=fids,
            steps=catalog["plan_steps"],
            risk=catalog["plan_risk"],
            reversible=catalog["reversible"],
        ))


# --- Orchestrator (full pipeline) ---

def investigate_service_full(service_name, namespace):
    """
    Full service investigation pipeline:
    1. Discover pods by service selector
    2. investigate() each pod
    3. correlate_logs() across pods
    4. investigate_service() with correlation
    5. Generate narrative

    Returns ServiceInvestigationReport.
    """
    from core.collectors.log_correlation import (
        correlate_logs,
    )
    from core.diagnostics.engine import investigate
    from core.collectors.diagnosis import (
        collect_diagnosis,
    )
    from core.diagnostics.narrative import explain
    from core.context import context
    import subprocess
    import json

    # 1. Discover pods
    ctx = context.current_context
    ns = namespace or context.namespace
    cmd = [
        "kubectl", "--context", str(ctx or ""),
        "get", "endpoints", service_name,
        "-n", ns, "-o", "json",
    ]
    result = subprocess.run(
        cmd, capture_output=True, text=True
    )

    pod_names = []
    if result.returncode == 0:
        data = json.loads(result.stdout)
        for subset in data.get("subsets", []):
            for addr in subset.get("addresses", []):
                ref = addr.get("targetRef", {})
                if ref.get("kind") == "Pod":
                    pod_names.append(ref["name"])

    # Fallback: label selector
    if not pod_names:
        cmd = [
            "kubectl", "--context", str(ctx or ""),
            "get", "pods", "-n", ns,
            "-l", f"app={service_name}",
            "-o", "jsonpath={.items[*].metadata.name}",
        ]
        result = subprocess.run(
            cmd, capture_output=True, text=True
        )
        if result.returncode == 0 and result.stdout:
            pod_names = result.stdout.strip().split()

    if not pod_names:
        return None

    # 2. Investigate each pod
    pod_reports = []
    for pod in pod_names[:10]:  # Cap at 10
        data = collect_diagnosis(pod)
        if data:
            pod_report = investigate(data)
            if pod_report:
                pod_reports.append(pod_report)

    # 3. Correlate logs
    correlated = correlate_logs(pod_names, tail=100)

    # 4. Service investigation
    service_report = investigate_service(
        correlated, pod_reports=pod_reports
    )

    # Set proper namespace
    service_report.target.namespace = ns

    return service_report


# --- Helpers ---

def _add_service_obs(report, source, message,
                     metadata=None):
    """Add observation for service investigation."""
    reason = (metadata or {}).get(
        "reason", message[:30]
    )
    pod = (metadata or {}).get("pod", "")
    obs_id = make_observation_id(source, reason, pod)

    if any(o.id == obs_id for o in report.observations):
        return obs_id

    report.observations.append(Observation(
        id=obs_id,
        source=source,
        message=message,
        metadata=metadata or {},
    ))
    return obs_id


def _emit_service_finding(report, finding_type, fid,
                          title, conclusion, evidence_ids,
                          severity_override=None):
    """Emit a service-level finding."""
    catalog = get_remediation(finding_type)
    severity = severity_override or Severity.CRITICAL

    report.findings.append(Finding(
        id=fid,
        severity=severity,
        title=title,
        conclusion=conclusion,
        finding_type=finding_type.value,
        evidence_ids=evidence_ids,
    ))

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


def _derive_service_name(pods):
    """Derive service name from pod names."""
    if not pods:
        return "unknown"
    parts_list = [p.split("-") for p in pods]
    if not parts_list:
        return pods[0]

    common = []
    for i, part in enumerate(parts_list[0]):
        if all(
            len(p) > i and p[i] == part
            for p in parts_list
        ):
            common.append(part)
        else:
            break

    return "-".join(common) if common else pods[0]


def _extract_service_name(message):
    """Extract service/host name from error message."""
    patterns = [
        r"(redis|postgres|mysql|mongo|kafka|"
        r"rabbitmq|elasticsearch|memcached)",
        r"(\w+[-.]?\w+):\d+",
        r"service[/\s]+['\"]?(\w[\w-]+)",
        r"host[/\s]+['\"]?(\w[\w.-]+)",
    ]
    for pattern in patterns:
        match = re.search(
            pattern, message, re.IGNORECASE
        )
        if match:
            return match.group(1)
    return None
