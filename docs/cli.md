# CLI Guide

## Modes

```bash
kubsome                    # Interactive CLI (default)
kubsome serve [port]       # API + Web UI server
kubsome serve --no-browser # Server without opening browser
kubsome tui                # Full-screen terminal dashboard
kubsome --exec "command"   # Single command (CI/CD)
kubsome init               # Generate default config
```

## Command Reference

### Observe
| Command | Description |
|---------|-------------|
| `overview` / `o` | Cluster dashboard + anomaly alerts |
| `pods` / `p` | Pod list with health status |
| `pods watch` | Live pod monitoring |
| `top pods` | Pod CPU/memory usage |
| `top nodes` | Node CPU/memory usage |
| `events` / `e` | Recent cluster events |
| `events watch` | Live event stream |
| `uptime` | Cluster availability |
| `scorecard` | A-F health grade |

### Logs
| Command | Description |
|---------|-------------|
| `logs <pod>` | Fetch pod logs (fuzzy match) |
| `logs <pod> --follow` / `-f` | Live streaming |
| `logs <pod> watch` | Live streaming (alias) |
| `logs <pod> --errors` | Error lines only |
| `logs <pod> --previous` | Previous container |
| `logs <pod> -c <container>` | Specific container |
| `logs <pod> --regex "pattern"` | Filter by regex |
| `logs <pod> --since 1h` | Time range filter |
| `logcat <deployment>` | Combined logs from all pods |
| `logcat <dep> --follow` | Live combined stream |
| `correlate-logs <pod1> <pod2>` | Merged timeline |

### Diagnose
| Command | Description |
|---------|-------------|
| `inspect <pod>` | Deep pod inspection |
| `diagnose <pod>` / `d` | Root cause analysis |
| `dep-health <deployment>` | Dependency health map |
| `trace <resource>` | Resource relationship map |
| `fix <pod>` | Auto-remediate (non-prod only) |

### Operate
| Command | Description |
|---------|-------------|
| `rollout <deployment>` | Rollout status + history |
| `restart <deployment>` | Rolling restart |
| `scale <deployment> <n>` | Scale replicas |
| `rollback <deployment>` | Rollback (with confirmation) |
| `rollback-preview <dep>` | Diff before rollback |
| `shell <pod>` | Interactive shell into pod |
| `forward <pod> <port>` | Port forward |
| `apply <file>` | kubectl apply |

### AI / Natural Language
| Command | Description |
|---------|-------------|
| `why is <pod> failing` | Root cause explanation |
| `how many <name> pods` | Pod count |
| `is it safe to restart <dep>` | Risk analysis |
| `summarize cluster health` | Health summary |
| `what changed recently` | Activity analysis |
| `explain <concept>` | K8s concept explainer |
| `generate <kind> <name>` | YAML manifest generator |

### kubectl (fuzzy)
| Command | Description |
|---------|-------------|
| `describe pod <name>` | Pretty-printed describe |
| `get pods` | Formatted table |
| `delete pod <name>` | With confirmation |

### Cost & Security
| Command | Description |
|---------|-------------|
| `cost-estimate` | $/month per deployment |
| `security` | Misconfiguration scan |
| `optimize` | Resource right-sizing |
| `unused` | Find unused resources |

### Monitoring
| Command | Description |
|---------|-------------|
| `watch-alert <pod> [crash\|restart\|count]` | Background monitor |
| `watch-status` | Active watches |
| `diff-timeline` | Changes in last 24h |
| `alerts` | Current anomalies |
| `correlate [target]` | Signal correlation |

### Incident
| Command | Description |
|---------|-------------|
| `incident start <title>` | Start tracking |
| `note <text>` | Add observation |
| `incident share` | Share to Slack/Teams/webhooks |
| `incident share <id>` | Share past incident |
| `incident stop` | Close + export |
| `incident status` | Current state |
| `incident history` | Past incidents |

### Growth & Governance
| Command | Description |
|---------|-------------|
| `doctor` | Pre-flight diagnostics |
| `policy` | Check cluster guardrails |
| `cost-trend` | Cost forecast + savings |
| `stats` | Usage analytics |
| `schedule` | List scheduled workflows |
| `schedule add <name> "<cron>" <cmds>` | Add recurring schedule |
| `schedule rm <name>` | Remove schedule |
| `plugin install <name>` | Install from registry |
| `plugin rm <name>` | Uninstall plugin |

### Utilities
| Command | Description |
|---------|-------------|
| `contexts` | List kube contexts |
| `switch <context>` | Switch context |
| `use <namespace>` | Switch namespace |
| `find <query>` | Search all resources |
| `timeline` | Event timeline |
| `changelog` | Recent changes |
| `snap` | Capture state snapshot |
| `snap-diff` | Compare with last snapshot |
| `labels <type> [name]` | View labels |
| `rbac` | Role bindings |
| `hpa` | Horizontal pod autoscalers |
| `pdb` | Pod disruption budgets |
| `capacity` | Cluster capacity |
| `quota` | Namespace quotas |
| `check` | Health checks |
| `export [md\|json]` | Export report |
| `audit` | Audit log |

### Workflows & Bookmarks
| Command | Description |
|---------|-------------|
| `bookmark add <name> <cmd>` | Save command |
| `bookmark rm <name>` | Remove bookmark |
| `bookmarks` | List bookmarks |
| `run <bookmark>` | Execute bookmark |
| `workflows` | List workflows |
| `workflow <name>` | Run workflow |
| `pin <name> <query>` | Save query |
| `pins` | List saved queries |

### Command Chaining
```bash
pods && events && alerts     # Run multiple commands
```

### Aliases
| Alias | Command |
|-------|---------|
| `p` | pods |
| `o` | overview |
| `d` | diagnose |
| `l` | logs |
| `e` | events |
| `s` | switch |

### Special
| Command | Description |
|---------|-------------|
| `!` | Repeat last command |
| `help` | Full command list |
| `exit` | Quit |

## Configuration

File: `~/.kubsome/config.yaml`

```yaml
refresh_interval: 2          # Watch refresh (seconds)
notifications: true          # Desktop notifications
theme: dark                  # dark, light, minimal, hacker
aliases:
  p: pods
  o: overview
  d: diagnose
  l: logs
  e: events
  s: switch
llm:
  provider: local            # local (built-in) or ollama
```

## Plugins

Place `.py` files in `~/.kubsome/plugins/`:

```python
# ~/.kubsome/plugins/my_check.py
NAME = "my-check"
DESCRIPTION = "Custom health check"

def run(context):
    return f"Context: {context.current_context}"
```

Use with: `plugin my-check` or list with `plugins`.

Install from registry: `plugin install <name>`
Uninstall: `plugin rm <name>`

## Policies

Define guardrails in `.kubsome/policies.yaml` (project-level, Git-synced):

```yaml
- name: no-latest-tag
  description: Reject deployments using :latest tag
  resource: deployment
  rule: no_latest_image
  severity: high

- name: memory-limit-required
  description: All containers must have memory limits
  resource: deployment
  rule: memory_limits_set
  severity: medium
```

Available rules: `no_latest_image`, `memory_limits_set`, `cpu_limits_set`, `max_replicas`, `no_privileged`, `run_as_non_root`, `read_only_root`

Check with: `policy`

## Schedules

Recurring command sequences:

```bash
schedule add daily-health "0 8 * * *" scorecard,export
schedule add quick-check "*/30 * * * *" alerts,pods
schedule rm daily-health
schedules                    # List all
```

Stored in `~/.kubsome/schedules.yaml`. Runs in background during CLI session.

## Team Runbooks

Place `.yaml` files in `.kubsome/runbooks/` (project root, Git-synced):

```yaml
title: Payment Service Recovery
steps:
  - "Check payment pods: pods"
  - "Verify database connectivity"
  - "Check downstream: dep-health payment"
  - "If OOM: increase memory and restart"
```

Access with: `playbook <filename>` (without .yaml extension)

