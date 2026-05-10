# Product Overview — Kubsome

## Purpose
Kubsome is an AI-native Kubernetes Operational Workspace that reduces cognitive load for Kubernetes operators. It provides faster debugging, safer operations, and intelligent automation through a unified CLI, API, TUI, and Web UI.

## Value Proposition
- Replaces raw kubectl with fuzzy-matched, context-aware commands
- Natural language queries for cluster operations ("why is payment-api failing")
- AI-powered root cause analysis, anomaly detection, and auto-remediation
- Multi-modal access: Interactive CLI, REST API, full-screen TUI, Angular Web Dashboard

## Key Features
- **100+ commands** covering observe, operate, diagnose, cost, security, and incident workflows
- **NLP Intent Engine** — structured intent classification + entity extraction for natural language
- **Fuzzy matching** — partial names resolve to full resource names via rapidfuzz
- **AI Intelligence** — 8 modules (anomaly, correlation, explain, suggest, playbooks, generator, LLM, engine)
- **26 runbooks** — step-by-step remediation guides for common issues
- **Cluster scorecard** — A-F health grade across 4 dimensions
- **Cost estimation** — $/month per deployment based on resource requests
- **Auto-remediation** — safe auto-fix with production guard rails
- **Watch & alert** — background monitoring with desktop notifications
- **Multi-cluster compare** — drift detection between environments
- **Incident mode** — start/stop tracking with notes, snapshots, and export
- **Plugin system** — extend with custom Python commands
- **Web UI** — Angular 20 + PrimeNG dashboard with 18 pages
- **Command chaining** — `pods && events && alerts`
- **Aliases & bookmarks** — save and recall frequent commands
- **Workflows** — chain commands into reusable sequences
- **Export** — Markdown/JSON reports for sharing
- **Audit log** — tracks all destructive operations

## Target Users
- DevOps engineers managing Kubernetes clusters
- SREs performing incident response and root cause analysis
- Platform engineers monitoring cluster health
- Developers debugging application issues in Kubernetes

## Use Cases
- Real-time cluster monitoring and health assessment
- Incident response with timeline correlation
- Cost optimization and resource right-sizing
- Security misconfiguration scanning
- Multi-cluster drift detection
- CI/CD integration via `--exec` mode
- Team dashboards via Web UI
