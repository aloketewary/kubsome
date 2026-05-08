# ◆ KubeEasy

**AI-native Kubernetes Operations Platform**

CLI + Web UI + API — reduces operational cognitive load with faster debugging, safer production operations, and intelligent cluster insights.

## Quick Start

```bash
# Clone & install
git clone https://github.com/atewary/kubeasy.git
cd kubeasy
python3 -m venv venv && source venv/bin/activate
pip install -r requirements.txt
cd ui && npm install && cd ..

# Development (API + UI hot-reload)
./dev.sh

# Production (single port)
./start.sh
```

## Architecture

```
kubeasy/
├── core/              → Kubernetes engine (collectors, analyzers, AI)
├── api/               → FastAPI backend (71 REST + 4 WebSocket endpoints)
├── ui/                → Angular 20 + PrimeNG dark dashboard
├── tui/               → Textual full-screen terminal app
├── plugins/           → Custom command plugins
├── dev.sh             → Start both servers for development
└── start.sh           → Production build & serve
```

## Interfaces

| Interface | Port | Purpose |
|-----------|------|---------|
| CLI | — | `python3 main.py` — interactive terminal |
| API | :8000 | `python3 main.py serve` — REST + WebSocket |
| UI | :3001 | `cd ui && ng serve` — Angular dashboard |
| TUI | — | `python3 main.py` then `tui` — full-screen |

## Web UI Features

### Dashboard
- Cluster health cards (clickable → navigate to detail)
- Recent events feed
- Quick action buttons
- Auto-refresh every 30s with skeleton loading

### Pods
- Grouped by deployment, unhealthy groups at top
- Search/filter
- Multi-select within group for combined logs (logcat)
- Single-select: Logs, Inspect, Diagnose, Live Logs (WebSocket)
- Pod detail drawer (slide-out with tabs)
- Watch mode (real-time WebSocket updates)

### Deployments
- Rollout progress visualization
- Restart / Rollback / Scale actions
- Rollout history dialog
- Link to deployment's pods

### Logs
- Pod selector with filter
- Errors-only toggle
- Line numbers, error highlighting
- Live streaming via WebSocket

### Events, Metrics, Jobs, RBAC, Network, Namespace
- Full feature parity with CLI

### Incident Mode
- Start/stop tracking
- Add timestamped notes
- Capture cluster snapshots

### AI Assistant
- Floating chat panel (always accessible)
- Full-page mode for longer sessions
- Natural language queries about cluster health

### Terminal
- Web-based CLI with command history
- Supports all KubeEasy commands + raw kubectl

### UX
- ⌘K Command Palette (search pages, pods, deployments)
- Keyboard shortcuts (G+D, G+P, G+L, G+T, H)
- Toast notifications for pod crashes (WebSocket)
- Breadcrumb navigation
- Collapsible sidebar with favorites
- Status bar with connection indicator
- Dark theme throughout

## API Endpoints

### Core
```
GET  /health
GET  /api/overview
GET  /api/pods
GET  /api/events
GET  /api/top/pods
GET  /api/top/nodes
GET  /api/contexts
GET  /api/namespaces
POST /api/switch-context
POST /api/switch-namespace
```

### Operations
```
GET  /api/deployments
GET  /api/rollout/{name}
POST /api/restart/{name}
POST /api/rollback/{name}
POST /api/scale/{name}
GET  /api/logs/{pod}
GET  /api/logs/{pod}/stream
POST /api/exec
```

### Diagnostics
```
GET  /api/inspect/{pod}
GET  /api/diagnose/{pod}
GET  /api/trace/{name}
GET  /api/search?q=
GET  /api/security
GET  /api/health-check
GET  /api/anomalies
GET  /api/optimize
GET  /api/unused
```

### Intelligence
```
POST /api/ai
POST /api/explain
POST /api/generate
GET  /api/correlate
GET  /api/playbook/{issue}
```

### Infrastructure
```
GET  /api/cronjobs
GET  /api/jobs
POST /api/trigger/{name}
GET  /api/rbac
GET  /api/hpa
GET  /api/pdb
GET  /api/capacity
GET  /api/quota
GET  /api/ingress
GET  /api/mesh
GET  /api/dns/{service}
GET  /api/timeline
GET  /api/changelog
GET  /api/audit
```

### Incident
```
POST /api/incident/start
POST /api/incident/stop
GET  /api/incident/status
POST /api/incident/note
POST /api/incident/snapshot
```

### WebSocket
```
ws://localhost:8000/ws/pods      → Live pod status
ws://localhost:8000/ws/events    → Live events
ws://localhost:8000/ws/logs/{pod} → Live log stream
ws://localhost:8000/ws/shell/{pod} → Interactive shell
```

## CLI Commands

### Workspace
```
switch <context>    contexts    use <namespace>
```

### Observability
```
overview    pods    pods watch    events    events watch
top pods    top nodes    ns
```

### Operations
```
logs <pod>    logs <pod> --follow    logs <pod> --errors
rollout <dep>    rollback <dep>    restart <dep>    scale <dep> <n>
```

### Diagnostics
```
inspect <pod>    diagnose <pod>    trace <dep>
```

### AI
```
why is <pod> failing    summarize    what changed
which pods are unhealthy    is <dep> healthy
```

### Advanced
```
find <query>    compare <ctx-a> <ctx-b>    incident start/stop/note
security    optimize    unused    check    export
cronjobs    jobs    trigger <cj>    rbac    timeline
hpa    pdb    capacity    quota    ingress    mesh
```

## Requirements

- Python 3.9+
- Node.js 18+
- kubectl configured with cluster access
- metrics-server (for `top` commands)

## Philosophy

KubeEasy is not a kubectl wrapper. It's an **operational intelligence platform**:

- **Faster debugging** — diagnose + AI explain failures in seconds
- **Safer operations** — confirmation dialogs, incident tracking
- **Less mental load** — visual health indicators, smart suggestions
- **Multi-interface** — CLI for speed, UI for visibility, API for integration
- **Extensible** — plugin system for org-specific workflows

## License

MIT
