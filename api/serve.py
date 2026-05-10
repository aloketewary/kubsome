"""
Start the Kubsome API server.

Usage:
    python -m api.serve
    kubsome serve
"""

import uvicorn


def start(
    host: str = "0.0.0.0",
    port: int = 8000,
    no_browser: bool = False,
):
    if not no_browser:
        import webbrowser
        import threading

        def open_browser():
            webbrowser.open(f"http://localhost:{port}/app")

        threading.Timer(1.5, open_browser).start()

    uvicorn.run(
        "api.app:app", host=host, port=port, reload=True
    )


if __name__ == "__main__":
    start()
