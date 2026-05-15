# Changelog

All notable changes to Kubsome are documented here.

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
