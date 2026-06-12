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

## 2026-05-24 - [CRITICAL] Command Injection in Auto-Remediation via Shell=True
**Vulnerability:** The auto-remediation module (`core/remediation.py`) was using `shell=True` with string-formatted commands containing user-controlled pod names and namespace/context strings.
**Learning:** Even internal "safe" actions like restarts and deletions can be exploited if the resource names are manipulated to include shell metacharacters (e.g., `; rm -rf /`).
**Prevention:** Eliminate `shell=True` and use list-based arguments for all `subprocess` calls. When redirecting stderr to null in list-mode, use `stderr=subprocess.DEVNULL` and avoid `capture_output=True` if explicit redirection is needed.

## 2026-06-01 - [CRITICAL] Command Injection in Log Collectors
**Vulnerability:** Multiple functions in `core/collectors/logs.py` were using `shell=True` with f-strings containing pod names, container names, and contexts, allowing for arbitrary command execution.
**Learning:** Even internal collectors can be vectors for command injection if they ingest user-influenced data (like pod names from the UI). Relying on `shell=True` for convenience in command construction is a common but dangerous pattern.
**Prevention:** Avoid `shell=True` and use list-based arguments for all `subprocess` calls. Removed shell-specific quoting (like `.strip("'")`) when moving to list-based arguments as they are no longer needed.

## 2026-05-24 - [HIGH] Path Traversal in Incident Report Endpoint
**Vulnerability:** The `incident_report` endpoint in `api/routes/operations.py` performed a prefix check on a user-provided path without first resolving it. This allowed attackers to bypass the check using `..` (parent directory) segments.
**Learning:** `startswith()` checks on un-canonicalized path strings are insufficient. Paths must be resolved to their absolute form before any validation or use.
**Prevention:** Always use `Path(path).resolve()` on both the base directory and the user-provided path. Use `target_path.is_relative_to(base_dir)` (Python 3.9+) or similar path-aware logic for validation.

## 2026-06-05 - [CRITICAL] Command Injection in macOS Notifications
**Vulnerability:** User-controlled strings (titles, messages) were interpolated directly into an AppleScript string executed via `osascript`. This allowed attackers to break the AppleScript context using double quotes and execute arbitrary shell commands via `do shell script`.
**Learning:** Even when using list-based arguments for `subprocess.run`, if the command itself (like `osascript -e '...'`) interprets a string that contains unvalidated user input, injection is still possible.
**Prevention:** Use positional arguments with AppleScript's `on run {args}` handler to pass user data safely as separate parameters, ensuring they are treated as data and not part of the script's logic.

## 2026-05-19 - [HIGH] Token Leak via Public Endpoint
**Vulnerability:** The `/api/token` endpoint was publicly accessible and returned the session token without any authentication or source verification. This could allow remote attackers to obtain the token and bypass API authentication.
**Learning:** Security-sensitive endpoints that provide credentials or tokens must be strictly restricted. Relying solely on CORS is insufficient as it is a browser-side check and doesn't prevent programmatic access.
**Prevention:** Implement strict source verification (e.g., checking `request.client.host`) for endpoints that expose credentials, ensuring they are only accessible from trusted locations like localhost.

## 2025-05-24 - [HIGH] SSRF in Webhook Notifications
**Vulnerability:** The webhook notification system used `urllib.request.urlopen` on user-provided URLs without any validation. This allowed attackers to make the server perform arbitrary GET/POST requests to internal network services, loopback interfaces, or cloud metadata endpoints (e.g., 169.254.169.254).
**Learning:** Outbound network requests to user-controlled URLs are a classic SSRF vector. Relying on "generic" webhook types doesn't mitigate the risk if the URL itself is not restricted. Scheme and IP-level validation are essential.
**Prevention:** Implement a strict URL validation helper that: 1) Enforces safe schemes (http/https). 2) Resolves the hostname to all its IP addresses. 3) Blocks any IP that falls within loopback, private, reserved, or link-local ranges.

## 2026-05-28 - [CRITICAL] Command Injection in Shell Pipe Implementation
**Vulnerability:** The `apply_pipe` function in `core/pipe.py` used `subprocess.run(..., shell=True)` to execute user-provided pipe chains (e.g., `grep foo`), allowing for arbitrary command execution via shell metacharacters (e.g., `grep foo; rm -rf /`).
**Learning:** Even "utility" functions that provide convenience features like piping can be dangerous if they rely on the shell for execution. Whitelisting allowed commands and manually chaining processes with `shell=False` is the only secure way to implement this.
**Prevention:** Implement a strict whitelist of allowed binaries for piping. Use list-based `subprocess.run` or `Popen` with `shell=False`. Ensure the splitter correctly handles quotes to prevent bypassing the whitelist (e.g., `grep 'pattern | touch /tmp/pwned'`).

## 2026-06-08 - [CRITICAL] Command Injection via Trusted Binary Features
**Vulnerability:** Even with `shell=False` and a strict command whitelist, binaries like `awk` and `sed` can be exploited to execute arbitrary shell commands via their internal features (e.g., `awk`'s `system()` or `sed`'s `e` command).
**Learning:** A whitelist of "safe" binaries is only as secure as the most permissive feature of any binary on that list. Using list-based `subprocess` arguments does not protect against vulnerabilities *within* the called application.
**Prevention:** Exclude high-risk text-processing utilities that support sub-shell execution from whitelists if they are going to process unvalidated user-provided scripts or arguments. Standardize on safer, more limited alternatives where possible.
## 2025-06-10 - [HIGH] SQL Injection in Analytics Custom Query
**Vulnerability:** The `/analytics/query` endpoint used a simple blacklist to block destructive SQL commands. This could be bypassed using comments (e.g., `--` or `/* */`) to hide keywords from the prefix check, or by using semicolons to chain multiple statements.
**Learning:** Blacklists are insufficient for SQL security. A strict whitelist of allowed starting keywords, combined with comment stripping and multiple statement blocking, is necessary for safe read-only access.
**Prevention:** 1) Strip all comments before validation. 2) Block queries containing semicolons. 3) Enforce a whitelist of allowed starting keywords (e.g., `SELECT`, `WITH`). 4) Use parameterized queries for all dynamic values.
