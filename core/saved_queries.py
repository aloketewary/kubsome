"""
Saved Queries — pin AI queries or commands
for auto-refresh monitoring.
"""

import json
from pathlib import Path
from datetime import datetime

QUERIES_PATH = Path.home() / ".kubsome" / "saved_queries.json"


def save_query(name, query, interval=300):
    """Save a query for periodic execution."""
    queries = _load()
    queries[name] = {
        "query": query,
        "interval": interval,
        "created": datetime.now().isoformat(),
        "last_result": None,
        "last_run": None,
    }
    _save(queries)
    return queries[name]


def remove_query(name):
    """Remove a saved query."""
    queries = _load()
    if name in queries:
        del queries[name]
        _save(queries)
        return True
    return False


def list_queries():
    """List all saved queries."""
    queries = _load()
    return [
        {"name": k, **v}
        for k, v in queries.items()
    ]


def get_query(name):
    """Get a specific saved query."""
    queries = _load()
    return queries.get(name)


def update_result(name, result):
    """Update the last result of a saved query."""
    queries = _load()
    if name in queries:
        queries[name]["last_result"] = result
        queries[name]["last_run"] = (
            datetime.now().isoformat()
        )
        _save(queries)


def _load():
    """Load saved queries from disk."""
    if not QUERIES_PATH.exists():
        return {}
    try:
        with open(QUERIES_PATH) as f:
            return json.load(f)
    except (json.JSONDecodeError, IOError):
        return {}


def _save(queries):
    """Persist queries to disk."""
    QUERIES_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(QUERIES_PATH, "w") as f:
        json.dump(queries, f, indent=2)
