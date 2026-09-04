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
_drain_thread = None
_drain_stop_event = threading.Event()
_drain_lock = threading.Lock()
_DEFAULT_BATCH_SIZE = 100
_DEFAULT_MAX_ROWS = 2000
_DEFAULT_MAX_BYTES = 8 * 1024 * 1024
_CLAIM_STALE_SECONDS = 15 * 60


def uuid7():
    """Generate UUID7 (time-ordered). Uses stdlib on 3.14+, fallback otherwise."""
    try:
        import uuid
        return str(uuid.uuid7())
    except AttributeError:
        # Fallback for Python < 3.14: timestamp + counter + random
        import uuid as _uuid
        ts_ms = int(time.time() * 1000)
        seq = _uuid7_seq(ts_ms)
        rand_bytes = _uuid.uuid4().bytes
        # UUID7 layout: 48-bit timestamp | 4-bit version(7) | 12-bit seq | 2-bit variant | 62-bit random
        time_high = (ts_ms >> 16) & 0xFFFFFFFF
        time_mid = ts_ms & 0xFFFF
        ver_seq = 0x7000 | (seq & 0x0FFF)
        variant_rand = (0x80 | (rand_bytes[0] & 0x3F)) << 56
        for i in range(7):
            variant_rand |= rand_bytes[i + 1] << (48 - i * 8)
        hi = (time_high << 32) | (time_mid << 16) | ver_seq
        return str(_uuid.UUID(int=(hi << 64) | variant_rand))


_uuid7_last_ms = 0
_uuid7_counter = 0
_uuid7_lock = threading.Lock()


def _uuid7_seq(ts_ms):
    """Monotonic counter within the same millisecond."""
    global _uuid7_last_ms, _uuid7_counter
    with _uuid7_lock:
        if ts_ms == _uuid7_last_ms:
            _uuid7_counter += 1
        else:
            _uuid7_last_ms = ts_ms
            _uuid7_counter = 0
        return _uuid7_counter


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


def _drain_limits(batch_size, max_rows, max_bytes):
    """Resolve optional non-destructive queue pressure limits."""
    try:
        from core.config import load_config
        cfg = load_config().get("analytics", {})
    except Exception:
        cfg = {}

    return (
        max(1, int(batch_size if batch_size is not None else cfg.get(
            "queue_batch_events", _DEFAULT_BATCH_SIZE
        ))),
        max(1, int(max_rows if max_rows is not None else cfg.get(
            "queue_max_rows", _DEFAULT_MAX_ROWS
        ))),
        max(1024, int(max_bytes if max_bytes is not None else cfg.get(
            "queue_max_bytes", _DEFAULT_MAX_BYTES
        ))),
    )


def _restore_stale_claims():
    """Make files from an interrupted drain available for retry."""
    now = time.time()
    for claim in QUEUE_DIR.glob(".*.processing"):
        try:
            if now - claim.stat().st_mtime < _CLAIM_STALE_SECONDS:
                continue
            parts = claim.name.split(".")
            if len(parts) < 4:
                continue
            original = claim.with_name(".".join(parts[1:-2]))
            claim.rename(original)
        except OSError:
            pass


def drain(batch_size=None, max_rows=None, max_bytes=None):
    """
    Process queued events into DuckDB. Called by the writer process.

    Files are atomically claimed, then removed only after the complete batch
    commits. Row and byte limits keep one drain call from creating an
    unbounded native write. A failed transaction restores claimed files.
    Returns number of events processed.
    """
    if not QUEUE_DIR.exists():
        return 0

    batch_size, max_rows, max_bytes = _drain_limits(
        batch_size, max_rows, max_bytes
    )
    # Prevent overlapping drain calls from claiming the same work.
    if not _drain_lock.acquire(blocking=False):
        return 0

    claimed = []
    try:
        _restore_stale_claims()
        files = sorted(QUEUE_DIR.glob("*.json"))
        events = []
        row_count = 0
        byte_count = 0

        for f in files:
            if len(claimed) >= batch_size:
                break
            try:
                file_bytes = f.stat().st_size
                event = json.loads(f.read_text())
            except json.JSONDecodeError:
                # A completed but malformed event cannot be replayed.
                f.unlink(missing_ok=True)
                continue
            except OSError:
                continue

            data = event.get("data", {}) or {}
            event_rows = data.get("rows", [])
            event_row_count = (
                len(event_rows) if isinstance(event_rows, list) else 0
            )
            over_rows = row_count + event_row_count > max_rows
            over_bytes = byte_count + file_bytes > max_bytes
            # Always allow one oversized event, otherwise it would never
            # make progress; subsequent events wait for the next drain.
            if claimed and (over_rows or over_bytes):
                break

            claim = f.with_name(f".{f.name}.{threading.get_ident()}.processing")
            try:
                f.rename(claim)
            except OSError:
                continue
            claimed.append((claim, f))
            events.append(event)
            row_count += event_row_count
            byte_count += file_bytes

        if not events:
            return 0

        try:
            # _process_events uses one transaction, so a failed table write
            # cannot leave a partial batch to be duplicated on retry.
            _process_events(events)
        except Exception:
            for claim, original in claimed:
                try:
                    claim.rename(original)
                except OSError:
                    pass
            raise

        for claim, _ in claimed:
            claim.unlink(missing_ok=True)
        return len(events)
    finally:
        _drain_lock.release()


def _process_events(events):
    """Route events to appropriate DuckDB tables in one transaction."""
    from core.analytics.engine import execute_many, write_transaction

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

    # Unknown/empty events are safe to acknowledge without opening a DB
    # transaction. Valid data events use one transaction across all tables.
    if not pod_rows and not node_rows and not log_rows:
        return

    with write_transaction():
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
    global _drain_running, _drain_thread
    if _drain_running:
        return
    _drain_running = True
    _drain_stop_event.clear()

    def _loop():
        while _drain_running and not _drain_stop_event.is_set():
            try:
                drain()
            except Exception:
                pass
            if _drain_stop_event.wait(interval):
                break

    _drain_thread = threading.Thread(target=_loop, daemon=True)
    _drain_thread.start()


def stop_drain_loop():
    """Stop the drain loop and wait for its thread to exit."""
    global _drain_running, _drain_thread
    _drain_running = False
    _drain_stop_event.set()
    thread = _drain_thread
    if thread and thread is not threading.current_thread():
        thread.join(timeout=5)
    _drain_thread = None
    return not thread or not thread.is_alive()


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
