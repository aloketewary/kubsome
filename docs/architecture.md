# Architecture

## System Overview

```
┌─────────────────────────────────────────────────────────┐
│                      User Interfaces                      │
├──────────┬──────────┬──────────────┬────────────────────┤
│   CLI    │   TUI    │   Web UI     │   API (REST/WS)    │
│ (prompt) │(textual) │ (Angular 20) │   (FastAPI)        │
└────┬─────┴────┬─────┴──────┬───────┴────────┬───────────┘
     │          │            │                │
     └──────────┴────────────┴────────────────┘
                         │
              ┌──────────┴──────────┐
              │     Core Engine     │
              ├─────────────────────┤
              │ Commands → Dispatch │
              │ NLP → Intent Match  │
              │ AI → Analysis       │
              │ Cache → Performance │
              └──────────┬──────────┘
                         │
              ┌──────────┴──────────┐
              │   kubectl / K8s API │
              └─────────────────────┘
```

## Command Resolution Pipeline

```
User Input
    ↓
Alias Expansion (config.yaml aliases)
    ↓
Command Resolver (exact token match → command dict)
    ↓ (not found)
Rule-Based NLP (regex patterns → intent)
    ↓ (not found)
Intent Engine (fuzzy classification + entity extraction)
    ↓ (not found)
Suggestion Fallback ("Did you mean: pods")
```

## Collector-Renderer Pattern

```
Handler (dispatcher.py)
    │
    ├── Collector (core/collectors/*.py)
    │   └── Runs kubectl → returns structured dict/list
    │
    └── Renderer (core/renderers/*.py)
        └── Takes data → produces Rich console output
```

- **Collectors** are pure data functions. They never print.
- **Renderers** never call kubectl. They only format.
- **Handlers** orchestrate: resolve → collect → render.

## Cache Architecture

```
Request → Check cache
    ├── HIT (valid TTL) → return cached
    ├── STALE (expired but within grace) → return stale + background refresh
    └── MISS → fetch fresh → store with adaptive TTL

Adaptive TTL:
- Data unchanged → TTL grows (3s → 4.5s → 6.75s → ... → 30s max)
- Data changed → TTL resets to 3s (fresh data during incidents)

Prewarm:
- On startup, background thread pre-fetches pods + pod names
```

## API Architecture

```
FastAPI App (api/app.py)
    ├── CORS middleware (allow all)
    ├── Route modules (api/routes/*.py)
    │   ├── pods, overview, contexts, events
    │   ├── metrics, logs, deployments
    │   ├── diagnostics, intelligence
    │   ├── terminal, operations, describe
    │   ├── gateway, ws (WebSocket)
    │   └── Each route calls collectors directly
    ├── Static file serving (Angular build)
    └── Startup event (cache prewarm)
```

## Web UI Architecture

```
Angular 20 + PrimeNG + Standalone Components
    ├── Features (lazy-loaded per route)
    │   └── Each page = single standalone component
    ├── Core
    │   ├── ApiService (HTTP client)
    │   ├── WsService (WebSocket client)
    │   └── Models (TypeScript interfaces)
    ├── Shared
    │   ├── Pod drawer, AI insight drawer
    │   ├── Shell terminal, Log terminal
    │   ├── Spotlight, Page info, Breadcrumb
    │   └── Confirm dialog, Toast alerts
    └── Layout
        └── Shell (sidenav + header + router outlet)
```

## Key Design Decisions

1. **No ORM / No database** — All state from kubectl. Incidents stored as JSON files.
2. **subprocess.run for kubectl** — Simple, debuggable, no K8s client library dependency.
3. **Adaptive cache** — Balances freshness (during incidents) vs efficiency (stable clusters).
4. **Fuzzy matching everywhere** — rapidfuzz for pod/deployment name resolution.
5. **Safety guards** — Production detection via context name ("prd"/"prod") blocks destructive ops.
6. **Optional dependencies** — TUI (textual), LLM (ollama) are opt-in extras.
7. **Standalone Angular components** — No NgModules, each page is self-contained.
8. **WebSocket for live data** — Pods, events, logs, shell all stream via WS.
