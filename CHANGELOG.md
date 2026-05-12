# Changelog

All notable changes to Kubsome are documented here.

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
