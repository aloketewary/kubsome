# Technology Stack — Kubsome

## Languages & Versions
- **Python 3.9+** — Core engine, CLI, API (primary language)
- **TypeScript 5.8** — Angular Web UI frontend

## Build System
- **setuptools** (>=68.0) with `pyproject.toml` — Python packaging
- **Angular CLI 20** — Frontend build (`ng build`)
- **pnpm** — Frontend package manager (pnpm-lock.yaml present)

## Core Dependencies (Python)
| Package | Version | Purpose |
|---------|---------|---------|
| rich | >=13.0 | Terminal formatting (tables, panels, colors) |
| prompt-toolkit | >=3.0 | Interactive CLI input, history, completion |
| questionary | >=2.0 | Interactive selection prompts |
| rapidfuzz | >=3.0 | Fuzzy string matching for resource names |
| humanize | >=4.0 | Human-readable time/size formatting |
| pyyaml | >=6.0 | YAML config parsing |
| fastapi | >=0.104.0 | REST API framework |
| uvicorn[standard] | >=0.24.0 | ASGI server |

## Optional Dependencies
| Extra | Package | Purpose |
|-------|---------|---------|
| tui | textual >=0.40 | Full-screen terminal UI |
| dev | pytest >=7.0, build, twine | Testing and publishing |

## Frontend Dependencies (Angular)
| Package | Version | Purpose |
|---------|---------|---------|
| @angular/core | ^20.1.0 | Framework |
| primeng | ^20.4.0 | UI component library |
| @primeng/themes | ^20.4.0 | PrimeNG theming |
| @xterm/xterm | ^6.0.0 | Terminal emulator in browser |
| cytoscape | ^3.33.3 | Graph visualization |
| rxjs | ~7.8.0 | Reactive programming |

## External Requirements
- **kubectl** — configured with cluster access (required)
- **metrics-server** — for `top` commands (optional)
- **Ollama** — for LLM features (optional, default: local provider)

## Development Commands

### Python
```bash
# Install in development mode
pip install -e ".[dev]"

# Run CLI
python main.py

# Run API server
python main.py serve [port]

# Run TUI
python main.py tui

# Run tests
pytest

# Build package
python -m build

# Publish to PyPI
./publish.sh
```

### Frontend (ui/)
```bash
cd ui
pnpm install
pnpm start          # Dev server (localhost:4200)
pnpm build          # Production build → dist/ui/browser/
```

### Docker
```bash
docker build -t kubsome .
docker run -p 8000:8000 -v ~/.kube:/root/.kube kubsome
```

### Helm
```bash
helm install kubsome deploy/helm/kubsome/ -n kubsome --create-namespace
```

## Project Metadata
- **Name**: kubsome
- **Version**: 1.5.0
- **License**: MIT
- **Author**: Aloke Tewary
- **Entry point**: `main:main` (registered as `kubsome` console script)
- **Python packages included**: core*, config*, tui*, plugins*, api*

## Configuration
- User config: `~/.kubsome/config.yaml`
- Plugins directory: `~/.kubsome/plugins/`
- Bookmarks/workflows stored in `~/.kubsome/`
