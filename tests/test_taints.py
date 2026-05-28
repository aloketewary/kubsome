"""Tests for kubectl taint feature."""

import json
import pytest
from unittest.mock import patch, MagicMock


# ─── Collector Tests ──────────────────────────────────────────────────────────

def test_collect_taints_parses_nodes():
    from core.collectors.taints import collect_taints
    from core.cache import invalidate

    invalidate()

    fake_output = json.dumps({
        "items": [
            {
                "metadata": {"name": "node-1"},
                "spec": {
                    "taints": [
                        {"key": "dedicated", "value": "gpu", "effect": "NoSchedule"},
                        {"key": "node.kubernetes.io/unschedulable", "value": "", "effect": "NoSchedule"},
                    ]
                },
            },
            {
                "metadata": {"name": "node-2"},
                "spec": {},
            },
        ]
    })

    mock = MagicMock()
    mock.returncode = 0
    mock.stdout = fake_output

    with patch("core.collectors.taints.subprocess.run", return_value=mock):
        result = collect_taints()

    assert len(result) == 2
    assert result[0]["node"] == "node-1"
    assert len(result[0]["taints"]) == 2
    assert result[0]["taints"][0]["key"] == "dedicated"
    assert result[0]["taints"][0]["value"] == "gpu"
    assert result[0]["taints"][0]["effect"] == "NoSchedule"
    assert result[1]["node"] == "node-2"
    assert result[1]["taints"] == []


def test_collect_taints_handles_failure():
    from core.collectors.taints import collect_taints
    from core.cache import invalidate

    invalidate()

    mock = MagicMock()
    mock.returncode = 1
    mock.stdout = ""

    with patch("core.collectors.taints.subprocess.run", return_value=mock):
        result = collect_taints()

    assert result == []


def test_apply_taint_success():
    from core.collectors.taints import apply_taint

    mock = MagicMock()
    mock.returncode = 0
    mock.stdout = "node/node-1 tainted"
    mock.stderr = ""

    with patch("core.collectors.taints.subprocess.run", return_value=mock) as run_mock:
        success, output = apply_taint("node-1", "key=val:NoSchedule")

    assert success is True
    assert "tainted" in output
    # Verify correct command was built
    args = run_mock.call_args[0][0]
    assert "taint" in args
    assert "nodes" in args
    assert "node-1" in args
    assert "key=val:NoSchedule" in args


def test_apply_taint_failure():
    from core.collectors.taints import apply_taint

    mock = MagicMock()
    mock.returncode = 1
    mock.stdout = ""
    mock.stderr = "error: node not found"

    with patch("core.collectors.taints.subprocess.run", return_value=mock):
        success, output = apply_taint("nonexistent", "key:NoSchedule")

    assert success is False


def test_remove_taint_appends_dash():
    from core.collectors.taints import remove_taint

    mock = MagicMock()
    mock.returncode = 0
    mock.stdout = "node/node-1 untainted"
    mock.stderr = ""

    with patch("core.collectors.taints.subprocess.run", return_value=mock) as run_mock:
        success, output = remove_taint("node-1", "key:NoSchedule")

    assert success is True
    # Should append "-" to the spec
    args = run_mock.call_args[0][0]
    assert "key:NoSchedule-" in args


def test_remove_taint_no_double_dash():
    from core.collectors.taints import remove_taint

    mock = MagicMock()
    mock.returncode = 0
    mock.stdout = "untainted"
    mock.stderr = ""

    with patch("core.collectors.taints.subprocess.run", return_value=mock) as run_mock:
        remove_taint("node-1", "key:NoSchedule-")

    args = run_mock.call_args[0][0]
    # Should not double the dash
    assert "key:NoSchedule-" in args
    assert "key:NoSchedule--" not in " ".join(args)


# ─── Command Resolver Tests ──────────────────────────────────────────────────

def test_command_taints_list():
    from core.commands import resolve_command

    result = resolve_command("taints")
    assert result == {"type": "taints_list"}


def test_command_taint_with_node():
    from core.commands import resolve_command

    with patch("core.commands.resolve_node_name", return_value=["node-1"]):
        with patch("core.selector.choose_node", return_value="node-1"):
            result = resolve_command("taint node-1 gpu=true:NoSchedule")

    assert result["type"] == "taint"
    assert result["node"] == "node-1"
    assert result["spec"] == "gpu=true:NoSchedule"


def test_command_untaint_with_node():
    from core.commands import resolve_command

    with patch("core.commands.resolve_node_name", return_value=["node-1"]):
        with patch("core.selector.choose_node", return_value="node-1"):
            result = resolve_command("untaint node-1 gpu:NoSchedule")

    assert result["type"] == "untaint"
    assert result["node"] == "node-1"
    assert result["spec"] == "gpu:NoSchedule"


# ─── Resolver Tests ──────────────────────────────────────────────────────────

def test_resolve_node_name():
    from core.resolver import resolve_node_name
    from core.cache import invalidate

    invalidate()

    mock = MagicMock()
    mock.returncode = 0
    mock.stdout = "node-alpha node-beta node-gamma"

    with patch("subprocess.run", return_value=mock):
        result = resolve_node_name("alpha")

    assert result == ["node-alpha"]


def test_resolve_node_name_short_query():
    from core.resolver import resolve_node_name

    result = resolve_node_name("n")
    assert result is None


# ─── Renderer Tests ──────────────────────────────────────────────────────────

def test_render_taints_no_taints(capsys):
    from core.renderers.taints_renderer import render_taints

    render_taints([
        {"node": "node-1", "taints": []},
        {"node": "node-2", "taints": []},
    ])
    # Should print success message (no exception)


def test_render_taints_with_data(capsys):
    from core.renderers.taints_renderer import render_taints

    render_taints([
        {
            "node": "node-1",
            "taints": [
                {"key": "dedicated", "value": "gpu", "effect": "NoSchedule"},
            ],
        },
    ])
    # Should render without error
