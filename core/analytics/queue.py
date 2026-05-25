"""
Analytics Queue — lock-free multi-process event queue.

Design:
  - Any process (CLI, serve, worker) can enqueue events
  - Events are JSON files named with UUID7 (time-ordered)
  - A single drain loop (in the DB-owning process) ingests into DuckDB
  - No file locks, no contention, no data loss

Queue dir: ~/.kubsome/analytics/queue/
"""

import json
import time
import threading
from pathlib import Path

QUEUE_DIR = Path.home() / ".kubsome" / "analytics" / "queue"
_drain_running = False


def uuid7():
    """Generate UUID7 (time-ordered). Uses stdlib on 3.14+, fallback otherwise."""
    try:
        import uuid
        return str(uuid.uuid7())
    except AttributeError:
        # Fallback for Python < 3.14: timestamp + random
        import uuid as _uuid
        import struct
        ts_ms = int(time.time() * 1000)
        rand = _uuid.uuid4().bytes[6:]
        # UUID7: 48-bit timestamp | 4-bit version(7) | 12-bit rand | 62-bit rand
        hi = (ts_ms << 16) | 0x7000 | (rand[0] & 0x0F) << 8 | rand[1]
        lo = (0x80 | (rand[2] & 0x3F)) << 56
        for i, b in enumerate(rand[3:10]):
            lo |= b << (48 - i * 8)
        return str(_uuid.UUID(int=(hi << 64) | lo))


def enqueue(event_type, data):
    """
    Write an event to the queue. Lock-free, safe from any process.
    Returns the event ID (UUID7).
    """
    QUEUE_DIR.mkdir(parents=True, exist_ok=True)
    event_id = uuid7()
    event = {
        "id": event_id,
        "type": event_type,
        "ts": time.time(),
        "data": data,
    }
    # Atomic write: write to tmp then rename (POSIX atomic)
    tmp = QUEUE_DIR / f".{event_id}.tmp"
    target = QUEUE_DIR / f"{event_id}.json"
    tmp.write_text(json.dumps(event, default=str))
    tmp.rename(target)
    return event_id


def drain(batch_size=100):
    """
    Process queued events into DuckDB. Called by the writer process.
    Returns number of events processed.
    """
    if not QUEUE_DIR.exists():
        return 0

    # List files sorted by name (UUID7 = time-ordered)
    files = sorted(QUEUE_DIR.glob("*.json"))[:batch_size]
    if not files:
        return 0

    events = []
    for f in files:
        try:
            event = json.loads(f.read_text())
            events.append(event)
        except (json.JSONDecodeError, OSError):
            pass
        # Remove after read (even if parse failed — don't retry bad files)
        f.unlink(missing_ok=True)

    if not events:
        return 0

    # Group by type and batch-insert
    _process_events(events)
    return len(events)


def _process_events(events):
    """Route events to appropriate DuckDB tables."""
    from core.analytics.engine import execute_many, execute_write

    pod_rows = []
    node_rows = []
    log_rows = []

    for e in events:
        etype = e.get("type", "")
        data = e.get("data", {})

        if etype == "pod_metrics":
            for row in data.get("rows", []):
                pod_rows.append(tuple(row))
        elif etype == "node_metrics":
            for row in data.get("rows", []):
                node_rows.append(tuple(row))
        elif etype == "collection_log":
            log_rows.append((
                data.get("ts"), data.get("level", "raw"),
                data.get("pods", 0), data.get("nodes", 0),
                data.get("duration_ms", 0),
            ))

    if pod_rows:
        execute_many(
            "INSERT INTO raw_pod_metrics VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
            pod_rows
        )
    if node_rows:
        execute_many(
            "INSERT INTO raw_node_metrics VALUES (?,?,?,?,?,?,?,?)",
            node_rows
        )
    if log_rows:
        execute_many(
            "INSERT INTO collection_log VALUES (?,?,?,?,?)",
            log_rows
        )


def start_drain_loop(interval=5):
    """Start background thread that drains the queue periodically."""
    global _drain_running
    if _drain_running:
        return
    _drain_running = True

    def _loop():
        while _drain_running:
            try:
                drain()
            except Exception:
                pass
            time.sleep(interval)

    threading.Thread(target=_loop, daemon=True).start()


def stop_drain_loop():
    """Stop the drain loop."""
    global _drain_running
    _drain_running = False


def queue_stats():
    """Return queue depth and oldest event age."""
    if not QUEUE_DIR.exists():
        return {"depth": 0, "oldest_age_s": 0}
    files = list(QUEUE_DIR.glob("*.json"))
    if not files:
        return {"depth": 0, "oldest_age_s": 0}
    oldest = min(f.stat().st_mtime for f in files)
    return {
        "depth": len(files),
        "oldest_age_s": round(time.time() - oldest, 1),
    }
