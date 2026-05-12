# API Reference

Base URL: `http://localhost:8000/api`

Interactive docs: `http://localhost:8000/docs` (Swagger UI)

## Endpoints

### Health
| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Health check |
| GET | `/api/version` | API version |

### Pods
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/pods?page=1&size=50&search=` | List pods (paginated) |

Query params:
- `page` (int, default 1) — page number
- `size` (int, default 50) — items per page, 0 = all
- `search` (string) — filter by pod name

### Overview
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/overview` | Cluster health counts (pods/nodes/deployments) |

### Contexts
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/contexts` | List kube contexts |
| POST | `/api/switch-context` | Switch active context |
| GET | `/api/namespaces` | List namespaces |
| POST | `/api/switch-namespace` | Switch namespace |

### Events
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/events?limit=50` | Recent events |

### Metrics
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/top/pods` | Pod CPU/memory metrics |
| GET | `/api/top/nodes` | Node CPU/memory metrics |

### Deployments
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/deployments` | List deployments |
| GET | `/api/rollout/{name}` | Rollout status + history |
| POST | `/api/restart/{name}` | Rolling restart |
| POST | `/api/rollback/{name}` | Rollback to previous |
| POST | `/api/scale/{name}` | Scale replicas |

### Logs
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/logs/{pod}?tail=100&errors=false&container=` | Fetch logs |
| GET | `/api/logs/{pod}/containers` | List containers |
| GET | `/api/logs/{pod}/stream` | Stream logs (SSE) |

### Diagnostics
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/inspect/{name}` | Pod inspection |
| GET | `/api/diagnose/{name}` | AI diagnosis |
| GET | `/api/trace/{name}` | Resource trace |

### Intelligence
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/ai` | Natural language query |
| GET | `/api/anomalies` | Anomaly detection |
| GET | `/api/optimize` | Resource recommendations |
| GET | `/api/security` | Security scan |
| GET | `/api/search?q=` | Resource search |

### Network
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/ingress` | List ingresses |
| GET | `/api/mesh` | Service mesh detection |
| GET | `/api/endpoints` | Service endpoints health |
| GET | `/api/network-policies` | Network policy count |
| GET | `/api/dns/{service}` | DNS debug |
| GET | `/api/netcheck/{pod}` | Network diagnostics |

### Jobs
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/cronjobs` | List cronjobs |
| GET | `/api/jobs` | List jobs (with failure info) |
| POST | `/api/trigger/{name}` | Trigger cronjob |

### Incident
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/incident/start` | Start incident |
| POST | `/api/incident/stop` | Stop with root cause |
| GET | `/api/incident/status` | Active incident |
| POST | `/api/incident/note` | Add note |
| POST | `/api/incident/snapshot` | Capture state |
| POST | `/api/incident/action` | Log remediation action |
| GET | `/api/incident/history` | Past incidents |
| GET | `/api/incident/report?path=` | Read report |

### Operations
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/scorecard` | Cluster scorecard |
| GET | `/api/cost-estimate` | Cost estimation |
| GET | `/api/uptime` | Cluster uptime |
| GET | `/api/timeline?minutes=60` | Event timeline |
| GET | `/api/playbooks` | List runbooks |
| GET | `/api/playbook/{issue}` | Get specific playbook |
| POST | `/api/compare` | Multi-cluster compare |
| POST | `/api/exec` | Execute command |

### WebSocket
| Path | Description |
|------|-------------|
| `/ws/pods` | Live pod updates |
| `/ws/events` | Live event stream |
| `/ws/logs/{pod}` | Live log streaming |
| `/ws/shell/{pod}` | Interactive pod shell |

## Authentication

No authentication by default. For production, deploy behind an ingress with auth or use the Helm chart with RBAC.

## CORS

All origins allowed by default (`*`). Configure in `api/app.py` for production.
