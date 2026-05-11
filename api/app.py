"""
Kubsome API — FastAPI backend exposing the Kubernetes engine.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pathlib import Path

from api.routes import pods, overview, contexts, events, metrics, logs, deployments, diagnostics, intelligence, terminal, operations, ws, describe

app = FastAPI(
    title="Kubsome API",
    version="1.0.0",
    description="Kubernetes Operations Engine API",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(pods.router, prefix="/api")
app.include_router(overview.router, prefix="/api")
app.include_router(contexts.router, prefix="/api")
app.include_router(events.router, prefix="/api")
app.include_router(metrics.router, prefix="/api")
app.include_router(logs.router, prefix="/api")
app.include_router(deployments.router, prefix="/api")
app.include_router(diagnostics.router, prefix="/api")
app.include_router(intelligence.router, prefix="/api")
app.include_router(terminal.router, prefix="/api")
app.include_router(operations.router, prefix="/api")
app.include_router(describe.router, prefix="/api")
app.include_router(ws.router)


@app.get("/health")
def health():
    return {"status": "ok"}


# Serve Angular build in production
# Priority: 1) dev build (ui/dist/ui/browser)
#           2) bundled in package (api/ui_dist)
#           3) auto-copy from dev build to api/ui_dist
_api_dir = Path(__file__).parent
_project_dir = _api_dir.parent

ui_dist = _project_dir / "ui" / "dist" / "ui" / "browser"
if not ui_dist.exists():
    ui_dist = _api_dir / "ui_dist"

# Auto-copy dev build to api/ui_dist if it exists but ui_dist doesn't
if not ui_dist.exists():
    _dev_build = _project_dir / "ui" / "dist" / "ui" / "browser"
    if _dev_build.exists():
        import shutil
        _dest = _api_dir / "ui_dist"
        shutil.copytree(_dev_build, _dest)
        ui_dist = _dest

if ui_dist.exists():
    # Mount static assets (js, css, images) with proper MIME types
    app.mount(
        "/app",
        StaticFiles(directory=str(ui_dist), html=True),
        name="spa",
    )
else:
    from fastapi.responses import JSONResponse

    @app.get("/app")
    @app.get("/app/{path:path}")
    def no_ui(path: str = ""):
        return JSONResponse(
            status_code=503,
            content={
                "error": "UI not built",
                "message": (
                    "Run 'cd ui && pnpm build' to build the "
                    "web dashboard, then restart the server."
                ),
            },
        )
