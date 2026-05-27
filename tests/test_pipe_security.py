import pytest
import os
from core.pipe import apply_pipe, split_pipe

def test_allowed_commands():
    input_text = "line1\nline2\nmatch\nline3\n"

    # Test grep
    assert apply_pipe(input_text, "grep match").strip() == "match"

    # Test wc
    assert apply_pipe(input_text, "wc -l").strip().split()[0] == "4"

    # Test chain: grep | wc
    assert apply_pipe(input_text, "grep match | wc -l").strip().split()[0] == "1"

def test_blocked_commands():
    input_text = "some data"

    # Test blocked command
    result = apply_pipe(input_text, "ls /")
    assert "Error: Command 'ls' is not allowed" in result

    # Test injection attempt
    target_file = "/tmp/sentinel_should_not_exist"
    if os.path.exists(target_file):
        os.remove(target_file)

    result = apply_pipe(input_text, f"grep match; touch {target_file}")

    assert not os.path.exists(target_file)

    # Test pipe injection
    result = apply_pipe(input_text, f"grep match | touch {target_file}")
    assert "Error: Command 'touch' is not allowed" in result
    assert not os.path.exists(target_file)

def test_split_pipe_quoting():
    # Pipe inside quotes should not be split
    cmd, pipe = split_pipe("echo 'hello | world'")
    assert pipe is None
    assert cmd == "echo 'hello | world'"

    # Real pipe after quotes
    cmd, pipe = split_pipe("echo 'hello | world' | grep hello")
    assert cmd == "echo 'hello | world'"
    assert pipe == "grep hello"

def test_grep_no_match():
    # Grep returning 1 should not be an error, just empty output
    input_text = "line1\nline2"
    assert apply_pipe(input_text, "grep nomatch") == ""

def test_awk_allowed():
    input_text = "field1 field2"
    assert apply_pipe(input_text, "awk '{print $1}'").strip() == "field1"
