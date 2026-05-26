"""
Pipe — support shell-style piping for command output.

Examples:
  pods | grep customer
  events | grep Warning | head -5
  pods | wc -l
"""

import subprocess
import shlex
import sys
from io import StringIO
from rich.console import Console

# Whitelist of safe utilities allowed in pipe chains
ALLOWED_PIPE_CMDS = {
    "grep", "head", "tail", "sort", "wc", "uniq", "awk", "sed", "cut", "tr", "cat"
}


def split_pipe(user_input):
    """
    Split input into (kubsome_command, pipe_commands).
    Returns (command, pipe_chain) where pipe_chain is None if no pipe.
    """
    # Don't split pipes inside quotes
    if "|" not in user_input:
        return user_input, None

    # Handle pipes while respecting quotes
    in_quote = False
    quote_char = None
    for i, c in enumerate(user_input):
        if c in ("'", '"'):
            if not in_quote:
                in_quote = True
                quote_char = c
            elif c == quote_char:
                in_quote = False
                quote_char = None
        elif c == "|" and not in_quote:
            cmd = user_input[:i].strip()
            pipe_chain = user_input[i+1:].strip()
            return cmd, pipe_chain

    return user_input, None


def _split_pipe_chain(pipe_chain):
    """Split pipe chain into stages, respecting quotes."""
    stages = []
    current_cmd_str = ""
    in_quote = False
    quote_char = None

    for c in pipe_chain:
        if c in ("'", '"'):
            if not in_quote:
                in_quote = True
                quote_char = c
            elif c == quote_char:
                in_quote = False
                quote_char = None
            current_cmd_str += c
        elif c == "|" and not in_quote:
            if current_cmd_str.strip():
                stages.append(shlex.split(current_cmd_str))
            current_cmd_str = ""
        else:
            current_cmd_str += c

    if current_cmd_str.strip():
        stages.append(shlex.split(current_cmd_str))

    return stages


def apply_pipe(output_text, pipe_chain):
    """
    Run output through shell pipe commands (grep, head, tail, sort, wc, etc.).
    Returns filtered text. Use list-based execution to prevent command injection.
    """
    if not pipe_chain or not output_text:
        return output_text

    try:
        stages = _split_pipe_chain(pipe_chain)
        current_input = output_text

        for args in stages:
            if not args:
                continue

            cmd = args[0]
            # Security check: only allow whitelisted commands
            if cmd not in ALLOWED_PIPE_CMDS:
                print(f"[security] Blocked unsafe pipe command: {cmd}", file=sys.stderr)
                return "" # Return empty to indicate failure/blocked

            # Execute stage without shell=True
            process = subprocess.Popen(
                args,
                stdin=subprocess.PIPE,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                shell=False
            )
            stdout, stderr = process.communicate(input=current_input)

            # Special case for grep: exit code 1 means no match, return empty string
            if cmd == "grep" and process.returncode == 1:
                return ""

            # If a stage fails otherwise, we return empty or error
            if process.returncode != 0:
                # If there's stderr, it might be a real error (e.g. invalid regex)
                return stderr if stderr else ""

            current_input = stdout

        return current_input
    except Exception:
        return ""


def capture_rich_output(func, *args, **kwargs):
    """
    Capture Rich console output from a function as plain text.
    """
    buffer = StringIO()
    capture_console = Console(file=buffer, force_terminal=False, width=200)

    # Temporarily swap the console in common modules
    import core.dispatcher as dispatcher
    import core.executor as executor

    orig_dispatch_console = dispatcher.console
    orig_exec_console = executor.console

    dispatcher.console = capture_console
    executor.console = capture_console

    try:
        func(*args, **kwargs)
    finally:
        dispatcher.console = orig_dispatch_console
        executor.console = orig_exec_console

    return buffer.getvalue()
