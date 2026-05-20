# 🗺️ Roadmap — Kubsome

## Completed

### v1.13 — GitOps & Service Mesh ✅
- [x] ArgoCD integration (detect, list apps, sync status, drift)
- [x] Flux integration (Kustomizations, sync status)
- [x] GitOps detail view (per-resource sync, conditions, revision)
- [x] Istio VirtualService routing (canary weights, timeouts, retries, fault injection)
- [x] Istio DestinationRules (circuit breakers, outlier detection, subsets)
- [x] mTLS enforcement status (PeerAuthentication policies)
- [x] Sidecar injection coverage (pods without proxy)
- [x] Linkerd support (proxy detection, ServerAuthorization)
- [x] Web UI: GitOps page + Service Mesh page (4 tabs)
- [x] 6 new API endpoints

### v1.12 — Growth & Activation ✅
- [x] `kubsome doctor` pre-flight diagnostics
- [x] Scheduled workflows (cron-like)
- [x] Cost trend & forecast
- [x] Incident sharing (Slack/Teams/PagerDuty/OpsGenie)
- [x] Policy engine with 7 built-in rules
- [x] Plugin marketplace
- [x] AI follow-up suggestions
- [x] Log regex search
- [x] 7-day metrics history

### v1.11 — UX & Performance ✅
- [x] 15 screens improved with auto-refresh
- [x] Parallel kubectl calls (ThreadPoolExecutor)
- [x] Stale-while-revalidate cache
- [x] Watch Manager UI

### v1.10 — Custom Dashboards ✅
- [x] Custom Dashboard Builder (18 widget types)
- [x] Webhook notifications (Slack/Teams/Webex)
- [x] Live Resource Editor (fetch/edit/apply YAML)
- [x] Production Safety Guard

---

## Planned

### v1.14 — Observability Integration
- [ ] Prometheus metrics integration (real time-series graphs)
- [ ] Grafana dashboard embedding / linking
- [ ] Jaeger/Tempo trace visualization (request flow)
- [ ] Custom metrics in scorecard (latency P99, error rate)
- [ ] Alertmanager integration (show firing alerts)
- [ ] Metrics-based anomaly detection (not just pod status)

### v1.15 — Developer Experience
- [ ] Port-forward management (start/stop/list from UI + CLI)
- [ ] Ephemeral debug containers (`debug <pod>`)
- [ ] Exec into pod from Web UI (xterm.js)
- [ ] Container file browser (ls/cat/download)
- [ ] CPU/memory profiling (`flame <pod>`)
- [ ] Packet capture (`sniff <pod>`)

### v1.16 — GitOps Deep Integration
- [ ] ArgoCD sync trigger from UI (`sync <app>`)
- [ ] Flux reconcile trigger
- [ ] Git commit → deployment correlation ("who deployed what")
- [ ] Rollback to specific Git revision
- [ ] Drift auto-detection alerts (watch-alert for GitOps)
- [ ] PR preview environments status

### v1.17 — Multi-Tenancy & Auth
- [ ] SSO/OIDC authentication for Web UI
- [ ] Role-based access control (viewer/operator/admin)
- [ ] Team-scoped views (namespace isolation)
- [ ] Audit log per user
- [ ] API key management
- [ ] Session management (timeout, revoke)

### v1.18 — CI/CD & Pipeline Visibility
- [ ] Tekton pipeline status
- [ ] GitHub Actions integration (deployment status)
- [ ] ArgoCD ApplicationSet support
- [ ] Deployment frequency metrics (DORA)
- [ ] Change failure rate tracking
- [ ] Lead time for changes

### v1.19 — Storage & Networking
- [ ] PV/PVC management and troubleshooting
- [ ] Storage class overview
- [ ] Volume snapshot management
- [ ] NetworkPolicy visualization (who can talk to whom)
- [ ] Service mesh traffic graph (live request flow)
- [ ] Ingress controller metrics (NGINX/Traefik)

### v1.20 — Enterprise & Scale
- [ ] Multi-cluster fleet management (single pane)
- [ ] Cluster provisioning (EKS/GKE/AKS)
- [ ] Helm chart lifecycle (install/upgrade/rollback from UI)
- [ ] CRD browser and editor
- [ ] OPA/Gatekeeper policy visualization
- [ ] Compliance reporting (SOC2, HIPAA checks)

---

## Backlog (Unscheduled)

### Performance
- [ ] Go/Rust sidecar for real-time streaming (replace Python subprocess)
- [ ] WebSocket-based live metrics (no polling)
- [ ] Server-sent events for watch alerts
- [ ] Incremental pod list updates (delta sync)

### Intelligence
- [ ] ML-based anomaly detection (trained on cluster history)
- [ ] Predictive scaling recommendations
- [ ] Change impact analysis ("what will break if I scale down X")
- [ ] Natural language → kubectl generation with dry-run
- [ ] Multi-cluster AI correlation

### Ecosystem
- [ ] VS Code extension
- [ ] Terraform state integration
- [ ] AWS CloudWatch / Azure Monitor bridge
- [ ] Datadog/New Relic APM correlation
- [ ] Backstage plugin

---

## Contributing

Want to help? Pick any unchecked item and open a PR. Priority items are in the next planned version.

See [CONTRIBUTING.md](../CONTRIBUTING.md) for development setup.
