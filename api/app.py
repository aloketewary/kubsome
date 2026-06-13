"""
Kubsome API — FastAPI backend exposing the Kubernetes engine.
"""

from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pathlib import Path

from api.routes import pods, overview, contexts, events, metrics, logs, deployments, diagnostics, intelligence, terminal, operations, ws, describe, gateway, gitops, analytics, monitor
from api.auth import AuthMiddleware, generate_token
from api.ratelimit import RateLimitMiddleware


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown lifecycle."""
    token = generate_token()
    print(f"  🔑 API Token: {token}")
    print(f"  Saved to: ~/.kubsome/.api_token")

    from core.cache import prewarm
    prewarm()

    # Start background metrics recorder (every 5 min)
    import threading

    def _record_loop():
        import time
        time.sleep(30)
        while True:
            try:
                from core.collectors.metrics_history import record_snapshot
                record_snapshot()
            except Exception:
                pass
            time.sleep(300)

    threading.Thread(target=_record_loop, daemon=True).start()

    # Start DuckDB analytics collector
    try:
        from core.analytics.collector import start_collector
        start_collector()
    except ImportError:
        pass

    yield


app = FastAPI(
    title="Kubsome API",
    version="1.0.0",
    description="Kubernetes Operations Engine API",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:4200",   # Angular dev
        "http://localhost:8000",   # Self (API serves UI)
        "http://127.0.0.1:4200",
        "http://127.0.0.1:8000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.add_middleware(AuthMiddleware)
app.add_middleware(RateLimitMiddleware)


app.include_router(pods.router, prefix="/api")
app.include_router(overview.router, prefix="/api")
app.include_router(contexts.router, prefix="/api")
app.include_router(events.router, prefix="/api")
app.include_router(metrics.router, prefix="/api")
app.include_router(logs.router, prefix="/api")
app.include_router(deployments.router, prefix="/api")
app.include_router(monitor.router, prefix="/api")
app.include_router(diagnostics.router, prefix="/api")
app.include_router(intelligence.router, prefix="/api")
app.include_router(terminal.router, prefix="/api")
app.include_router(operations.router, prefix="/api")
app.include_router(describe.router, prefix="/api")
app.include_router(gateway.router, prefix="/api")
app.include_router(gitops.router, prefix="/api")
app.include_router(analytics.router, prefix="/api")
app.include_router(ws.router)


@app.get("/health")
def health_root():
    return {"status": "ok"}


@app.get("/api/health")
def health():
    return {"status": "ok"}


@app.get("/api/token")
def get_api_token(request: Request):
    """Return the session token for the Web UI.
    Only accessible from localhost."""
    # Strict check: only allow local access to the token
    if not request.client or request.client.host not in ("127.0.0.1", "::1"):
        raise HTTPException(
            status_code=403, detail="Access denied: Token only available on localhost"
        )

    from api.auth import get_token
    return {"token": get_token()}


@app.get("/api/version")
def version():
    from core.version import __version__
    return {"version": __version__}


# Serve Angular build in production
# Priority: 1) dev build (ui/dist/ui/browser) — always freshest
#           2) bundled in package (api/ui_dist)
#           3) bundled via importlib (pip install from wheel)
_api_dir = Path(__file__).parent
_project_dir = _api_dir.parent

_dev_build = _project_dir / "ui" / "dist" / "ui" / "browser"
_bundled = _api_dir / "ui_dist"

# Only sync dev build to bundled if index.html is newer (avoid expensive copy on every reload)
if _dev_build.exists() and (_dev_build / "index.html").exists():
    dev_mtime = (_dev_build / "index.html").stat().st_mtime
    bundled_mtime = (_bundled / "index.html").stat().st_mtime if (_bundled / "index.html").exists() else 0
    if dev_mtime > bundled_mtime:
        import shutil
        if _bundled.exists():
            shutil.rmtree(_bundled)
        shutil.copytree(_dev_build, _bundled)

# Resolve final ui_dist path
if _bundled.exists() and (_bundled / "index.html").exists():
    ui_dist = _bundled
elif _dev_build.exists() and (_dev_build / "index.html").exists():
    ui_dist = _dev_build
else:
    # Fallback: try to find via importlib (installed wheel)
    try:
        import importlib.resources as _res
        _pkg_path = Path(str(_res.files("api"))) / "ui_dist"
        if _pkg_path.exists() and (_pkg_path / "index.html").exists():
            ui_dist = _pkg_path
        else:
            ui_dist = _bundled  # will fail exists() check below
    except Exception:
        ui_dist = _bundled

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
