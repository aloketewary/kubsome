"""
Pipe — support shell-style piping for command output.

Examples:
  pods | grep customer
  events | grep Warning | head -5
  pods | wc -l
"""

import subprocess
import shlex
from io import StringIO
from rich.console import Console

# Allowed commands for security to prevent arbitrary command execution
ALLOWED_COMMANDS = {
    "grep", "head", "tail", "sort", "wc", "uniq",
    "awk", "sed", "cut", "tr", "cat"
}


def split_pipe(user_input):
    """
    Split input into (kubsome_command, pipe_commands) securely,
    respecting quotes to avoid splitting on pipes inside strings.
    """
    if "|" not in user_input:
        return user_input, None

    in_double = False
    in_single = False
    for i, char in enumerate(user_input):
        if char == '"' and not in_single:
            in_double = not in_double
        elif char == "'" and not in_double:
            in_single = not in_single
        elif char == "|" and not in_double and not in_single:
            cmd = user_input[:i].strip()
            pipe_chain = user_input[i+1:].strip()
            return cmd, pipe_chain

    return user_input, None


def apply_pipe(output_text, pipe_chain):
    """
    Run output through a chain of allowed shell pipe commands securely.
    Uses shell=False and a whitelist to prevent command injection.
    """
    if not pipe_chain or not output_text:
        return output_text

    # 1. Split pipe chain into individual command strings respecting quotes
    cmds_strs = []
    current = ""
    in_double = False
    in_single = False
    for char in pipe_chain:
        if char == '"' and not in_single:
            in_double = not in_double
            current += char
        elif char == "'" and not in_double:
            in_single = not in_single
            current += char
        elif char == "|" and not in_double and not in_single:
            cmds_strs.append(current.strip())
            current = ""
        else:
            current += char
    cmds_strs.append(current.strip())
    cmds_strs = [c for c in cmds_strs if c]

    if not cmds_strs:
        return output_text

    current_input = output_text

    for cmd_str in cmds_strs:
        try:
            args = shlex.split(cmd_str)
        except ValueError:
            return f"Pipe Error: Unbalanced quotes in command '{cmd_str}'"

        if not args:
            continue

        if args[0] not in ALLOWED_COMMANDS:
            return f"Error: Command '{args[0]}' is not allowed in pipes."

        try:
            # Execute each command in the pipe sequentially.
            # This avoids complex Popen chains and deadlock risks with large inputs.
            result = subprocess.run(
                args,
                input=current_input,
                capture_output=True,
                text=True,
                shell=False
            )

            # Handle grep exit code 1 (no match) as successful empty result
            if result.returncode != 0:
                if args[0] == "grep" and result.returncode == 1:
                    current_input = ""
                    continue
                # For other errors, return stderr
                return result.stderr if result.stderr else f"Pipe command failed with exit code {result.returncode}"

            current_input = result.stdout

        except Exception as e:
            return f"Pipe Error executing '{args[0]}': {str(e)}"

    return current_input


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
