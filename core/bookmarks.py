"""
Bookmarks — save frequently used commands and resources.
Stored in ~/.kubsome/bookmarks.json
"""

import json
from pathlib import Path

BOOKMARKS_FILE = Path.home() / ".kubsome" / "bookmarks.json"


def _load():
    BOOKMARKS_FILE.parent.mkdir(parents=True, exist_ok=True)
    if not BOOKMARKS_FILE.exists():
        return []
    with open(BOOKMARKS_FILE, "r") as f:
        return json.load(f)


def _save(bookmarks):
    BOOKMARKS_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(BOOKMARKS_FILE, "w") as f:
        json.dump(bookmarks, f, indent=2)


def add_bookmark(name, command):
    """Save a bookmark."""
    bookmarks = _load()
    bookmarks = [
        b for b in bookmarks if b["name"] != name
    ]
    bookmarks.append({
        "name": name,
        "command": command,
    })
    _save(bookmarks)


def remove_bookmark(name):
    """Remove a bookmark."""
    bookmarks = _load()
    bookmarks = [
        b for b in bookmarks if b["name"] != name
    ]
    _save(bookmarks)


def get_bookmark(name):
    """Get a bookmark by name."""
    bookmarks = _load()
    for b in bookmarks:
        if b["name"] == name:
            return b["command"]
    return None


def list_bookmarks():
    """List all bookmarks."""
    return _load()
