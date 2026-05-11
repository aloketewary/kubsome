## 2025-05-15 - [CRITICAL] Command Injection via Shell=True
**Vulnerability:** User-controlled input (resource names, context names) was passed directly into f-strings used as shell commands in `subprocess.run(..., shell=True)`.
**Learning:** `shell=True` in Python's `subprocess` module is extremely dangerous when combined with unvalidated user input, as it allows for command chaining and arbitrary execution.
**Prevention:** Always use a list of arguments for `subprocess.run` and avoid `shell=True`. This ensures that each element in the list is treated as a literal argument to the command, not as a shell instruction.

## 2026-05-11 - [CRITICAL] Command Injection in API Routes via Shell=True
**Vulnerability:** API endpoints (`/namespaces/{ctx}`, `/describe/{resource}/{name}`) were vulnerable to command injection because they passed user-provided path parameters directly into `subprocess.run(..., shell=True)`.
**Learning:** Even with "fuzzy resolution" in place, unvalidated path parameters used in shell strings are a major risk. List-based arguments for `subprocess.run` are the standard defense.
**Prevention:** Avoid `shell=True` and f-strings for command construction. Use list-based arguments to ensure user input is treated as a literal argument.
