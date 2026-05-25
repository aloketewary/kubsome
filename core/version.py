"""
Version check — notify user if a newer version exists on PyPI.
Also exposes the single source of truth for the app version.
"""

import json
import ssl
import urllib.request
from importlib.metadata import version as _meta_version

PACKAGE = "kubsome"
PYPI_URL = f"https://pypi.org/pypi/{PACKAGE}/json"

try:
    __version__ = _meta_version(PACKAGE)
except Exception:
    __version__ = "0.0.0"


def check_update():
    """Return (latest, current) if update available, else None."""
    try:
        current = __version__
        ctx = ssl.create_default_context()
        req = urllib.request.Request(
            PYPI_URL, headers={"Accept": "application/json"}
        )
        with urllib.request.urlopen(req, timeout=3, context=ctx) as resp:
            data = json.loads(resp.read())
        latest = data["info"]["version"]
        if _is_newer(latest, current):
            return latest, current
    except Exception:
        pass
    return None


def _is_newer(latest: str, current: str) -> bool:
    """Simple semver comparison."""
    def parts(v):
        return [int(x) for x in v.split(".")[:3]]
    try:
        return parts(latest) > parts(current)
    except (ValueError, IndexError):
        return False
