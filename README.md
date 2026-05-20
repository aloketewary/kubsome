# 🚀 Kubsome

**AI-native Kubernetes Operational Workspace**

Faster debugging. Safer operations. Less cognitive load.

## Install

### From PyPI (recommended)
```bash
pip install kubsome
kubsome init              # Generate default config
kubsome                   # Start
```

With optional features:
```bash
pip install "kubsome[tui]"   # + Full-screen TUI
pip install "kubsome[all]"   # Everything
```

### From source
```bash
git clone https://github.com/aloketewary/kubsome.git && cd kubsome && ./install.sh
```

### Docker
```bash
docker run -p 8000:8000 -v ~/.kube:/root/.kube ghcr.io/aloketewary/kubsome:latest
```

### Homebrew (macOS)
```bash
brew tap aloketewary/kubsome https://github.com/aloketewary/kubsome.git
brew install kubsome
```

### Helm
```bash
helm install kubsome deploy/helm/kubsome/ -n kubsome --create-namespace
```

## Quick Start

```bash
kubsome                          # Interactive CLI
kubsome serve                    # API + Web UI (auto-opens browser)
kubsome tui                      # Full-screen terminal dashboard
kubsome --exec "pods"            # Single command (CI/CD)
```

## Commands (100+)

Type `help` inside Kubsome for the full list. Highlights:

```bash
# Observe
overview                         # Cluster dashboard + anomaly alerts
pods                             # Pod list with health
pods watch                       # Live monitoring
top pods                         # CPU/memory usage
uptime                           # Cluster availability
scorecard                        # A-F health grade

# Operate
logs payment                     # Fuzzy-match pod logs
correlate-logs pod-a pod-b       # Multi-pod log timeline
rollout billing-api              # Rollout status
restart gateway                  # Rolling restart
scale payment 5                  # Scale replicas
rollback-preview billing         # Diff before rollback

# Diagnose
inspect customer                 # Deep pod inspection
diagnose payment                 # Root cause analysis + playbook
dep-health payment-api           # Dependency health map
trace payment-api                # Resource relationship map
fix payment-api                  # Auto-remediate (non-prod)

# AI (natural language)
why is payment-api failing       # Root cause explanation
how many customer pods running   # Pod count
is it safe to restart billing    # Risk analysis
summarize cluster health         # Health summary
what changed recently            # Activity analysis

# kubectl (fuzzy)
describe pod customer            # Fuzzy → full inspect view
get pods                         # Pretty table
kubectl describe customer        # Auto-resolves pod name
delete pod billing               # Fuzzy match + confirm

# Cost & Security
cost-estimate                    # $/month per deployment
security                         # Misconfiguration scan
optimize                         # Resource right-sizing

# Monitoring
watch-alert payment crash        # Background monitor
watch-status                     # Active watches
diff-timeline                    # What changed in 24h
pin "health" "scorecard"         # Save query for dashboard
pins                             # List saved queries

# Incident Mode
incident start API outage        # Start tracking
note found OOM in payment        # Add observation
incident share                   # Share to Slack/Teams
incident stop                    # Close & export report

# Growth (v1.12)
doctor                           # Pre-flight diagnostics
policy                           # Check cluster guardrails
cost-trend                       # Cost forecast + savings
stats                            # Usage analytics
schedule add daily "0 8 * * *" scorecard,export
plugin install <name>            # Install from registry
logs pod --regex "OOM" --since 1h
```

## Features

- **NLP Intent Engine** — structured intent classification + entity extraction
- **Fuzzy matching** — type partial names, Kubsome finds the resource
- **Smart suggestions** — typo correction ("Did you mean: pods")
- **Natural language** — "show me logs for payment" just works
- **AI disambiguation** — asks which pod when multiple match
- **Auto-remediation** — safe auto-fix with production guard
- **Cluster scorecard** — A-F grade across 4 dimensions
- **Cost estimation** — $/month per deployment
- **Dependency health** — find root cause via service graph
- **Watch & alert** — background monitoring with notifications
- **26 runbooks** — step-by-step remediation guides
- **Command chaining** — `pods && events && alerts`
- **Aliases** — `p`=pods, `o`=overview, `d`=diagnose, `l`=logs
- **Bookmarks** — save and recall frequent commands
- **Workflows** — chain commands into reusable sequences
- **Watch mode** — `watch <any-command>` for live refresh
- **Multi-pod log correlation** — merged timeline from multiple pods
- **YAML diff** — side-by-side revision comparison
- **Multi-cluster compare** — drift detection between environments
- **Export** — Markdown/JSON reports for sharing
- **Audit log** — tracks all destructive operations
- **Plugin system** — extend with custom commands
- **Plugin marketplace** — install from registry (`plugin install <name>`)
- **Policy engine** — define guardrails in `.kubsome/policies.yaml`
- **Scheduled workflows** — cron-like recurring commands
- **Cost forecasting** — projected spend based on usage trend
- **Incident sharing** — export to Slack/Teams/PagerDuty/OpsGenie
- **Team runbooks** — Git-synced `.kubsome/runbooks/` directory
- **AI follow-ups** — contextual next-question suggestions
- **Log regex search** — `logs <pod> --regex "pattern" --since 1h`
- **7-day metrics history** — usage trends for right-sizing
- **171 tests** — comprehensive test coverage

## Requirements

- Python 3.9+
- kubectl configured with cluster access
- metrics-server (for `top` commands)

## Configuration

Settings in `~/.kubsome/config.yaml`:
```yaml
refresh_interval: 2
notifications: true
theme: dark                      # dark, light, minimal, hacker
aliases:
  p: pods
  o: overview
  d: diagnose
llm:
  provider: local                # or: ollama
```

## Architecture

```
User Input
   ↓
Command Resolver (exact match)
   ↓ (not found)
Rule-Based NLP (regex patterns)
   ↓ (not found)
Intent Engine (fuzzy classification + entity extraction)
   ↓ (not found)
Suggestion Fallback ("Did you mean: pods")
```

```
main.py              → Entry point (CLI, serve, tui, exec)
core/nlp/            → Intent engine (intents, matcher, actions)
core/ai/             → 8 intelligence modules + 26 playbooks
core/collectors/     → 30+ data collectors
core/renderers/      → 21 presentation renderers
core/diagnostics/    → Root cause engine
core/remediation.py  → Auto-fix with safety guards
core/watch_alert.py  → Background condition monitoring
core/cache.py        → TTL cache for kubectl calls
core/scheduler.py    → Cron-like recurring commands
core/policy.py       → Cluster guardrail enforcement
core/telemetry.py    → Local usage analytics
api/                 → FastAPI REST + WebSocket backend (126 routes)
ui/                  → Angular 20 + PrimeNG web dashboard (38 pages)
deploy/helm/         → Helm chart for in-cluster deployment
deploy/krew/         → kubectl plugin for krew
tests/               → 171 tests
```

## Web UI

Access at `http://localhost:8000/app` after `kubsome serve`.

Pages: Dashboard, Monitor, Pods, Events, Metrics, Deployments, Logs, Jobs, RBAC, Network, Resources, Scorecard, Cost, Runbooks, Compare, AI Assistant, Terminal, Settings, Audit, Policy, Health, Schedules.

See [docs/web-ui.md](docs/web-ui.md) for detailed page descriptions.

## Documentation

- [CLI Guide](docs/cli.md) — Full command reference
- [API Reference](docs/api.md) — REST + WebSocket endpoints
- [Web UI Guide](docs/web-ui.md) — Page-by-page walkthrough
- [Architecture](docs/architecture.md) — System design and patterns
- [Roadmap](docs/roadmap.md) — Planned features and milestones
- [Changelog](CHANGELOG.md) — Release history

## License

MIT
