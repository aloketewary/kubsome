# Kubsome — Development Guidelines

## Code Quality Standards

### Python Formatting
- **Line length**: ~60-70 chars preferred, multi-line strings broken with parentheses
- **Imports**: Grouped by stdlib → third-party → local, with blank lines between groups
- **Docstrings**: Module-level triple-quote docstrings for major files; minimal inline comments
- **Naming**: snake_case for functions/variables, PascalCase not used (no classes in core logic)
- **String formatting**: f-strings exclusively
- **Whitespace**: Generous vertical spacing between logical blocks within functions

### TypeScript/Angular Formatting
- **Components**: Single-file standalone components (template + styles inline)
- **Imports**: Angular core → third-party → local services → local models
- **Naming**: camelCase for properties/methods, PascalCase for types/interfaces
- **Injection**: `inject()` function pattern (not constructor injection)

## Architectural Patterns

### Collector Pattern (Python — core/collectors/)
All data collection follows this exact pattern:
```python
import subprocess
import json
from core.context import context

def collect_<resource>(param=default):
    command = (
        f"kubectl "
        f"--context {context.current_context} "
        f"get <resource> "
        f"-n {context.namespace} "
        f"-o json"
    )
    result = subprocess.run(
        command,
        shell=True,
        capture_output=True,
        text=True
    )
    if result.returncode != 0:
        return []
    data = json.loads(result.stdout)
    items = []
    for item in data.get("items", []):
        items.append({...})  # Extract relevant fields
    return items
```
Key conventions:
- Always use `context.current_context` and `context.namespace`
- Return empty list `[]` on failure (never raise)
- Parse JSON output from kubectl
- Return list of dicts with only needed fields

### Command Dispatch Pattern (Python — core/dispatcher.py)
```python
def _handle_<action>(cmd, env):
    with loading("Message..."):
        data = collect_something(cmd["target"])
    render_something(data)

HANDLERS = {
    "action_name": _handle_action,
}
```
Key conventions:
- Handler signature: `(cmd: dict, env: str) -> None`
- Use `loading()` context manager for slow operations
- Call collector then renderer (never mix concerns)
- Register in HANDLERS dict at module bottom

### API Route Pattern (Python — api/routes/)
```python
from fastapi import APIRouter, HTTPException
from core.context import context
from core.collectors.<module> import collect_<resource>

router = APIRouter(tags=["<domain>"])

@router.get("/<endpoint>")
def get_<resource>():
    return {
        "context": context.current_context,
        "namespace": context.namespace,
        "<resource>": collect_<resource>(),
    }

@router.post("/<action>/{name}")
def post_<action>(name: str):
    success, output = do_action(name)
    if not success:
        raise HTTPException(status_code=500, detail="...")
    return {"<action>ed": name}
```
Key conventions:
- One router per domain, tagged for OpenAPI grouping
- GET endpoints return context + namespace + data
- POST endpoints raise HTTPException on failure
- Pydantic BaseModel for request bodies
- Mounted in app.py with `/api` prefix

### Angular Service Pattern (TypeScript — ui/src/app/core/services/)
```typescript
@Injectable({ providedIn: 'root' })
export class ApiService {
  private http = inject(HttpClient);
  private base = 'http://localhost:8000/api';

  getResource(): Observable<ResponseType> {
    return this.http.get<ResponseType>(`${this.base}/resource`);
  }

  postAction(name: string, body: any): Observable<any> {
    return this.http.post(`${this.base}/action/${name}`, body);
  }
}
```

### Angular Component Pattern (TypeScript — ui/src/app/features/)
```typescript
@Component({
  selector: 'app-<feature>',
  standalone: true,
  imports: [...],
  template: `...`,
  styles: [`...`],
})
export class FeatureComponent implements OnInit, OnDestroy {
  private api = inject(ApiService);
  private ws = inject(WsService);

  // State
  data: Type[] = [];
  loading = false;

  ngOnInit() { this.refresh(); }
  ngOnDestroy() { /* cleanup subscriptions */ }

  refresh() {
    this.api.getData().subscribe(res => { this.data = res.items; });
  }
}
```
Key conventions:
- Standalone components (no NgModules)
- `inject()` for DI
- Template uses `@if` / `@for` control flow (Angular 17+ syntax)
- Inline styles with CSS custom properties (dark theme variables)
- PrimeNG components for UI elements

## Design Patterns

### Error Handling
- **Python collectors**: Return empty data on failure, never throw
- **Python dispatcher**: Catch all exceptions, print `[red]Error: {e}[/red]`
- **API routes**: Raise `HTTPException` with appropriate status codes
- **Angular**: Error interceptor handles HTTP errors globally

### State Management
- **Python**: Global `context` singleton holds current_context + namespace
- **Angular**: Services hold state, components subscribe to observables

### Real-time Updates
- WebSocket endpoints at `/ws/<resource>` for live data
- Angular `WsService` wraps WebSocket connections with RxJS observables
- Components manage subscription lifecycle in ngOnInit/ngOnDestroy

### Safety Guards
- Production context detection via string matching ("prd" in context name)
- Confirmation prompts before destructive operations (rollback, scale)
- Audit logging for all mutating actions

## Naming Conventions

### Files
- Python: `snake_case.py` — one module per concern
- TypeScript: `kebab-case.component.ts` — one component per file
- Collectors: `core/collectors/<resource>.py`
- Renderers: `core/renderers/<resource>_renderer.py`
- Routes: `api/routes/<domain>.py`
- Features: `ui/src/app/features/<feature>/<feature>.component.ts`

### Functions
- Collectors: `collect_<resource>()`, `list_<resource>()`, `fetch_<resource>()`
- Handlers: `_handle_<action>(cmd, env)`
- Renderers: `render_<thing>(data)`
- API: `get_<resource>()`, `post_<action>()`

### Command Dicts
```python
{"type": "action_name", "target": "resource_name", ...extra_params}
```

## CSS/Theming (Angular)
- Dark theme using CSS custom properties
- Variables: `--bg-card`, `--bg-elevated`, `--bg-hover`, `--border`, `--border-hover`
- Colors: `--success`, `--warning`, `--danger`, `--accent`
- Subtle variants: `--success-subtle`, `--danger-subtle`, `--accent-subtle`
- Typography: `--text-muted`, `--text-secondary`
- Spacing: `--radius`, `--radius-sm`
- Monospace: `'JetBrains Mono', monospace` for code/data

## Package `__init__.py` Files
- All `__init__.py` files are empty (namespace packages)
- Imports are explicit at point of use, never re-exported from `__init__.py`

## Testing
- pytest for Python tests in `tests/` directory
- Karma + Jasmine for Angular tests
- Test file naming: `test_<module>.py`
