"""
Tests for Kubsome core modules.
Run: pytest tests/
"""

import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))


def test_nlp_parsing():
    from core.nlp.matcher import parse_query
    from core.nlp.actions import map_to_command

    def parse_to_cmd(query):
        parsed = parse_query(query)
        if not parsed:
            return None
        return map_to_command(parsed)

    assert parse_to_cmd("scale payment to 5") == "scale payment 5"
    assert parse_to_cmd("show me the logs for auth") == "logs auth"
    assert parse_to_cmd("restart the gateway") == "restart gateway"
    assert parse_to_cmd("list all pods") == {"type": "pods_table"}
    assert parse_to_cmd("show events") == {"type": "events"}
    assert parse_to_cmd("get nodes") == {"type": "nodes"}
    assert parse_to_cmd("diagnose payment") == "diagnose payment"
    assert parse_to_cmd("rollback billing") == "rollback billing"
    assert parse_to_cmd("random gibberish xyz") is None


def test_suggest_command():
    from core.ai.suggest import suggest_command

    assert suggest_command("pds") == "pods"
    assert suggest_command("overvew") == "overview"
    assert suggest_command("evnts") == "events"
    assert suggest_command("diagose") == "diagnose"


def test_alias_resolution():
    from core.config import resolve_alias

    config = {
        "aliases": {
            "p": "pods",
            "o": "overview",
            "l": "logs",
            "d": "diagnose",
        }
    }

    assert resolve_alias("p", config) == "pods"
    assert resolve_alias("o", config) == "overview"
    assert resolve_alias("l payment", config) == "logs payment"
    assert resolve_alias("d customer", config) == "diagnose customer"
    assert resolve_alias("unknown", config) == "unknown"


def test_bookmarks():
    from core.bookmarks import (
        add_bookmark, get_bookmark,
        remove_bookmark, list_bookmarks
    )

    add_bookmark("test-bm", "pods watch")
    assert get_bookmark("test-bm") == "pods watch"

    bmarks = list_bookmarks()
    assert any(b["name"] == "test-bm" for b in bmarks)

    remove_bookmark("test-bm")
    assert get_bookmark("test-bm") is None


def test_generate_manifest():
    from core.ai.generator import generate_manifest

    yaml = generate_manifest(
        "deployment", "test-app", "default"
    )
    assert "test-app" in yaml
    assert "kind: Deployment" in yaml
    assert "replicas" in yaml

    yaml = generate_manifest(
        "service", "test-svc", "default"
    )
    assert "test-svc" in yaml
    assert "kind: Service" in yaml


def test_explain_rules():
    from core.ai.explain import explain

    result = explain("CrashLoopBackOff")
    assert "CrashLoopBackOff" in result["title"]
    assert "content" in result

    result = explain("OOMKilled")
    assert "OOM" in result["title"]

    result = explain("Pending")
    assert "Pending" in result["title"]


def test_health_bar():
    from core.overview_formatter import health_bar

    bar = health_bar(10, 2, 1)
    assert "█" in bar


def test_severity_detection():
    from core.formatter import get_severity

    pod_healthy = {"status": "Running", "restarts": 0}
    assert get_severity(pod_healthy) == "healthy"

    pod_warning = {"status": "Running", "restarts": 3}
    assert get_severity(pod_warning) == "warning"

    pod_critical = {"status": "CrashLoopBackOff", "restarts": 10}
    assert get_severity(pod_critical) == "critical"


def test_registry_completeness():
    """Every FindingType must have remediation and explanation."""
    from core.diagnostics.registry import (
        FindingType,
        get_remediation,
        get_explanation,
    )

    skip = {FindingType.HEALTHY, FindingType.WARNING_EVENT}

    for ft in FindingType:
        if ft in skip:
            continue
        rem = get_remediation(ft)
        assert rem is not None, (
            f"Missing remediation for {ft.name}"
        )
        assert rem["recommendations"], (
            f"Empty recommendations for {ft.name}"
        )
        exp = get_explanation(ft)
        assert exp, (
            f"Missing explanation for {ft.name}"
        )


def test_investigate_report_structure():
    """Investigation report validates with proper evidence chain."""
    from core.diagnostics.engine import investigate

    data = {
        "details": {
            "name": "test-pod",
            "namespace": "default",
            "phase": "Running",
            "containers": [{
                "name": "app",
                "image": "nginx:latest",
                "state": "terminated",
                "restarts": 6,
                "ready": False,
                "liveness": None,
                "readiness": None,
                "resources": {},
            }],
        },
        "events": [{
            "type": "Warning",
            "reason": "Unhealthy",
            "message": "Readiness probe failed",
            "count": 5,
        }],
        "logs": "error: something broke\n" * 12,
        "raw": {
            "metadata": {"annotations": {}},
            "status": {
                "containerStatuses": [{
                    "name": "app",
                    "state": {
                        "terminated": {
                            "reason": "OOMKilled",
                            "exitCode": 137,
                        }
                    },
                    "ready": False,
                    "restartCount": 6,
                }]
            },
        },
    }

    report = investigate(data)

    # Report validates (no exception)
    report.validate()

    # Has findings with evidence
    assert report.findings
    assert report.observations
    assert all(
        f.evidence_ids or f.id == "healthy"
        for f in report.findings
    )

    # Has finding types from registry
    assert any(
        f.finding_type == "oom_kill"
        for f in report.findings
    )

    # Has recommendations from catalog
    assert report.recommendations

    # Has execution plans
    assert report.execution_plans

    # Causal links present
    probe_findings = [
        f for f in report.findings
        if "unhealthy" in f.id
    ]
    if probe_findings:
        assert probe_findings[0].related_finding_ids


def test_snapshot_store():
    """Snapshots save, load, and timeline work."""
    import tempfile
    import os
    from datetime import datetime, timezone, timedelta
    from core.diagnostics import snapshots
    from core.diagnostics.models import (
        InvestigationReport, ResourceRef, Observation,
        Finding, Recommendation, Severity, Risk,
        ObservationSource,
    )

    # Use temp dir
    orig = snapshots.SNAPSHOTS_DIR
    tmp = tempfile.mkdtemp()
    snapshots.SNAPSHOTS_DIR = tmp

    try:
        target = ResourceRef(
            kind="Pod", name="payment-api",
            namespace="payments", context="test"
        )

        # Create and save two reports
        r1 = InvestigationReport(
            target=target,
            generated_at=datetime(
                2026, 6, 11, 10, 1, 0,
                tzinfo=timezone.utc
            ),
            observations=[Observation(
                id="obs_resource_oomkilled_app",
                source=ObservationSource.RESOURCE,
                message="OOMKilled",
            )],
            findings=[Finding(
                id="oom_app",
                severity=Severity.CRITICAL,
                title="OOMKilled: app",
                conclusion="Memory exceeded",
                finding_type="oom_kill",
                evidence_ids=[
                    "obs_resource_oomkilled_app"
                ],
            )],
            recommendations=[Recommendation(
                id="rec_oom_app_0",
                finding_id="oom_app",
                action="Increase memory",
                risk=Risk.LOW,
            )],
        )

        r2 = InvestigationReport(
            target=target,
            generated_at=datetime(
                2026, 6, 11, 10, 5, 0,
                tzinfo=timezone.utc
            ),
            observations=[Observation(
                id="obs_resource_crashloopbackoff_app",
                source=ObservationSource.RESOURCE,
                message="CrashLoop",
            )],
            findings=[Finding(
                id="crashloop_app",
                severity=Severity.CRITICAL,
                title="CrashLoop: app",
                conclusion="Keeps crashing",
                finding_type="crash_loop",
                evidence_ids=[
                    "obs_resource_crashloopbackoff_app"
                ],
            )],
            recommendations=[Recommendation(
                id="rec_crash_0",
                finding_id="crashloop_app",
                action="Check logs",
                risk=Risk.LOW,
            )],
        )

        # Save
        p1 = snapshots.save(r1)
        p2 = snapshots.save(r2)
        assert os.path.exists(p1)
        assert os.path.exists(p2)

        # Load
        loaded = snapshots.load(p1)
        assert loaded.target.name == "payment-api"
        assert loaded.findings[0].id == "oom_app"
        assert loaded.findings[0].severity == Severity.CRITICAL

        # Latest
        lat = snapshots.latest(target)
        assert lat.findings[0].id == "crashloop_app"

        # History
        hist = snapshots.history(target)
        assert len(hist) == 2
        assert hist[0].findings[0].id == "crashloop_app"

        # Timeline
        tl = snapshots.timeline(target)
        assert len(tl) == 2
        assert tl[0]["finding_type"] == "oom_kill"
        assert tl[1]["finding_type"] == "crash_loop"

        # Between
        start = datetime(
            2026, 6, 11, 10, 0, 0,
            tzinfo=timezone.utc
        )
        end = datetime(
            2026, 6, 11, 10, 3, 0,
            tzinfo=timezone.utc
        )
        subset = snapshots.between(target, start, end)
        assert len(subset) == 1
        assert subset[0].findings[0].id == "oom_app"

    finally:
        snapshots.SNAPSHOTS_DIR = orig
        import shutil
        shutil.rmtree(tmp, ignore_errors=True)


def test_change_detection():
    """Change engine detects new, resolved, escalated."""
    from datetime import datetime, timezone
    from core.diagnostics.changes import diff_reports
    from core.diagnostics.models import (
        InvestigationReport, ResourceRef, Observation,
        Finding, Severity, ObservationSource,
    )

    target = ResourceRef(
        kind="Pod", name="payment-api",
        namespace="payments", context="test"
    )

    obs = Observation(
        id="obs_test", source=ObservationSource.RESOURCE,
        message="test",
    )

    prev = InvestigationReport(
        target=target,
        generated_at=datetime(
            2026, 6, 11, 10, 0, tzinfo=timezone.utc
        ),
        observations=[obs],
        findings=[
            Finding(
                id="oom_app", severity=Severity.MEDIUM,
                title="OOM", conclusion="OOM",
                finding_type="oom_kill",
                evidence_ids=["obs_test"],
            ),
            Finding(
                id="image_pull", severity=Severity.CRITICAL,
                title="ImagePull", conclusion="Pull error",
                finding_type="image_pull_error",
                evidence_ids=["obs_test"],
            ),
        ],
    )

    curr = InvestigationReport(
        target=target,
        generated_at=datetime(
            2026, 6, 11, 10, 5, tzinfo=timezone.utc
        ),
        observations=[obs],
        findings=[
            Finding(
                id="oom_app", severity=Severity.CRITICAL,
                title="OOM", conclusion="OOM worse",
                finding_type="oom_kill",
                evidence_ids=["obs_test"],
            ),
            Finding(
                id="crash_app", severity=Severity.CRITICAL,
                title="Crash", conclusion="CrashLoop",
                finding_type="crash_loop",
                evidence_ids=["obs_test"],
            ),
        ],
    )

    diff = diff_reports(curr, prev)

    # crash_loop is new
    assert len(diff.new_findings) == 1
    assert diff.new_findings[0].finding_type == "crash_loop"

    # image_pull_error resolved
    assert len(diff.resolved_findings) == 1
    assert diff.resolved_findings[0].finding_type == "image_pull_error"

    # oom_kill escalated (MEDIUM → CRITICAL)
    assert len(diff.escalated_findings) == 1
    assert diff.escalated_findings[0].finding_type == "oom_kill"

    # No persistent
    assert len(diff.persistent_findings) == 0

    # has_changes
    assert diff.has_changes

    # Summary
    assert "+1 new" in diff.summary
    assert "-1 resolved" in diff.summary
    assert "↑1 escalated" in diff.summary


def test_change_detection_no_previous():
    """First investigation — all findings are new."""
    from datetime import datetime, timezone
    from core.diagnostics.changes import diff_reports
    from core.diagnostics.models import (
        InvestigationReport, ResourceRef, Observation,
        Finding, Severity, ObservationSource,
    )

    target = ResourceRef(
        kind="Pod", name="test",
        namespace="default", context="test"
    )
    obs = Observation(
        id="obs_x", source=ObservationSource.RESOURCE,
        message="x",
    )

    curr = InvestigationReport(
        target=target,
        generated_at=datetime(
            2026, 6, 11, 10, 0, tzinfo=timezone.utc
        ),
        observations=[obs],
        findings=[
            Finding(
                id="f1", severity=Severity.HIGH,
                title="F1", conclusion="C1",
                finding_type="oom_kill",
                evidence_ids=["obs_x"],
            ),
        ],
    )

    diff = diff_reports(curr, None)
    assert len(diff.new_findings) == 1
    assert diff.previous_at is None


def test_narrative_explanation():
    """AI layer produces narrative from report + diff."""
    from datetime import datetime, timezone
    from core.diagnostics.narrative import explain
    from core.diagnostics.changes import diff_reports
    from core.diagnostics.models import (
        InvestigationReport, ResourceRef, Observation,
        Finding, Severity, ObservationSource,
    )

    target = ResourceRef(
        kind="Pod", name="payment-api",
        namespace="payments", context="test"
    )
    obs = Observation(
        id="obs_test", source=ObservationSource.RESOURCE,
        message="test",
    )

    prev = InvestigationReport(
        target=target,
        generated_at=datetime(
            2026, 6, 11, 10, 0, tzinfo=timezone.utc
        ),
        observations=[obs],
        findings=[Finding(
            id="healthy", severity=Severity.INFO,
            title="No issues", conclusion="Healthy",
            finding_type="healthy",
            evidence_ids=["obs_test"],
        )],
    )

    curr = InvestigationReport(
        target=target,
        generated_at=datetime(
            2026, 6, 11, 10, 5, tzinfo=timezone.utc
        ),
        observations=[obs],
        findings=[
            Finding(
                id="oom_app", severity=Severity.CRITICAL,
                title="OOMKilled: app",
                conclusion="Memory limit exceeded",
                finding_type="oom_kill",
                evidence_ids=["obs_test"],
            ),
            Finding(
                id="event_unhealthy",
                severity=Severity.CRITICAL,
                title="Probe failing",
                conclusion="Readiness probe failed",
                finding_type="probe_failing",
                evidence_ids=["obs_test"],
                related_finding_ids=["oom_app"],
            ),
            Finding(
                id="crashloop_app",
                severity=Severity.CRITICAL,
                title="CrashLoopBackOff: app",
                conclusion="Container keeps crashing",
                finding_type="crash_loop",
                evidence_ids=["obs_test"],
            ),
        ],
    )

    diff = diff_reports(curr, prev)
    narrative = explain(curr, previous=prev, diff=diff)

    # Summary mentions target and unhealthy
    assert "payment-api" in narrative.summary
    assert "unhealthy" in narrative.summary

    # Sequence exists and OOM comes before crash
    assert len(narrative.likely_sequence) == 3
    oom_idx = next(
        i for i, s in enumerate(narrative.likely_sequence)
        if "OOM" in s
    )
    crash_idx = next(
        i for i, s in enumerate(narrative.likely_sequence)
        if "Crash" in s
    )
    assert oom_idx < crash_idx

    # Priority has critical items
    assert narrative.priority_findings
    assert "CRITICAL" in narrative.priority_findings[0]

    # Change summary shows new findings
    assert "New:" in narrative.change_summary


def test_narrative_healthy():
    """Healthy pod gets simple narrative."""
    from datetime import datetime, timezone
    from core.diagnostics.narrative import explain
    from core.diagnostics.models import (
        InvestigationReport, ResourceRef, Finding,
        Severity,
    )

    target = ResourceRef(
        kind="Pod", name="healthy-pod",
        namespace="default", context="test"
    )

    report = InvestigationReport(
        target=target,
        generated_at=datetime(
            2026, 6, 11, 10, 0, tzinfo=timezone.utc
        ),
        findings=[Finding(
            id="healthy", severity=Severity.INFO,
            title="No issues", conclusion="Healthy",
        )],
    )

    narrative = explain(report)
    assert "healthy" in narrative.summary.lower()
    assert not narrative.likely_sequence


def test_incident_auto_create():
    """Incidents auto-create from critical finding clusters."""
    import tempfile
    import shutil
    from datetime import datetime, timezone
    from core.diagnostics import incidents
    from core.diagnostics.models import (
        InvestigationReport, ResourceRef, Observation,
        Finding, Severity, ObservationSource,
    )

    # Use temp dir
    orig = incidents.INCIDENTS_DIR
    tmp = tempfile.mkdtemp()
    incidents.INCIDENTS_DIR = tmp

    try:
        target = ResourceRef(
            kind="Pod", name="payment-api",
            namespace="payments", context="test"
        )
        obs = Observation(
            id="obs_test", source=ObservationSource.RESOURCE,
            message="test",
        )

        report = InvestigationReport(
            target=target,
            generated_at=datetime(
                2026, 6, 11, 10, 2, 0,
                tzinfo=timezone.utc
            ),
            observations=[obs],
            findings=[
                Finding(
                    id="oom_app",
                    severity=Severity.CRITICAL,
                    title="OOMKilled: app",
                    conclusion="Memory exceeded",
                    finding_type="oom_kill",
                    evidence_ids=["obs_test"],
                ),
                Finding(
                    id="crashloop_app",
                    severity=Severity.CRITICAL,
                    title="CrashLoop: app",
                    conclusion="Keeps crashing",
                    finding_type="crash_loop",
                    evidence_ids=["obs_test"],
                ),
            ],
        )

        # Auto-create
        inc = incidents.check_auto_create(report)
        assert inc is not None
        assert inc.status == incidents.IncidentStatus.ACTIVE
        assert "payment-api" in inc.title
        assert len(inc.timeline) >= 3  # opened + 2 findings
        assert "oom_kill" in inc.root_findings
        assert "crash_loop" in inc.root_findings

        # Persist and reload
        loaded = incidents.load_incident(inc.id)
        assert loaded is not None
        assert loaded.title == inc.title
        assert len(loaded.timeline) == len(inc.timeline)

        # Resolve
        loaded.resolve("Increased memory limit")
        incidents.save_incident(loaded)

        resolved = incidents.load_incident(inc.id)
        assert resolved.status == incidents.IncidentStatus.RESOLVED
        assert resolved.resolution_summary == "Increased memory limit"
        assert resolved.resolved_at is not None

    finally:
        incidents.INCIDENTS_DIR = orig
        shutil.rmtree(tmp, ignore_errors=True)


def test_incident_enrichment():
    """Existing incident gets enriched with new findings."""
    import tempfile
    import shutil
    from datetime import datetime, timezone
    from core.diagnostics import incidents
    from core.diagnostics.models import (
        InvestigationReport, ResourceRef, Observation,
        Finding, Severity, ObservationSource,
    )

    orig = incidents.INCIDENTS_DIR
    tmp = tempfile.mkdtemp()
    incidents.INCIDENTS_DIR = tmp

    try:
        target = ResourceRef(
            kind="Pod", name="payment-api",
            namespace="payments", context="test"
        )
        obs = Observation(
            id="obs_test", source=ObservationSource.RESOURCE,
            message="test",
        )

        # First report creates incident
        r1 = InvestigationReport(
            target=target,
            generated_at=datetime(
                2026, 6, 11, 10, 0, tzinfo=timezone.utc
            ),
            observations=[obs],
            findings=[
                Finding(
                    id="oom", severity=Severity.CRITICAL,
                    title="OOM", conclusion="OOM",
                    finding_type="oom_kill",
                    evidence_ids=["obs_test"],
                ),
                Finding(
                    id="crash", severity=Severity.CRITICAL,
                    title="Crash", conclusion="Crash",
                    finding_type="crash_loop",
                    evidence_ids=["obs_test"],
                ),
            ],
        )
        inc1 = incidents.check_auto_create(r1)
        assert inc1 is not None
        original_events = len(inc1.timeline)

        # Second report enriches existing incident
        r2 = InvestigationReport(
            target=target,
            generated_at=datetime(
                2026, 6, 11, 10, 5, tzinfo=timezone.utc
            ),
            observations=[obs],
            findings=[
                Finding(
                    id="oom", severity=Severity.CRITICAL,
                    title="OOM", conclusion="OOM",
                    finding_type="oom_kill",
                    evidence_ids=["obs_test"],
                ),
                Finding(
                    id="probe", severity=Severity.CRITICAL,
                    title="Probe", conclusion="Probe fail",
                    finding_type="probe_failing",
                    evidence_ids=["obs_test"],
                ),
            ],
        )
        inc2 = incidents.check_auto_create(r2)

        # Same incident, enriched
        assert inc2.id == inc1.id
        assert "probe_failing" in inc2.root_findings
        assert len(inc2.timeline) > original_events

    finally:
        incidents.INCIDENTS_DIR = orig
        shutil.rmtree(tmp, ignore_errors=True)


def test_alert_enrichment():
    """Alert enrichment attaches findings and narrative."""
    from datetime import datetime, timezone
    from core.diagnostics.alerts import (
        Alert, enrich_from_report, format_enrichment,
    )
    from core.diagnostics.models import (
        InvestigationReport, ResourceRef, Observation,
        Finding, Recommendation, Severity, Risk,
        ObservationSource,
    )

    alert = Alert(
        source="prometheus",
        name="PodRestartHigh",
        resource_name="payment-api",
        namespace="payments",
        message="payment-api pod restart count high",
        fired_at=datetime(
            2026, 6, 11, 10, 5, tzinfo=timezone.utc
        ),
    )

    target = ResourceRef(
        kind="Pod", name="payment-api",
        namespace="payments", context="test"
    )
    obs = Observation(
        id="obs_test", source=ObservationSource.RESOURCE,
        message="OOMKilled",
    )

    report = InvestigationReport(
        target=target,
        generated_at=datetime(
            2026, 6, 11, 10, 5, tzinfo=timezone.utc
        ),
        observations=[obs],
        findings=[
            Finding(
                id="oom_app",
                severity=Severity.CRITICAL,
                title="OOMKilled: app",
                conclusion="Memory limit exceeded",
                finding_type="oom_kill",
                evidence_ids=["obs_test"],
            ),
            Finding(
                id="crash_app",
                severity=Severity.CRITICAL,
                title="CrashLoop: app",
                conclusion="Keeps crashing",
                finding_type="crash_loop",
                evidence_ids=["obs_test"],
            ),
        ],
        recommendations=[
            Recommendation(
                id="rec_0",
                finding_id="oom_app",
                action="Increase memory limit",
                risk=Risk.LOW,
            ),
        ],
    )

    enriched = enrich_from_report(alert, report)

    # Has context
    assert enriched.has_context
    assert len(enriched.top_findings) == 2
    assert "OOMKilled" in enriched.top_findings[0]
    assert enriched.recommended_action == "Increase memory limit"
    assert enriched.action_risk == "low"

    # Narrative attached
    assert enriched.narrative is not None
    assert enriched.narrative.likely_sequence

    # Format output
    text = format_enrichment(enriched)
    assert "PodRestartHigh" in text
    assert "Investigation:" in text
    assert "Recommended Action:" in text
    assert "Increase memory limit" in text


def test_new_finding_types_detection():
    """Engine detects new finding types from events/state."""
    from core.diagnostics.engine import investigate

    # Eviction via Failed phase
    data = {
        "details": {
            "name": "worker-pod",
            "namespace": "default",
            "phase": "Failed",
            "containers": [{
                "name": "app",
                "image": "app:v1",
                "state": "terminated",
                "restarts": 0,
                "ready": False,
                "liveness": "HTTP /health:8080",
                "readiness": "HTTP /ready:8080",
                "resources": {"requests": {"memory": "256Mi"}},
            }],
        },
        "events": [{
            "type": "Warning",
            "reason": "Evicted",
            "message": "The node was low on resource: memory",
            "count": 1,
        }],
        "logs": "",
        "raw": {
            "metadata": {"annotations": {}},
            "status": {
                "phase": "Failed",
                "containerStatuses": [{
                    "name": "app",
                    "state": {
                        "terminated": {
                            "reason": "Evicted",
                            "exitCode": 0,
                        }
                    },
                    "ready": False,
                    "restartCount": 0,
                }],
            },
        },
    }

    report = investigate(data)
    report.validate()

    finding_types = [f.finding_type for f in report.findings]
    assert "evicted" in finding_types

    # Missing secret from event message
    data2 = {
        "details": {
            "name": "api-pod",
            "namespace": "prod",
            "phase": "Running",
            "containers": [{
                "name": "api",
                "image": "api:v2",
                "state": "running",
                "restarts": 0,
                "ready": True,
                "liveness": "HTTP /health:8080",
                "readiness": "HTTP /ready:8080",
                "resources": {"requests": {"cpu": "100m"}},
            }],
        },
        "events": [{
            "type": "Warning",
            "reason": "FailedCreate",
            "message": "Error creating: secret db-password not found",
            "count": 3,
        }],
        "logs": "",
        "raw": {
            "metadata": {"annotations": {}},
            "status": {
                "containerStatuses": [{
                    "name": "api",
                    "state": {"running": {}},
                    "ready": True,
                    "restartCount": 0,
                }],
            },
        },
    }

    report2 = investigate(data2)
    report2.validate()

    finding_types2 = [f.finding_type for f in report2.findings]
    assert "missing_secret" in finding_types2


def test_init_container_detection():
    """Engine detects failed init containers."""
    from core.diagnostics.engine import investigate

    data = {
        "details": {
            "name": "api-pod",
            "namespace": "default",
            "phase": "Pending",
            "containers": [{
                "name": "app",
                "image": "app:v1",
                "state": "waiting",
                "restarts": 0,
                "ready": False,
                "liveness": "HTTP /health:8080",
                "readiness": "HTTP /ready:8080",
                "resources": {"requests": {"cpu": "100m"}},
            }],
        },
        "events": [],
        "logs": "",
        "raw": {
            "metadata": {"annotations": {}},
            "status": {
                "phase": "Pending",
                "initContainerStatuses": [{
                    "name": "db-migration",
                    "state": {
                        "terminated": {
                            "reason": "Error",
                            "exitCode": 1,
                        }
                    },
                    "ready": False,
                    "restartCount": 3,
                }],
                "containerStatuses": [{
                    "name": "app",
                    "state": {
                        "waiting": {
                            "reason": "PodInitializing",
                        }
                    },
                    "ready": False,
                    "restartCount": 0,
                }],
            },
        },
    }

    report = investigate(data)
    report.validate()

    finding_types = [f.finding_type for f in report.findings]
    assert "init_container_failed" in finding_types

    # Init failure should link to waiting container
    init_f = next(
        f for f in report.findings
        if f.finding_type == "init_container_failed"
    )
    assert init_f.evidence_ids


def test_probe_type_splitting():
    """Engine splits Unhealthy into liveness vs readiness."""
    from core.diagnostics.engine import investigate

    data = {
        "details": {
            "name": "web-pod",
            "namespace": "default",
            "phase": "Running",
            "containers": [{
                "name": "web",
                "image": "nginx:latest",
                "state": "running",
                "restarts": 3,
                "ready": True,
                "liveness": "HTTP /health:80",
                "readiness": "HTTP /ready:80",
                "resources": {"requests": {"cpu": "50m"}},
            }],
        },
        "events": [
            {
                "type": "Warning",
                "reason": "Unhealthy",
                "message": "Liveness probe failed: connection refused",
                "count": 5,
            },
            {
                "type": "Warning",
                "reason": "Unhealthy",
                "message": "Readiness probe failed: HTTP 503",
                "count": 12,
            },
        ],
        "logs": "",
        "raw": {
            "metadata": {"annotations": {}},
            "status": {
                "containerStatuses": [{
                    "name": "web",
                    "state": {"running": {}},
                    "ready": True,
                    "restartCount": 3,
                }],
            },
        },
    }

    report = investigate(data)
    report.validate()

    finding_types = [f.finding_type for f in report.findings]
    # Should detect liveness (first Unhealthy event)
    assert "liveness_failing" in finding_types


def test_rbac_detection():
    """Engine detects RBAC denied from events."""
    from core.diagnostics.engine import investigate

    data = {
        "details": {
            "name": "controller-pod",
            "namespace": "kube-system",
            "phase": "Running",
            "containers": [{
                "name": "controller",
                "image": "ctrl:v1",
                "state": "running",
                "restarts": 0,
                "ready": True,
                "liveness": "HTTP /health:8080",
                "readiness": "HTTP /ready:8080",
                "resources": {"requests": {"cpu": "100m"}},
            }],
        },
        "events": [{
            "type": "Warning",
            "reason": "Forbidden",
            "message": "cannot list pods in namespace default",
            "count": 10,
        }],
        "logs": "error: forbidden: cannot list pods\n" * 5,
        "raw": {
            "metadata": {"annotations": {}},
            "status": {
                "containerStatuses": [{
                    "name": "controller",
                    "state": {"running": {}},
                    "ready": True,
                    "restartCount": 0,
                }],
            },
        },
    }

    report = investigate(data)
    report.validate()

    finding_types = [f.finding_type for f in report.findings]
    assert "rbac_denied" in finding_types


def test_service_investigation():
    """Service investigation detects cross-pod patterns."""
    from core.diagnostics.correlation import (
        investigate_service, Confidence,
    )

    # Simulate correlated log output from 3 pods
    correlated_data = {
        "pods": [
            "payment-api-abc12",
            "payment-worker-def34",
            "redis-master-0",
        ],
        "entries": [
            # Redis crashes first
            {
                "pod": "redis",
                "pod_full": "redis-master-0",
                "timestamp": "2026-06-11T10:01:00",
                "message": "fatal: out of memory",
                "level": "error",
            },
            # Payment API sees timeout
            {
                "pod": "payment-api",
                "pod_full": "payment-api-abc12",
                "timestamp": "2026-06-11T10:01:05",
                "message": "error: redis:6379 connection timeout",
                "level": "error",
            },
            {
                "pod": "payment-api",
                "pod_full": "payment-api-abc12",
                "timestamp": "2026-06-11T10:01:06",
                "message": "error: redis:6379 ETIMEDOUT",
                "level": "error",
            },
            {
                "pod": "payment-api",
                "pod_full": "payment-api-abc12",
                "timestamp": "2026-06-11T10:01:07",
                "message": "error: redis connection refused",
                "level": "error",
            },
            {
                "pod": "payment-api",
                "pod_full": "payment-api-abc12",
                "timestamp": "2026-06-11T10:01:08",
                "message": "error: redis timeout on GET",
                "level": "error",
            },
            {
                "pod": "payment-api",
                "pod_full": "payment-api-abc12",
                "timestamp": "2026-06-11T10:01:09",
                "message": "error: redis timeout on SET",
                "level": "error",
            },
            # Worker also fails
            {
                "pod": "payment-worker",
                "pod_full": "payment-worker-def34",
                "timestamp": "2026-06-11T10:01:10",
                "message": "error: redis connection refused",
                "level": "error",
            },
            {
                "pod": "payment-worker",
                "pod_full": "payment-worker-def34",
                "timestamp": "2026-06-11T10:01:11",
                "message": "error: job failed: redis unavailable",
                "level": "error",
            },
            {
                "pod": "payment-worker",
                "pod_full": "payment-worker-def34",
                "timestamp": "2026-06-11T10:01:12",
                "message": "error: redis timeout",
                "level": "error",
            },
            {
                "pod": "payment-worker",
                "pod_full": "payment-worker-def34",
                "timestamp": "2026-06-11T10:01:13",
                "message": "error: cannot connect to redis",
                "level": "error",
            },
            {
                "pod": "payment-worker",
                "pod_full": "payment-worker-def34",
                "timestamp": "2026-06-11T10:01:14",
                "message": "error: redis connection lost",
                "level": "error",
            },
        ],
        "total": 11,
    }

    report = investigate_service(correlated_data)
    report.validate()

    finding_types = [
        f.finding_type for f in report.findings
    ]

    # Should detect upstream dependency failure (redis)
    assert "upstream_dependency_failure" in finding_types

    # Should detect timeouts
    assert "downstream_timeout" in finding_types

    # Should detect cascading failure
    assert "cascading_failure" in finding_types

    # Should have observations from CORRELATED_LOG
    corr_obs = [
        o for o in report.observations
        if o.source.value == "correlated_log"
    ]
    assert corr_obs

    # Cross-service observations
    cross_obs = [
        o for o in report.observations
        if o.source.value == "cross_service_event"
    ]
    assert cross_obs

    # Affected pods tracked
    assert len(report.affected_pods) == 3

    # Child reports empty (none passed)
    assert report.child_reports == []


def test_evidence_strength_scoring():
    """Evidence strength scored correctly per finding."""
    from datetime import datetime, timezone
    from core.diagnostics.validation.evidence import (
        score_finding, score_report, EvidenceStrength,
    )
    from core.diagnostics.models import (
        InvestigationReport, ResourceRef, Observation,
        Finding, Severity, ObservationSource,
    )

    target = ResourceRef(
        kind="Pod", name="test",
        namespace="default", context=""
    )

    report = InvestigationReport(
        target=target,
        generated_at=datetime.now(timezone.utc),
        observations=[
            Observation(
                id="obs_event",
                source=ObservationSource.EVENT,
                message="event",
                verified=True,
            ),
            Observation(
                id="obs_resource",
                source=ObservationSource.RESOURCE,
                message="resource",
                verified=True,
            ),
            Observation(
                id="obs_log",
                source=ObservationSource.LOG,
                message="log",
                verified=True,
            ),
        ],
        findings=[
            # Strong: event + resource (weight 6, all verified)
            Finding(
                id="f_strong",
                severity=Severity.CRITICAL,
                title="Strong",
                conclusion="Strong evidence",
                finding_type="oom_kill",
                evidence_ids=["obs_event", "obs_resource"],
            ),
            # Medium: log only (weight 2)
            Finding(
                id="f_medium",
                severity=Severity.MEDIUM,
                title="Medium",
                conclusion="Medium evidence",
                finding_type="errors_in_logs",
                evidence_ids=["obs_log"],
            ),
            # Weak: no evidence
            Finding(
                id="f_weak",
                severity=Severity.LOW,
                title="Weak",
                conclusion="No evidence",
                finding_type="warning_event",
                evidence_ids=[],
            ),
        ],
    )

    assert score_finding(
        report.findings[0], report
    ) == EvidenceStrength.STRONG
    assert score_finding(
        report.findings[1], report
    ) == EvidenceStrength.MEDIUM
    assert score_finding(
        report.findings[2], report
    ) == EvidenceStrength.WEAK

    scores = score_report(report)
    assert scores["f_strong"] == EvidenceStrength.STRONG


def test_benchmark_with_corpus():
    """Benchmark runs engine against corpus entries."""
    from core.diagnostics.validation.benchmark import (
        run_benchmark,
    )
    from core.diagnostics.validation.corpus import (
        CorpusEntry,
    )

    corpus = [
        CorpusEntry(
            id="incident_001",
            description="OOM kill",
            input_data={
                "details": {
                    "name": "pod-a",
                    "namespace": "default",
                    "phase": "Running",
                    "containers": [{
                        "name": "app",
                        "image": "app:v1",
                        "state": "terminated",
                        "restarts": 6,
                        "ready": False,
                        "liveness": "HTTP /h:80",
                        "readiness": "HTTP /r:80",
                        "resources": {
                            "limits": {"memory": "512Mi"}
                        },
                    }],
                },
                "events": [],
                "logs": "",
                "raw": {
                    "metadata": {"annotations": {}},
                    "status": {
                        "containerStatuses": [{
                            "name": "app",
                            "state": {
                                "terminated": {
                                    "reason": "OOMKilled",
                                    "exitCode": 137,
                                }
                            },
                            "ready": False,
                            "restartCount": 6,
                        }],
                    },
                },
            },
            expected_findings=[
                {"finding_type": "oom_kill"},
                {"finding_type": "high_restarts"},
            ],
        ),
    ]

    result = run_benchmark(corpus)

    assert result["total"] == 1
    assert result["top1_accuracy"] == 1.0
    assert result["top3_accuracy"] == 1.0
    assert result["entries"][0]["misses"] == 0
