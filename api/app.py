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
# Priority: 1) dev build (ui/dist/ui/browser) — always freshest
#           2) bundled in package (api/ui_dist)
_api_dir = Path(__file__).parent
_project_dir = _api_dir.parent

_dev_build = _project_dir / "ui" / "dist" / "ui" / "browser"
_bundled = _api_dir / "ui_dist"

# If dev build exists and is newer, sync to api/ui_dist
if _dev_build.exists():
    import shutil
    if _bundled.exists():
        # Compare timestamps to detect if rebuild happened
        dev_mtime = (_dev_build / "index.html").stat().st_mtime
        bundled_mtime = (_bundled / "index.html").stat().st_mtime if (_bundled / "index.html").exists() else 0
        if dev_mtime > bundled_mtime:
            shutil.rmtree(_bundled)
            shutil.copytree(_dev_build, _bundled)
    else:
        shutil.copytree(_dev_build, _bundled)

ui_dist = _bundled if _bundled.exists() else _dev_build

if ui_dist.exists():
    from fastapi.responses import FileResponse
    from starlette.responses import Response

    # Serve static assets (js, css, fonts, images)
    app.mount(
        "/app/media",
        StaticFiles(directory=str(ui_dist / "media")),
        name="media",
    ) if (ui_dist / "media").exists() else None

    @app.get("/app")
    def serve_spa_root():
        return FileResponse(
            ui_dist / "index.html",
            headers={"Cache-Control": "no-cache, no-store, must-revalidate"},
        )

    @app.get("/app/{path:path}")
    def serve_spa(path: str):
        file_path = ui_dist / path
        if file_path.is_file():
            # Hashed assets (chunk-XXX.js) can be cached forever
            headers = {}
            if any(path.endswith(ext) for ext in (".js", ".css", ".woff2", ".ttf", ".woff", ".eot")):
                headers["Cache-Control"] = "public, max-age=31536000, immutable"
            return FileResponse(file_path, headers=headers)
        # SPA fallback — serve index.html for client-side routes
        return FileResponse(
            ui_dist / "index.html",
            headers={"Cache-Control": "no-cache, no-store, must-revalidate"},
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
