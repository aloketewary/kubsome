# Changelog

All notable changes to Kubsome are documented here.

## [1.13.0] — 2025-07-17

### GitOps Integration (ArgoCD / Flux)
- **`gitops`** — Detect ArgoCD or Flux and show all app sync status, health, drift count
- **`gitops <app>`** — Detailed app view with resource-level sync status, conditions, revision
- **`argocd` / `flux`** — Aliases for `gitops`
- Auto-detects provider by scanning for `argocd-server` or `source-controller` deployments
- Shows: sync status, health, revision (commit SHA), repo URL, path, last synced time
- Detail view lists individual resources (Deployment, Service, ConfigMap) with per-resource sync/health

### Service Mesh Visibility (Istio / Linkerd)
- **`mesh-detail`** — Full mesh overview: mTLS mode, sidecar injection coverage, routing rule counts
- **`vs` / `vs <name>`** — List VirtualServices with canary weights, timeouts, retries, fault injection
- **`dr` / `dr <name>`** — List DestinationRules with circuit breakers, outlier detection, subsets, TLS mode
- **`mtls`** — mTLS enforcement status with PeerAuthentication policy listing
- Sidecar injection coverage with list of pods missing proxy
- Linkerd support: proxy detection + ServerAuthorization policies

### Easy Configuration
- **`kubsome init`** — Interactive 8-step setup wizard (theme, notifications, aliases, LLM, safety, telemetry, integrations)
- **`kubsome connect <name> [url]`** — One-command integration setup (Slack, Teams, Prometheus, ArgoCD, Flux, Ollama)
- **`kubsome connect --discover`** — Auto-discover all available integrations in cluster
- **`disconnect <name>`** — Remove an integration
- **`profile` / `profile use <name>` / `profile reset`** — Named config presets (dev, oncall, prod, ci)
- **`kubsome --profile <name>`** — Activate profile on startup
- **`guide` / `menu`** — Interactive guided mode with 5 categories, 28 actions
- Custom profiles via `~/.kubsome/profiles/*.yaml`

### Web UI
- **GitOps page** — Summary cards (synced/drifted/degraded), app table with click-to-detail, resource list
- **Service Mesh page** — 4-tab layout (mTLS, VirtualServices, DestinationRules, Injection)
- Navigation: added GitOps and Service Mesh to sidebar

### API
- `GET /api/gitops` — All apps sync overview
- `GET /api/gitops/{app_name}` — App detail with resources and conditions
- `GET /api/mesh/status` — Full mesh status (mTLS + injection + VS + DR)
- `GET /api/mesh/virtual-services` — VirtualService routing rules
- `GET /api/mesh/destination-rules` — DestinationRules + circuit breakers
- `GET /api/mesh/mtls` — mTLS enforcement + PeerAuthentication policies
- `GET /api/integrations` — List integrations with status
- `POST /api/integrations/connect` — Connect integration
- `POST /api/integrations/disconnect` — Remove integration
- `GET /api/integrations/discover` — Auto-discover
- `GET /api/profiles` — List profiles
- `POST /api/profiles/activate` — Activate profile
- `POST /api/profiles/deactivate` — Deactivate profile

### Stats
- CLI handlers: 99 → 113 (+14)
- API routes: 126 → 145 (+19)
- UI pages: 38 → 40 (+2)
- Tests: 188 passed (0 regressions)

## [1.12.0] — 2025-07-16

### Growth & Activation
- **`kubsome doctor`** — Pre-flight diagnostics (kubectl, cluster, metrics-server, config, namespace, optional deps)
- **Smart suggestions** — Contextual next-step hints after every command ("Try: diagnose <pod>")
- **Context-aware banner** — Shows pod health snapshot on startup from cache
- **Interactive first-run** — Enhanced onboarding with quick start guide

### Distribution
- **GitHub Action** — `kubsome scorecard` in CI/CD with configurable grade threshold
- **kubectl krew plugin** — `kubectl kubsome <command>` via krew index
- **Homebrew formula** — `brew install aloketewary/tap/kubsome`

### Retention & Automation
- **Scheduled workflows** — Cron-like recurring command sequences (`schedule add daily "0 8 * * *" scorecard,export`)
- **Usage telemetry** — Local-only opt-in command frequency tracking (`stats`)
- **Command failure tracking** — Unresolved NLP queries logged for intent improvement
- **Cost trend & forecast** — Projects next month's cost based on usage trend (`cost-trend`)

### Collaboration
- **Incident sharing** — One-click export to Slack/Teams/Webex via webhooks (`incident share`)
- **Team runbooks** — Git-synced `.kubsome/runbooks/*.yaml` with "Team" badge in UI
- **Audit log dashboard** — New Web UI page showing who-did-what-when with filters

### Intelligence
- **AI follow-up suggestions** — Contextual next questions after each AI response
- **PagerDuty integration** — Events API v2 incident triggers from anomaly alerts
- **OpsGenie integration** — Alert API with priority mapping (P1-P5)
- **Log regex search** — `logs <pod> --regex "OOM|timeout" --since 1h`

### Governance
- **Policy engine** — Define guardrails in `.kubsome/policies.yaml` with 7 built-in rules
  - no_latest_image, memory_limits_set, cpu_limits_set, max_replicas
  - no_privileged, run_as_non_root, read_only_root
- **7-day metrics history** — Extended from 24h, with time-series API for charting
- **Plugin marketplace** — `plugin install <name>` / `plugin rm <name>` from registry

### Web UI
- **4 new pages:** Audit, Policy, Doctor (Health), Schedules
- **Incident page** — Added Share button for webhook export
- **Cost Estimate page** — Added cost trend/forecast card
- **Runbooks page** — Team badge for project-local runbooks
- **AI Chat** — Follow-up suggestion buttons after responses
- **Sidebar** — Added Policy, Schedules, Health, Audit entries

### API
- 7 new endpoints: `/api/doctor`, `/api/policy-check`, `/api/metrics-history`, `/api/cost-trend`, `/api/schedules`, `/api/schedules/{name}`, `/api/incident/share`
- Enhanced `/api/audit` with filter + summary stats
- Enhanced `/api/logs/{pod}` with `regex` and `since` params
- Enhanced `/api/playbooks` to include team runbooks with `source` field
- Enhanced `/api/ai` with `follow_ups` array

### Testing
- **57 new tests** for all growth features (171 total, 0 regressions)
- Covers: doctor, suggestions, telemetry, scheduler, cost-trend, incident share, team runbooks, AI follow-ups, log regex, policy engine, plugin install, metrics history, command resolution

### Stats
- CLI handlers: 89 → 99 (+10)
- API routes: ~115 → 126 (+11)
- UI pages: 32 → 38 (+6 including enhanced)
- Tests: 114 → 171 (+57)
- Zero new external dependencies

## [1.11.0] — 2025-07-15

### UX Overhaul
- **15 screens improved** with consistent auto-refresh, loading states, and timestamps
- **Pods** — Status filter pills, auto-collapse healthy groups, pod age display, collapse all toggle
- **Events** — Relative time, reason filter chips, clickable heatmap cells, auto-refresh
- **Metrics** — Cluster summary strip, pod search, hot node badges, top 3 rank badges, auto-refresh
- **Monitor** — Parallel card loading with forkJoin, batched refresh timers
- **Logs** — Word wrap toggle, download as .log file
- **Watch Manager** — Create/delete watches from UI (no CLI needed)
- **Scorecard** — Categories sorted by worst score first, auto-refresh (60s)
- **Deployments, Jobs, Namespace, Network, RBAC, Secrets, Timeline, Cost** — Auto-refresh + loading + timestamp

### Performance
- Parallelize cluster overview (CLI + API) with ThreadPoolExecutor
- Parallelize scorecard (4 collectors), diagnosis (events + logs), overview-for-context (3 calls)
- Unified `get_raw_resources()` cached fetcher in core/k8s.py
- Add `@cached` to list_cronjobs, list_jobs, list_hpa, list_pdb, list_role_bindings
- CLI watch: invalidate cache before each refresh for fresh data
- Reduce Live refresh_per_second from 2 to 1 (matches data rate)
- Optimize startup: lazy shutil import for UI dist sync

### Security
- Remove `shell=True` from user-facing API endpoints (inspect, diagnose, revision-diff)
- Keep `shell=False` in get_pod_names (prevent regression)

### Fixes
- Handle None lastTimestamp in events sort
- Fix test_ai_ambiguity patch target after collector refactor
- Fix None context_name in get_raw_resources
- Poll anomalies every 30s so alerts propagate after page load
- Remove duplicate server banner (main.py + serve.py)
- Fix /api/version returning stale 1.7.6

### Other
- Server startup banner with version and URLs
- Refactor events collector to use get_raw_resources

## [1.10.0] — 2025-07-14

### Features
- **Custom Dashboard Builder** — Create personalized dashboards with 18 widget types
  - Named dashboards with save/load
  - Drag-drop widget reordering
  - Per-widget refresh intervals (10s/30s/1m/5m)
  - Topbar workspace dropdown for quick switching
  - Query param routing (`/my-dashboard?name=X`)
- **Webhook Notifications** — Slack, Teams, Webex, generic webhook support
  - Background thread delivery (non-blocking)
  - Settings UI for add/remove/test webhooks
  - Persists to `~/.kubsome/config.yaml`
- **Live Resource Editor** — Fetch, edit, and apply any K8s resource YAML
  - Resource picker (lists existing resources by kind)
  - LIVE badge indicator
  - Dry-run validation
  - Production guard on apply
- **Production Safety Guard** — Enhanced confirmation for destructive ops on prod clusters
  - Red "PRODUCTION ENVIRONMENT" banner
  - Auto-detects via context name
  - Applied to restart, rollback, scale, YAML apply

## [1.9.1] — 2025-07-14

### Features
- **Production Safety Guard** — Destructive operations (restart, rollback, scale) show enhanced confirmation dialog when targeting production clusters
  - Red "PRODUCTION ENVIRONMENT" banner
  - Escalated severity with disruption warning
  - Explicit "I understand, proceed" confirmation
  - Auto-detects prod via context name (prd/prod)

### Documentation
- Added `CHANGELOG.md`
- Added `docs/cli.md` — full command reference
- Added `docs/api.md` — REST + WebSocket endpoints
- Added `docs/web-ui.md` — page-by-page guide
- Added `docs/architecture.md` — system design
- Updated README with documentation links

## [1.9.0] — 2025-07-14

### Features
- **Pod Shell** — Open interactive terminal into any pod from the Web UI
- **Events Heatmap** — 24-cell activity density visualization on Events page
- **Cost Bar Chart** — Visual cost distribution per deployment
- **Network Endpoints** — Service endpoints health + network policies display
- **Jobs Failure Info** — Show failure reason, message, and duration
- **Logs Watch** — CLI `logs <pod> watch` for live streaming
- **Incident Enhancements**
  - Root cause classification on resolve (category + detail + resolution)
  - Action log: track remediation actions during incident
  - Affected resources tagging
  - Snapshot diff: auto-compare pod changes between snapshots
  - Severity badge in banner with color coding
  - Auto AI analysis on incident load
  - Metrics included in cluster snapshots
- **Runbooks Enhancements**
  - Search and severity filter
  - AI-recommended runbooks based on cluster anomalies
  - Info steps auto-complete (bullets/descriptions skip automatically)
  - Step notes for observations
  - Elapsed timer during execution
  - Link-to-incident on completion

### Performance
- Stale-while-revalidate cache with background refresh
- Cache prewarm on CLI and API startup (pods, pod names)
- Pods API default pagination (50 per page)
- Frontend: paginated pod fetch with debounced server-side search
- Resolver fallback to collect_pods cache for instant log resolution

### Fixes
- Jobs UI showing all as "Created" (was reading `status` instead of `state`)
- Pods loading state and empty state handling

## [1.8.3] — 2025-07-14

### Fixes
- `logs c` no longer freezes — short query shows message, no spinner
- Resolver spinner removed (caused terminal conflicts)
- Scale endpoint supports relative mode
- Sidenav favorites includes all sidebar groups
- Button glassmorphism white text on all variants
- Diagnose/inspect 404 — add fuzzy pod resolution from deployment name

## [1.8.2] — 2025-07-13

### Fixes
- CLI resolver 2-char minimum + loading spinner
- Monitor dialog events list fills remaining space

## [1.8.1] — 2025-07-13

### Fixes
- Scale, buttons, favorites hotfixes

## [1.8.0] — 2025-07-13

### Features
- Major UI/CLI feature release
- Onboarding spotlights + skeleton loaders
- Settings page redesign
- Monitor namespace/app loading fixes
- Gateway monitor component
