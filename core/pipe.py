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

# Allowed commands for piping to prevent arbitrary command execution
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

            # Validate arguments to prevent reading local files
            # We allow flags but limit positional arguments to ensure they only read from stdin
            # and don't accept file paths.
            positional_count = 0
            # Some flags take arguments (e.g. grep -e PATTERN, grep -m 1)
            # We must skip these when counting positional args.
            flags_with_args = {
                "-e", "--regexp", "-f", "--file", "-m", "--max-count", "-A", "-B", "-C",
                "-n", "--lines", "-c", "--bytes", "-t", "--field-separator", "-k", "--key",
                "-d", "--delimiter", "-f", "--fields"
            }
            skip_next = False

            for i, arg in enumerate(args[1:]):
                if skip_next:
                    skip_next = False
                    continue

                if arg.startswith("-"):
                    # Block dangerous flags that read files or write output
                    if arg in ("-f", "--file"):
                        return f"Error: Flag '{arg}' is blocked in pipes (security)."
                    if arg in ("-o", "--output"): # relevant for sort/others
                        return f"Error: Flag '{arg}' is blocked in pipes (security)."

                    if arg in flags_with_args:
                        skip_next = True
                    continue

                positional_count += 1

            # Enforcement: limit positional args based on command.
            # 0 means the command must only read from stdin and take no file arguments.
            # grep [pattern], tr [set1] [set2].
            # head, tail, sort, wc, cut are restricted to 0 positional args to prevent LFI.
            limits = {
                "grep": 1, "tr": 2, "head": 0, "tail": 0,
                "sort": 0, "uniq": 0, "wc": 0, "cut": 0
            }
            max_allowed = limits.get(cmd, 0)

            if positional_count > max_allowed:
                return (f"Error: Too many positional arguments for '{cmd}' in pipe. "
                        f"Expected {max_allowed}, got {positional_count}. "
                        "Pipes only process data from stdin.")

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
