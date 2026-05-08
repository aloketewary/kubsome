"""
Start the Kubsome API server.

Usage:
    python -m api.serve
    kubsome serve
"""

import uvicorn


def start(host: str = "0.0.0.0", port: int = 8000):
    uvicorn.run("api.app:app", host=host, port=port, reload=True)


if __name__ == "__main__":
    start()
