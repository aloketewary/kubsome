# Development Guidelines — Kubsome

## Code Quality Standards

### Module Docstrings
Every module starts with a triple-quoted docstring describing its purpose:
```python
"""
Cache — simple TTL cache for kubectl results
to avoid redundant API server calls.
"""
```

### Function Docstrings
Public functions have concise docstrings explaining behavior:
```python
def auto_remediate(pod_name):
    """
    Diagnose a pod and attempt automatic remediation.
    Returns actions taken and results.
    """
```

### Empty `__init__.py` Files
All packages use empty `__init__.py` files — no re-exports or package-level initialization. Imports are always explicit from the specific module.

### Import Style
- Standard library imports first, then third-party, then local
- Local imports use relative-style absolute paths: `from core.context import context`
- Inline imports used for optional/heavy dependencies or circular avoidance:
```python
def _handle_tui(cmd, env):
    try:
        from tui.app import run_tui
        run_tui()
    except ImportError:
        console.print("[red]textual not installed.[/red]")
```

## Structural Conventions

### Collector Pattern
Collectors are pure data functions that run kubectl and return structured dicts/lists:
```python
def collect_pods():
    command = (
        f"kubectl --context {context.current_context} "
        f"get pods -n {context.namespace} -o json"
    )
    result = subprocess.run(command, shell=True, capture_output=True, text=True)
    if result.returncode != 0:
        return []
    data = json.loads(result.stdout)
    # Transform to simplified dicts
    return [{"name": ..., "status": ..., "restarts": ...}]
```

### Renderer Pattern
Renderers accept structured data and produce Rich console output. They never call kubectl:
```python
def render_inspect(details, events, logs, recommendation):
    console.print(Panel(info_content, title="[bold]🔍 Pod Info[/bold]", border_style="cyan"))
```

### Handler Pattern (Dispatcher)
Handlers follow the signature `_handle_<type>(cmd, env)` and orchestrate collect → render:
```python
def _handle_diagnose(cmd, env):
    target = cmd["target"]
    with loading(f"Diagnosing {target}..."):
        data = collect_diagnosis(target)
    findings = diagnose(data)
    render_diagnosis(target, findings)
```

### Command Dict Structure
Commands are dicts with a `"type"` key and optional parameters:
```python
{"type": "logs", "target": "pod-name", "follow": True, "errors": False}
```

### Handler Registry
All handlers registered in a flat dict at module bottom:
```python
HANDLERS = {
    "pods_table": _handle_pods_table,
    "diagnose": _handle_diagnose,
    ...
}
```

### API Route Pattern
FastAPI routes are thin wrappers around collectors:
```python
router = APIRouter(tags=["pods"])

@router.get("/pods")
def get_pods():
    pods = collect_pods()
    return {"context": context.current_context, "namespace": context.namespace, "pods": pods}
```

## Naming Conventions

### Files
- Snake_case for all Python files
- Collectors: `core/collectors/<resource>.py`
- Renderers: `core/renderers/<resource>_renderer.py`
- API routes: `api/routes/<resource>.py`

### Functions
- Collectors: `collect_<resource>()`, `list_<resource>()`, `fetch_<resource>()`
- Renderers: `render_<view_name>(data, ...)`
- Handlers: `_handle_<command_type>(cmd, env)` (private, prefixed with underscore)
- Helpers: `_<descriptive_name>()` (private)

### Variables
- `ctx` for kubernetes context string
- `ns` for namespace string
- `console` as module-level Rich Console instance
- `context` imported from `core.context` for global state

## Design Patterns

### Fuzzy Resolution Flow
```python
matches = resolve_pod_name(query)  # Returns list of matches
if not matches:
    return None
pod = choose_pod(matches)          # Interactive selection if multiple
if not pod:
    return None
return {"type": "inspect", "target": pod}
```

### Safety Guards
Production detection via context name substring matching:
```python
if "prd" in ctx or "prod" in ctx:
    return {"blocked": True, "reason": "Disabled in production"}
```

### Loading Spinner
Use `with loading("message...")` context manager for long operations:
```python
with loading("Fetching cluster overview..."):
    pods = collect_pods()
```

### Error Handling
- Collectors return empty list/None on failure (never raise)
- Handlers catch exceptions and print `[red]Error: {e}[/red]`
- KeyboardInterrupt caught at dispatcher level

### kubectl Command Construction
Always include `--context` and `-n` namespace:
```python
f"kubectl --context {context.current_context} get pods -n {context.namespace} -o json"
```

### Rich Formatting
- Panels with emoji titles and colored borders
- Tables with `border_style="dim"` and `expand=True`
- Status colors: green=healthy, yellow=warning, red=error, dim=inactive
- Icons: ✓ success, ✗ failure, ● status dot, ⚠ warning

### Return Value Conventions
- Collectors return `[]` or `{}` on failure, never raise
- `resolve_command()` returns `None` if unrecognized (triggers NLP fallback)
- `resolve_command()` returns either a command dict or a raw kubectl string

## Practices

### Subprocess Usage
All kubectl calls use `subprocess.run` with `shell=True, capture_output=True, text=True`:
```python
result = subprocess.run(command, shell=True, capture_output=True, text=True)
```

### TTL Caching
Use `@cached(ttl=5)` decorator for frequently-called kubectl operations to reduce API server load.

### Audit Logging
All destructive operations call `log_action(action, target)` after success.

### Optional Dependencies
Features requiring optional packages (textual, etc.) use try/except ImportError with helpful install messages.

### String Formatting
F-strings used exclusively. Multi-line f-strings broken with parentheses:
```python
command = (
    f"kubectl --context {ctx} "
    f"get pods -n {ns} -o json"
)
```

### Line Length
Code targets ~70-80 char line width. Long strings split across multiple lines using parenthesized concatenation.
