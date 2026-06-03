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

# Allowed commands for piping to prevent arbitrary command execution.
# Commands like 'awk', 'sed', and 'cat' are excluded as they can be
# abused for arbitrary command execution or unauthorized file access.
ALLOWED_COMMANDS = {
    "grep", "head", "tail", "sort", "wc", "uniq",
    "cut", "tr"
}

def split_pipe(user_input):
    """
    Split input into (kubsome_command, pipe_commands).
    Returns (command, pipe_chain) where pipe_chain is None if no pipe.
    """
    # Don't split pipes inside quotes
    if "|" not in user_input:
        return user_input, None

    # Scan for the first unquoted pipe
    first_pipe_idx = -1
    in_single_quote = False
    in_double_quote = False
    for i, char in enumerate(user_input):
        if char == "'" and not in_double_quote:
            in_single_quote = not in_single_quote
        elif char == '"' and not in_single_quote:
            in_double_quote = not in_double_quote
        elif char == "|" and not in_single_quote and not in_double_quote:
            first_pipe_idx = i
            break

    if first_pipe_idx == -1:
        return user_input, None

    cmd = user_input[:first_pipe_idx].strip()
    pipe_chain = user_input[first_pipe_idx+1:].strip()

    return cmd, pipe_chain


def apply_pipe(output_text, pipe_chain):
    """
    Run output through allowed shell pipe commands.
    Returns filtered text.
    """
    if not pipe_chain or not output_text:
        return output_text

    # Split the pipe chain into individual segments
    segments = []
    current_segment = ""
    in_single_quote = False
    in_double_quote = False
    for char in pipe_chain:
        if char == "'" and not in_double_quote:
            in_single_quote = not in_single_quote
            current_segment += char
        elif char == '"' and not in_single_quote:
            in_double_quote = not in_double_quote
            current_segment += char
        elif char == "|" and not in_single_quote and not in_double_quote:
            segments.append(current_segment.strip())
            current_segment = ""
        else:
            current_segment += char
    if current_segment:
        segments.append(current_segment.strip())

    current_output = output_text

    try:
        for segment in segments:
            if not segment:
                continue

            args = shlex.split(segment)
            if not args:
                continue

            cmd = args[0]
            if cmd not in ALLOWED_COMMANDS:
                return f"Error: Command '{cmd}' is not allowed in pipe chain."

            # Security check: Prevent path traversal and unauthorized file access.
            # We block arguments that appear to be file paths while allowing
            # common patterns (like URLs) that might contain slashes.
            import os
            for arg in args[1:]:
                if ".." in arg:
                    # Special case: allow '...' as a literal pattern if it's not actually '..'
                    # But '..' is strictly forbidden.
                    if arg == "..":
                        return f"Error: Directory traversal sequence '..' is not allowed: {arg}"
                    # If it's more than two dots, it might be a pattern.
                    # A more robust check:
                    import re
                    if re.search(r'(^|[\\/])\.\.([\\/]|$)', arg) or arg == "..":
                         return f"Error: Directory traversal sequences '..' are not allowed: {arg}"

                # Check for path separators (both / and Windows-style \)
                has_sep = "/" in arg or "\\" in arg

                # Block if it's an existing file, an absolute path, or looks like a relative path
                # this prevents 'grep foo /etc/passwd' or 'grep foo ./config.yaml'
                if os.path.exists(arg) or os.path.isabs(arg) or arg.startswith("./") or arg.startswith(".\\"):
                    return f"Error: File paths are not allowed as pipe arguments: {arg}"

            # Execute each segment sequentially, feeding output of previous as input to next
            result = subprocess.run(
                args,
                input=current_output,
                capture_output=True,
                text=True,
                shell=False
            )

            # Special handling for grep exit code 1 (no matches)
            if result.returncode != 0:
                if cmd == "grep" and result.returncode == 1:
                    current_output = ""
                else:
                    return result.stderr or result.stdout
            else:
                current_output = result.stdout

        return current_output
    except Exception as e:
        return f"Error executing pipe: {str(e)}"


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
