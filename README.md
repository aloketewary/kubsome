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
pip install "kubsome[api]"   # + REST API + Web UI
pip install "kubsome[all]"   # Everything
```

### From source
```bash
git clone https://github.com/aloketewary/kubsome.git && cd kubsome && ./install.sh
```

Then:
```bash
source venv/bin/activate
kubsome
```

## Quick Start

```bash
kubsome                          # Interactive CLI
kubsome --exec "check"           # Single command (CI/CD)
kubsome --exec "export json"     # Generate report
```

## Commands (85+)

Type `help` inside Kubsome for the full list. Highlights:

```bash
# Observe
overview                         # Cluster dashboard + anomaly alerts
pods                             # Pod list with health
pods watch                       # Live monitoring
top pods                         # CPU/memory usage

# Operate
logs payment                     # Fuzzy-match pod logs
logcat payment --follow          # Combined logs from all replicas (logcat style)
rollout billing-api              # Rollout status
restart gateway                  # Rolling restart
scale payment 5                  # Scale replicas

# Diagnose
inspect customer                 # Deep pod inspection
diagnose payment                 # Root cause analysis + playbook
trace payment-api                # Resource relationship map
netcheck auth                    # Network diagnostics

# AI (natural language)
why is payment-api failing       # Root cause explanation
summarize cluster health         # Health summary
which pods are unhealthy         # Degraded pod list
any anomalies detected           # Anomaly scan
what changed recently            # Recent activity

# Security & Cost
security                         # Misconfiguration scan
optimize                         # Resource right-sizing
unused                           # Find orphaned resources

# Incident Mode
incident start API outage        # Start tracking
note found OOM in payment        # Add observation
incident stop                    # Close & export report
```

## Features

- **Fuzzy matching** — type partial names, Kubsome finds the resource
- **Smart suggestions** — typo correction ("Did you mean: pods")
- **Natural language** — "show me logs for payment" just works
- **Command chaining** — `pods && events && alerts`
- **Aliases** — `p`=pods, `o`=overview, `d`=diagnose, `l`=logs
- **Bookmarks** — save and recall frequent commands
- **Workflows** — chain commands into reusable sequences
- **Watch mode** — `watch <any-command>` for live refresh
- **Logcat** — combined logs from all pods of a deployment
- **Playbooks** — step-by-step remediation guides
- **Anomaly detection** — restart spikes, event storms, cascading failures
- **Multi-cluster compare** — drift detection between environments
- **Export** — Markdown/JSON reports for sharing
- **Audit log** — tracks all destructive operations
- **Desktop notifications** — alerts for critical issues
- **Plugin system** — extend with custom commands
- **Persistent history** — command recall across sessions
- **Production safety** — confirmation prompts for dangerous actions

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
  provider: local                # or: ollama (for AI-powered explain)
```

## Architecture

```
main.py              → 150 lines, clean entry point
core/dispatcher.py   → Command handler registry
core/ai/             → 8 intelligence modules
core/collectors/     → 24 data collectors
core/renderers/      → 21 presentation renderers
core/diagnostics/    → Root cause engine
100 Python files     → Complete operational platform
```

## License

MIT
