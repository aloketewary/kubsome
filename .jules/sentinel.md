## 2025-05-15 - [CRITICAL] Command Injection via Shell=True
**Vulnerability:** User-controlled input (resource names, context names) was passed directly into f-strings used as shell commands in `subprocess.run(..., shell=True)`.
**Learning:** `shell=True` in Python's `subprocess` module is extremely dangerous when combined with unvalidated user input, as it allows for command chaining and arbitrary execution.
**Prevention:** Always use a list of arguments for `subprocess.run` and avoid `shell=True`. This ensures that each element in the list is treated as a literal argument to the command, not as a shell instruction.

## 2026-05-11 - [CRITICAL] Command Injection in API Routes via Shell=True
**Vulnerability:** API endpoints (`/namespaces/{ctx}`, `/describe/{resource}/{name}`) were vulnerable to command injection because they passed user-provided path parameters directly into `subprocess.run(..., shell=True)`.
**Learning:** Even with "fuzzy resolution" in place, unvalidated path parameters used in shell strings are a major risk. List-based arguments for `subprocess.run` are the standard defense.
**Prevention:** Avoid `shell=True` and f-strings for command construction. Use list-based arguments to ensure user input is treated as a literal argument.

## 2026-05-22 - [CRITICAL] Command Injection in WebSocket Routes
**Vulnerability:** WebSocket endpoints (`/ws/logs/{pod}`, `/ws/shell/{pod}`) were vulnerable to command injection as they passed user-provided path and query parameters into shell commands executed via `subprocess.Popen(..., shell=True)`.
**Learning:** Security audits must cover all entry points, including WebSockets, which are often overlooked compared to standard REST endpoints. The same `shell=True` risk applies across all transports.
**Prevention:** Use list-based arguments for `subprocess.Popen` and avoid `shell=True` regardless of the protocol.

## 2026-05-13 - [HIGH] Command Injection in Core K8s Utilities
**Vulnerability:** Core utility functions `get_pods` and `get_pod_names` in `core/k8s.py` were using `shell=True` with f-strings containing user-influenced context and namespace names.
**Learning:** Hardening API routes is insufficient if the underlying core utilities still use vulnerable patterns. Security must be implemented at the lowest possible level of command execution.
**Prevention:** Standardize on list-based arguments and `shell=False` for all `subprocess` calls in core utility modules.
