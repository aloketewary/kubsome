# Kubsome — Project Structure

## Directory Layout

```
kubsome/
├── main.py                  → Entry point (CLI REPL, serve mode, exec mode)
├── requirements.txt         → Python dependencies
├── pyproject.toml           → Package metadata and build config
├── dev.sh                   → Development server (API + UI hot-reload)
├── start.sh                 → Production build & serve
├── Dockerfile               → Container image
├── deploy/kubsome.yaml      → Kubernetes deployment manifest
├── pytest.ini               → Test configuration
│
├── core/                    → Kubernetes engine (business logic)
│   ├── k8s.py              → Base kubectl interaction (get_pods, human_age)
│   ├── context.py          → Global context state (current_context, namespace)
│   ├── state.py            → Persistent state management
│   ├── commands.py         → Command resolution (text → command dict)
│   ├── dispatcher.py       → Command dispatch (command dict → handler function)
│   ├── executor.py         → Raw kubectl command execution
│   ├── completer.py        → Tab completion for CLI
│   ├── config.py           → Config loading and alias resolution
│   ├── safety.py           → Production confirmation guards
│   ├── audit.py            → Action audit logging
│   ├── plugins.py          → Plugin system loader
│   ├── health.py           → kubectl health check
│   ├── healthcheck.py      → Cluster health check runner
│   ├── history.py          → Command history
│   ├── spinner.py          → Loading spinner context manager
│   ├── formatter.py        → Pod table rendering
│   ├── overview_formatter.py → Overview dashboard rendering
│   ├── watch_formatter.py  → Live watch view builder
│   ├── theme.py            → Color theme definitions
│   ├── banner.py           → Startup banner
│   ├── export.py           → Report export
│   ├── notify.py           → Critical alert notifications
│   ├── bookmarks.py        → Command bookmarks
│   ├── workflows.py        → Workflow definitions
│   ├── chaining.py         → Command chaining (&&)
│   ├── insights.py         → Cluster insights
│   ├── analyzer.py         → Pod/node/deployment analysis
│   ├── resolver.py         → Resource name resolution
│   ├── selector.py         → Interactive selection UI
│   │
│   ├── collectors/          → Data collection from kubectl
│   │   ├── pods.py, nodes.py, deployments.py
│   │   ├── events.py, logs.py, metrics.py
│   │   ├── inspect.py, diagnosis.py, trace.py
│   │   ├── rollouts.py, jobs.py, search.py
│   │   ├── security.py, cost.py, scaling.py
│   │   ├── network.py, namespace.py, rbac.py
│   │   ├── services.py, timeline.py, changes.py
│   │   ├── configs.py, diff.py, labels.py
│   │   └── multicluster.py, image_pull.py
│   │
│   ├── renderers/           → Rich console output formatting
│   │   ├── *_renderer.py   → One renderer per feature domain
│   │   └── (21 renderer modules)
│   │
│   ├── diagnostics/         → Diagnostic engine
│   │   ├── engine.py       → Core diagnosis logic
│   │   └── recommendations.py → Fix recommendations
│   │
│   ├── ai/                  → AI/intelligence layer
│   │   ├── engine.py       → AI query handler
│   │   ├── nlp.py          → Natural language parsing
│   │   ├── suggest.py      → Command suggestions
│   │   ├── anomaly.py      → Anomaly detection
│   │   ├── correlation.py  → Signal correlation
│   │   ├── explain.py      → Resource explanation
│   │   ├── generator.py    → Manifest generation
│   │   ├── playbooks.py    → Issue playbooks
│   │   └── llm.py          → LLM integration
│   │
│   └── incident/            → Incident management
│       ├── __init__.py
│       └── manager.py      → Start/stop/note/snapshot
│
├── api/                     → FastAPI REST + WebSocket backend
│   ├── app.py              → FastAPI app setup, CORS, router mounting
│   ├── serve.py            → Uvicorn server launcher
│   └── routes/             → Route modules (one per domain)
│       ├── pods.py, overview.py, contexts.py
│       ├── events.py, metrics.py, logs.py
│       ├── deployments.py, diagnostics.py
│       ├── intelligence.py, terminal.py
│       ├── operations.py, ws.py (WebSocket)
│       └── __init__.py
│
├── ui/                      → Angular 20 + PrimeNG web dashboard
│   ├── src/app/
│   │   ├── app.ts, app.routes.ts, app.config.ts
│   │   ├── core/           → Services, interceptors, models
│   │   │   ├── services/   → api, ws, cache, loading, error, preferences
│   │   │   ├── interceptors/ → error, loading
│   │   │   └── models.ts
│   │   ├── features/       → Feature components (20+ pages)
│   │   │   ├── dashboard/, pods/, deployments/, logs/
│   │   │   ├── events/, metrics/, jobs/, rbac/
│   │   │   ├── network/, incident/, ai/, terminal/
│   │   │   ├── timeline/, search/, settings/, secrets/
│   │   │   ├── compare/, cost/, graph/, runbooks/
│   │   │   ├── namespace/, yaml-editor/
│   │   │   └── contexts/
│   │   ├── layout/         → Shell component (sidebar, header)
│   │   └── shared/         → Reusable components
│   │       └── components/ → ai-float, command-palette, pod-drawer, etc.
│   ├── angular.json, package.json, tsconfig.json
│   └── public/
│
├── tui/                     → Textual terminal UI
│   ├── __init__.py
│   └── app.py
│
├── plugins/                 → Custom command plugins
│   └── example_health.py
│
├── config/                  → Application settings
│   └── settings.py
│
└── tests/
    └── test_core.py
```

## Architectural Patterns

### Command Pattern (CLI)
1. User input → `resolve_command()` → command dict `{"type": "...", "target": "..."}`
2. Command dict → `dispatch()` → handler function lookup via HANDLERS registry
3. Handler calls collector → analyzer → renderer

### Layered Architecture
- **Collectors**: Raw data from kubectl (subprocess → JSON parsing)
- **Analyzers**: Business logic, health assessment
- **Renderers**: Rich console output formatting
- **Dispatchers**: Route commands to appropriate handlers

### API Architecture
- FastAPI app with domain-based router modules
- Each route module imports from `core/` collectors/analyzers
- WebSocket endpoints for real-time streaming (pods, events, logs, shell)
- CORS configured for local Angular dev server
- Production: serves Angular build as static files

### Frontend Architecture
- Angular 20 standalone components (no NgModules)
- Feature-based folder structure
- Core services layer (API, WebSocket, caching, loading state)
- PrimeNG component library with dark theme
- Shared components for cross-cutting UI (command palette, toasts, drawers)
