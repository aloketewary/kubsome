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
    allow_origins=["http://localhost:3000", "http://localhost:3001"],
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
# Check bundled ui_dist first (pip install), then dev path
ui_dist = Path(__file__).parent / "ui_dist"
if not ui_dist.exists():
    ui_dist = (
        Path(__file__).parent.parent
        / "ui" / "dist" / "ui" / "browser"
    )

if ui_dist.exists():
    from fastapi.responses import FileResponse

    @app.get("/app")
    def serve_spa_root():
        return FileResponse(ui_dist / "index.html")

    @app.get("/app/{path:path}")
    def serve_spa(path: str):
        file_path = ui_dist / path
        if file_path.is_file():
            return FileResponse(file_path)
        return FileResponse(ui_dist / "index.html")
