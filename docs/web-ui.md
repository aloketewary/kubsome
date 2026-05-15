# Web UI Guide

Access the Web UI at `http://localhost:8000/app` after running `kubsome serve`.

## Pages

### Dashboard
Cluster health overview with:
- Health ring (overall percentage)
- Pod/Node/Deployment bento cards with progress bars
- Uptime status card
- Event activity bar chart + pod distribution donut
- Recent events list
- Quick action shortcuts

### Pods
Pod management grouped by deployment:
- Health bars per deployment group
- Multi-select for combined log views (logcat)
- Per-pod actions: Logs, Live stream, Shell, Inspect, AI Diagnose
- Pagination with load-more for large clusters
- Server-side search

### Events
Real-time Kubernetes events:
- Activity heatmap (24-cell density visualization)
- Warning/Normal filter pills
- Full-text search
- Live watch mode via WebSocket
- Expandable event messages

### Metrics
CPU and memory usage:
- Node gauge rings (CPU + Memory %)
- Pod resource table sorted by CPU or Memory
- Color-coded thresholds (green/yellow/red)

### Deployments
Deployment management:
- Replica dot visualization
- Rolling restart, rollback, scale actions
- Scale dialog with visual preview
- Rollout history viewer
- AI diagnosis per deployment

### Logs
Dedicated log viewer:
- Pod + container selection
- Tail size control (50/100/200/500)
- Live streaming via WebSocket
- Watch mode (auto-refresh every N seconds)
- Error/Warn level filters
- Full-text search with match count
- Fullscreen mode
- Copy all logs

### Jobs
Jobs and CronJobs:
- CronJob cards with schedule + trigger button
- Job progress pipeline (Created → Running → Done/Failed)
- Failure reason and message display
- Duration tracking

### Network
Network diagnostics:
- Ingress routes with flow diagram (External → Path → Service)
- Service endpoints health (ready/not-ready counts)
- Network policies count
- DNS lookup tool
- Service mesh detection

### Incident
Production incident tracking:
- Start with title + severity
- Affected resources tagging
- AI insight cards (probable cause, blast radius, health score)
- Action log (restart/scale/rollback/config_change)
- Snapshot with diff comparison
- Timeline with notes
- Resolve with root cause classification + resolution
- Past incidents history with reports

### Runbooks
Step-by-step remediation guides:
- 26 playbooks covering common K8s issues
- Search and severity filter (Critical/High/Medium)
- AI-recommended runbooks based on current anomalies
- Parameterized commands with inline execution
- Step notes for observations
- Elapsed timer
- Link execution to active incident

### Scorecard
Cluster health grading:
- Overall A-F grade with ring visualization
- 4 category cards (availability, stability, resources, operations)
- Score bars per category
- Improvement recommendations

### Cost Estimate
Monthly cost estimation:
- Total $/month banner
- Cost distribution bar chart (top 10 deployments)
- Per-deployment table (replicas, CPU, memory, cost)

### Compare
Multi-cluster drift detection:
- Context A vs Context B selection
- Namespace selection per context
- Drift summary (in-sync or differences)
- Configuration drift details (field-level diff)
- Resources only in A or B

### Timeline
Chronological change history:
- Time range selector (5m/15m/30m/1h)
- Activity heatmap
- Severity filter (All/Warnings/Deployments)
- Event cards with icons, timestamps, repeat counts

### AI Assistant
Natural language chat interface:
- Suggestion categories (Diagnose/Analyze/Investigate)
- Chat bubbles with typing indicator
- Disambiguation (asks which pod when multiple match)
- Copy message button
- Severity badges on responses

### Other Pages
- **RBAC** — Role bindings viewer
- **Secrets** — Secrets management
- **Graph** — Dependency graph (cytoscape)
- **Terminal** — In-browser kubectl terminal
- **Settings** — Theme, config, context management
- **Monitor** — Gateway/app monitoring
- **Namespace** — Namespace overview
- **Resources** — All resource types
- **Pins** — Saved queries
- **Watches** — Background alert management

## New Pages (v1.12)

### Audit
Team operation log dashboard:
- Summary cards showing action counts (restart, rollback, scale, delete)
- Filterable by action type (click card or dropdown)
- Relative timestamps (just now, 5m ago, 2h ago)
- Color-coded icons per action type
- Context + namespace per entry

### Policy
Cluster guardrail compliance:
- Pass/fail score banner with counts
- Policy list with check/cross status
- Severity badges (high/medium/low)
- Violation details with resource name and description
- Configurable via `.kubsome/policies.yaml`

### Doctor (Health)
Pre-flight system diagnostics:
- kubectl connectivity check
- Cluster reachability
- metrics-server availability
- Config file validation
- Namespace existence
- Optional dependency status
- Pass/Warning/Fail badges per check

### Schedules
Recurring command manager:
- Create schedules with name, cron expression, commands
- Cron presets (Every 30min, Hourly, Daily 8am, etc.)
- Shows next run estimate and last run time
- Command chips per schedule
- Notify badge for desktop notifications
- Delete button per schedule
