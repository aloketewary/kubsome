"""
Tests for KubeEasy core modules.
Run: pytest tests/
"""

import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))


def test_nlp_parsing():
    from core.ai.nlp import parse_natural_language

    assert parse_natural_language("scale payment to 5") == "scale payment 5"
    assert parse_natural_language("show me the logs for auth") == "logs auth"
    assert parse_natural_language("restart the gateway") == "restart gateway"
    assert parse_natural_language("list all pods") == "pods"
    assert parse_natural_language("show events") == "events"
    assert parse_natural_language("get nodes") == "nodes"
    assert parse_natural_language("diagnose payment") == "diagnose payment"
    assert parse_natural_language("rollback billing") == "rollback billing"
    assert parse_natural_language("random gibberish xyz") is None


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
