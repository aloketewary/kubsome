import pytest
from core.pipe import apply_pipe, split_pipe

def test_apply_pipe_allowed_commands():
    output = "line1\nline2\nline3\n"

    # Test grep
    assert apply_pipe(output, "grep line2") == "line2\n"

    # Test head
    assert apply_pipe(output, "head -n 1") == "line1\n"

    # Test wc
    assert apply_pipe(output, "wc -l").strip() == "3"

def test_apply_pipe_blocked_commands():
    output = "some data"

    # Test blocked command
    result = apply_pipe(output, "ls /")
    assert "Error: Command 'ls' is not allowed" in result

    # Test command injection attempt
    result = apply_pipe(output, "grep foo; touch /tmp/jules_pwned")
    # shlex.split will treat 'grep foo; touch /tmp/jules_pwned' as ['grep', 'foo;', 'touch', '/tmp/jules_pwned']
    # Our hardened implementation blocks this because of positional argument limits (expected 1, got 3)
    assert "Error: Too many positional arguments" in result

def test_apply_pipe_chain_injection():
    output = "some data"

    # Test pipe chain injection
    result = apply_pipe(output, "grep foo | touch /tmp/jules_pwned")
    assert "Error: Command 'touch' is not allowed" in result

def test_split_pipe_quotes():
    # Pipe inside quotes should not be split
    cmd, pipe = split_pipe("pods | grep 'quoted | pipe'")
    assert cmd == "pods"
    assert pipe == "grep 'quoted | pipe'"

    cmd, pipe = split_pipe("awk -F'|' '{print $1}'")
    assert pipe is None
    assert cmd == "awk -F'|' '{print $1}'"

def test_apply_pipe_complex_chain():
    output = "apple\nbanana\ncherry\ndate"

    # Chain: grep a | sort -r | head -n 2
    # grep a -> apple, banana, date
    # sort -r -> date, banana, apple
    # head -n 2 -> date, banana
    result = apply_pipe(output, "grep a | sort -r | head -n 2")
    assert result == "date\nbanana\n"

def test_grep_no_match():
    output = "hello world"
    assert apply_pipe(output, "grep non-existent") == ""
