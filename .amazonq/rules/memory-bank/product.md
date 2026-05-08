# Kubsome — Product Overview

## Purpose
Kubsome is an AI-native Kubernetes Operations Platform that reduces operational cognitive load through faster debugging, safer production operations, and intelligent cluster insights. It provides CLI, Web UI, TUI, and API interfaces for managing Kubernetes clusters.

## Value Proposition
- **Faster debugging** — diagnose + AI explain failures in seconds
- **Safer operations** — confirmation dialogs, incident tracking, production guards
- **Less mental load** — visual health indicators, smart suggestions, anomaly detection
- **Multi-interface** — CLI for speed, UI for visibility, API for integration
- **Extensible** — plugin system for org-specific workflows

## Key Features

### Observability
- Cluster overview with pod/node/deployment health analysis
- Real-time pod watching with live updates (WebSocket)
- Event streaming and anomaly detection
- Resource metrics (CPU/memory) for pods and nodes
- Timeline and changelog tracking

### Operations
- Deployment rollout/rollback/restart/scale
- Log viewing with error filtering, multi-pod combined logs (logcat)
- CronJob/Job management and triggering
- Port forwarding, shell access
- YAML apply, state snapshots, diff comparisons

### Diagnostics
- Pod inspection with detailed status extraction
- Automated diagnosis with AI-matched playbooks
- Resource tracing (deployment → replicaset → pods → services)
- Security scanning, unused resource detection
- Network checks, DNS debugging

### AI Intelligence
- Natural language queries about cluster health
- Anomaly detection and correlation
- Playbook matching for common issues
- Manifest generation, resource explanation
- NLP command parsing with suggestion fallback

### Incident Management
- Start/stop incident tracking
- Timestamped notes and cluster snapshots
- Active incident status monitoring

### Infrastructure
- RBAC role binding inspection
- HPA/PDB/capacity/quota management
- Service mesh detection, ingress listing
- Multi-cluster comparison

## Target Users
- DevOps engineers managing Kubernetes clusters
- SREs debugging production incidents
- Platform engineers building internal tooling
- Developers needing quick cluster visibility

## Interfaces
| Interface | Port | Entry Point |
|-----------|------|-------------|
| CLI | — | `python3 main.py` |
| API | :8000 | `python3 main.py serve` |
| Web UI | :3001 | `cd ui && ng serve` |
| TUI | — | `tui` command in CLI |
