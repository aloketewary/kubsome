"""
Pipe — support shell-style piping for command output.

Examples:
  pods | grep customer
  events | grep Warning | head -5
  pods | wc -l
"""

import subprocess
from io import StringIO
from rich.console import Console


def split_pipe(user_input):
    """
    Split input into (kubsome_command, pipe_commands).
    Returns (command, pipe_chain) where pipe_chain is None if no pipe.
    """
    # Don't split pipes inside quotes
    if "|" not in user_input:
        return user_input, None

    # Split on first pipe only to get kubsome command
    parts = user_input.split("|", 1)
    cmd = parts[0].strip()
    pipe_chain = parts[1].strip() if len(parts) > 1 else None

    return cmd, pipe_chain


def apply_pipe(output_text, pipe_chain):
    """
    Run output through shell pipe commands (grep, head, tail, sort, wc, etc.).
    Returns filtered text.
    """
    if not pipe_chain or not output_text:
        return output_text

    try:
        result = subprocess.run(
            pipe_chain,
            shell=True,
            input=output_text,
            capture_output=True,
            text=True,
        )
        return result.stdout if result.stdout else result.stderr
    except Exception:
        return output_text


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
