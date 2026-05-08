# Kubsome — Technology Stack

## Languages & Versions
- **Python 3.9+** — Backend, CLI, core engine
- **TypeScript 5.8** — Angular frontend
- **Bash** — Dev/production scripts

## Python Dependencies

### Core
| Package | Version | Purpose |
|---------|---------|---------|
| rich | >=13.0 | Console formatting, tables, panels, Live display |
| prompt-toolkit | >=3.0 | CLI input with completion and history |
| questionary | >=2.0 | Interactive selection prompts |
| rapidfuzz | >=3.0 | Fuzzy matching for commands/contexts |
| humanize | >=4.0 | Human-readable time/size formatting |
| pyyaml | >=6.0 | YAML parsing |

### Optional
| Package | Version | Purpose |
|---------|---------|---------|
| textual | >=0.40 | Full-screen TUI (optional: `pip install .[tui]`) |
| fastapi | >=0.104.0 | REST API framework (optional: `pip install .[api]`) |
| uvicorn[standard] | >=0.24.0 | ASGI server for FastAPI |

### Dev
| Package | Version | Purpose |
|---------|---------|---------|
| pytest | >=7.0 | Testing framework |

## Frontend Dependencies

### Angular 20 Stack
| Package | Version | Purpose |
|---------|---------|---------|
| @angular/core | ^20.1.0 | Framework |
| @angular/router | ^20.1.0 | Routing |
| @angular/cdk | ^20.2.14 | Component Dev Kit |
| @angular/animations | ^21.2.12 | Animations |
| primeng | ^20.4.0 | UI component library |
| @primeng/themes | ^20.4.0 | PrimeNG theming |
| primeicons | ^7.0.0 | Icon set |
| rxjs | ~7.8.0 | Reactive programming |
| zone.js | ~0.15.0 | Change detection |

### Dev Tools
| Package | Purpose |
|---------|---------|
| @angular/cli ^20.1.4 | Build tooling |
| @angular/build ^20.1.4 | Build system |
| typescript ~5.8.2 | Type checking |
| jasmine-core ~5.8.0 | Test framework |
| karma ~6.4.0 | Test runner |

## Build System
- **Python**: setuptools (pyproject.toml)
- **Frontend**: Angular CLI (`ng build`, `ng serve`)
- **Package manager**: pip (Python), npm (Node.js)

## External Dependencies
- **kubectl** — Must be installed and configured with cluster access
- **metrics-server** — Required for `top` commands
- **Node.js 18+** — For Angular UI development

## Development Commands

```bash
# Setup
python3 -m venv venv && source venv/bin/activate
pip install -r requirements.txt
cd ui && npm install && cd ..

# Development (both servers)
./dev.sh                          # API :8000 + UI :3001

# Individual servers
uvicorn api.app:app --reload --port 8000   # API only
cd ui && npx ng serve --port 3001          # UI only

# CLI
python3 main.py                   # Interactive REPL
python3 main.py serve             # Start API server
python3 main.py serve 9000        # API on custom port
python3 main.py --exec "pods"     # Single command execution

# Testing
pytest                            # Run Python tests
cd ui && npm test                  # Run Angular tests

# Production
./start.sh                        # Build UI + serve on single port
```

## Configuration
- `config/settings.py` — Application settings (refresh intervals, etc.)
- `~/.kubsome/` — User config, plugins, bookmarks, workflows
- `~/.kube/config` — Kubernetes cluster configuration (standard kubectl)

## Ports
| Service | Port | Mode |
|---------|------|------|
| FastAPI | 8000 | Dev & Prod |
| Angular | 3001 | Dev only |
| Angular | served via FastAPI | Prod (static files) |
