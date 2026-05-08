"""
KubeEasy API — FastAPI backend exposing the Kubernetes engine.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pathlib import Path

from api.routes import pods, overview, contexts, events, metrics, logs, deployments, diagnostics, intelligence, terminal, operations, ws

app = FastAPI(
    title="KubeEasy API",
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
app.include_router(ws.router)


@app.get("/health")
def health():
    return {"status": "ok"}


# Serve Angular build in production
ui_dist = Path(__file__).parent.parent / "ui" / "dist" / "ui" / "browser"
if ui_dist.exists():
    app.mount("/", StaticFiles(directory=str(ui_dist), html=True), name="ui")
