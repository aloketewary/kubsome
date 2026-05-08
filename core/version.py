"""
Version check — notify user if a newer version exists on PyPI.
"""

import json
import urllib.request
from importlib.metadata import version

PACKAGE = "kubsome"
PYPI_URL = f"https://pypi.org/pypi/{PACKAGE}/json"


def check_update():
    """Return (latest, current) if update available, else None."""
    try:
        current = version(PACKAGE)
        req = urllib.request.Request(
            PYPI_URL, headers={"Accept": "application/json"}
        )
        with urllib.request.urlopen(req, timeout=3) as resp:
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
