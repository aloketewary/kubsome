# Project Structure — Kubsome

## Directory Layout

```
kubeasy/
├── main.py                    → Entry point (CLI, serve, tui, exec modes)
├── pyproject.toml             → Build config, dependencies, entry points
├── requirements.txt           → Flat dependency list
├── Dockerfile                 → Container build
├── install.sh / dev.sh        → Setup scripts
├── publish.sh                 → PyPI publish script
├── pytest.ini                 → Test configuration
│
├── core/                      → Core engine (Python)
│   ├── commands.py            → Command resolver (tokenize → command dict)
│   ├── dispatcher.py          → Maps command types to handler functions (80+ handlers)
│   ├── executor.py            → Runs raw shell commands
│   ├── config.py              → User config (~/.kubsome/config.yaml)
│   ├── context.py             → Kubernetes context state
│   ├── resolver.py            → Fuzzy name resolution (pods, deployments, cronjobs)
│   ├── selector.py            → Interactive selection when multiple matches
│   ├── cache.py               → TTL cache for kubectl calls
│   ├── safety.py              → Production confirmation guards
│   ├── audit.py               → Destructive operation logging
│   ├── remediation.py         → Auto-fix with safety guards
│   ├── watch_alert.py         → Background condition monitoring
│   ├── plugins.py             → Plugin loader + marketplace
│   ├── chaining.py            → Command chaining (&&)
│   ├── bookmarks.py           → Saved command shortcuts
│   ├── workflows.py           → Multi-step command sequences
│   ├── scheduler.py           → Cron-like recurring commands
│   ├── policy.py              → Cluster guardrail enforcement
│   ├── telemetry.py           → Local usage analytics
│   ├── doctor.py              → Pre-flight diagnostics
│   ├── suggestions.py         → Contextual next-step hints
│   ├── k8s.py                 → Low-level kubectl wrappers
│   ├── health.py              → kubectl connectivity check
│   ├── banner.py              → Startup banner
│   ├── notify.py              → Desktop notifications
│   ├── version.py             → Update checker
│   │
│   ├── ai/                    → AI intelligence modules
│   │   ├── engine.py          → Main AI query handler
│   │   ├── anomaly.py         → Anomaly detection
│   │   ├── correlation.py     → Signal correlation
│   │   ├── explain.py         → Concept explainer
│   │   ├── suggest.py         → Command suggestions
│   │   ├── playbooks.py       → 26 remediation runbooks
│   │   ├── generator.py       → YAML manifest generator
│   │   └── llm.py             → LLM integration (Ollama)
│   │
│   ├── nlp/                   → Natural language processing
│   │   ├── intents.py         → Intent definitions
│   │   ├── matcher.py         → Query → intent classification
│   │   └── actions.py         → Intent → command mapping
│   │
│   ├── collectors/            → 30+ data collectors (kubectl → structured data)
│   │   ├── pods.py, nodes.py, deployments.py, events.py, logs.py
│   │   ├── metrics.py, diagnosis.py, trace.py, security.py
│   │   ├── cost.py, cost_estimate.py, scorecard.py
│   │   ├── multicluster.py, diff_timeline.py, yaml_diff.py
│   │   ├── rollouts.py, scaling.py, rbac.py, network.py
│   │   ├── jobs.py, configs.py, services.py, labels.py
│   │   ├── changes.py, timeline.py, uptime.py
│   │   ├── dep_health.py, rollback_preview.py
│   │   ├── log_correlation.py, search.py, inspect.py
│   │   └── namespace.py, image_pull.py, diff.py
│   │
│   ├── renderers/             → 21 presentation renderers (Rich tables/panels)
│   │   ├── ai_renderer.py, anomaly_renderer.py
│   │   ├── cost_renderer.py, diagnosis_renderer.py
│   │   ├── events_renderer.py, help_renderer.py
│   │   ├── inspect_renderer.py, logs_renderer.py
│   │   ├── metrics_renderer.py, ops_renderer.py
│   │   ├── rollout_renderer.py, scaling_renderer.py
│   │   ├── trace_renderer.py, services_renderer.py
│   │   ├── rbac_renderer.py, report_renderer.py
│   │   ├── compare_renderer.py, describe_renderer.py
│   │   ├── incident_renderer.py, namespace_renderer.py
│   │   ├── search_renderer.py, changes_renderer.py
│   │   └── workflow_renderer.py
│   │
│   ├── diagnostics/           → Root cause analysis engine
│   │   ├── engine.py          → Diagnostic logic
│   │   └── recommendations.py → Fix recommendations
│   │
│   └── incident/             → Incident tracking
│       └── manager.py         → Start/stop/note/snapshot
│
├── api/                       → FastAPI REST + WebSocket backend
│   ├── app.py                 → FastAPI app setup, CORS, route registration
│   ├── serve.py               → Uvicorn launcher
│   └── routes/                → 13 route modules
│       ├── pods.py, overview.py, contexts.py, events.py
│       ├── metrics.py, logs.py, deployments.py
│       ├── diagnostics.py, intelligence.py
│       ├── terminal.py, operations.py, describe.py
│       └── ws.py              → WebSocket endpoint
│
├── ui/                        → Angular 20 + PrimeNG Web Dashboard
│   ├── src/app/               → Angular components and services
│   ├── angular.json           → Angular CLI config
│   └── package.json           → Frontend dependencies
│
├── tui/                       → Full-screen terminal UI (Textual)
│   └── app.py                 → TUI application
│
├── plugins/                   → Plugin examples
│   └── example_health.py      → Sample plugin
│
├── config/                    → App settings module
│   └── settings.py            → Runtime settings
│
├── deploy/                    → Deployment configs
│   ├── helm/kubsome/          → Helm chart
│   └── kubsome.yaml           → Raw Kubernetes manifest
│
└── tests/                     → Test suite (171 tests)
    ├── test_core.py           → Core module tests
    ├── test_features.py       → Feature integration tests
    ├── test_nlp_ai.py         → NLP/AI tests
    ├── test_api.py            → API endpoint tests
    ├── test_v15.py            → Version 1.5 feature tests
    └── test_growth.py         → Growth features tests (Batches 1-6)
```

## Architectural Patterns

### Command Resolution Pipeline
```
User Input → Alias Expansion → Command Resolver (exact match)
  → Rule-Based NLP (regex) → Intent Engine (fuzzy classification)
  → Suggestion Fallback ("Did you mean: pods")
```

### Collector-Renderer Pattern
- **Collectors** run kubectl commands and return structured dicts
- **Renderers** take structured data and produce Rich console output
- **Dispatcher** orchestrates: resolve → collect → render

### Handler Registry
The dispatcher uses a flat dict (`HANDLERS`) mapping command type strings to handler functions, enabling easy extension.

### Fuzzy Resolution
All resource names go through `resolve_pod_name` / `resolve_deployment_name` which use rapidfuzz for fuzzy matching, then `choose_*` for interactive disambiguation.

### Safety Guards
Destructive operations (rollback, delete, scale) check environment detection and require confirmation in production contexts.
