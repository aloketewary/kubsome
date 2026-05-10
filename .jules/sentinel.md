## 2025-05-15 - [CRITICAL] Command Injection via Shell=True
**Vulnerability:** User-controlled input (resource names, context names) was passed directly into f-strings used as shell commands in `subprocess.run(..., shell=True)`.
**Learning:** `shell=True` in Python's `subprocess` module is extremely dangerous when combined with unvalidated user input, as it allows for command chaining and arbitrary execution.
**Prevention:** Always use a list of arguments for `subprocess.run` and avoid `shell=True`. This ensures that each element in the list is treated as a literal argument to the command, not as a shell instruction.
