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
    # Now it should be blocked because it's an absolute path.
    assert "Error: File paths are not allowed as pipe arguments" in result

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

def test_pipe_vulnerabilities_fixed():
    output = "test data"

    # 1. awk arbitrary command execution
    assert "Error: Command 'awk' is not allowed" in apply_pipe(output, "awk 'BEGIN {system(\"echo pwned\")}'")

    # 2. sed arbitrary command execution
    assert "Error: Command 'sed' is not allowed" in apply_pipe(output, "sed '1e echo pwned'")

    # 3. cat arbitrary file read
    res = apply_pipe(output, "cat /etc/hostname")
    assert "Error: Command 'cat' is not allowed" in res

    # 4. grep arbitrary file read (absolute path blocking)
    res = apply_pipe(output, "grep . /etc/hostname")
    assert "Error: File paths are not allowed as pipe arguments" in res

    # 5. grep arbitrary file read (relative path traversal)
    res = apply_pipe(output, "grep . ../../../etc/hostname")
    # It might be blocked by '..' check or 'File paths' check depending on which comes first
    # In my current implementation, shlex.split("grep . ../../../etc/hostname") -> ['grep', '.', '../../../etc/hostname']
    # The first arg after cmd is '.', which is an existing file (current dir).
    assert "Error" in res

    # 6. grep with pattern containing slashes (should be allowed if not a file)
    output_url = "Accessing https://google.com"
    res = apply_pipe(output_url, "grep https://")
    assert res.strip() == "Accessing https://google.com"

    # 7. grep with local file (should be blocked)
    import os
    with open("temp_test_secret.txt", "w") as f:
        f.write("sensitive info")
    try:
        res = apply_pipe(output, "grep info temp_test_secret.txt")
        assert "Error: File paths are not allowed as pipe arguments" in res
    finally:
        if os.path.exists("temp_test_secret.txt"):
            os.remove("temp_test_secret.txt")
