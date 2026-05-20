"""
Analytics State Cache — stores current cluster state in DuckDB
for instant reads at scale. Updated by the collector every 5 min.

At 1M pods, kubectl takes 30-60s. DuckDB query takes <100ms.

Tables:
  - pod_state: current pod status (refreshed every collection)
  - deployment_state: current deployment status
  - node_state: current node status
  - event_log: persistent searchable event history
"""

from datetime import datetime

_tables_created = False


def refresh_state(conn, ctx, ns, pods_raw, deployments_raw,
                  nodes_raw, events_raw):
    """
    Refresh all state tables from raw kubectl data.
    Called by the collector after each cycle.
    """
    _ensure_tables(conn)
    _refresh_pods(conn, ctx, ns, pods_raw)
    _refresh_deployments(conn, ctx, ns, deployments_raw)
    _refresh_nodes(conn, ctx, nodes_raw)
    _ingest_events(conn, ctx, ns, events_raw)


def get_pods(conn, ctx, ns, search=None, status=None, limit=1000):
    """
    Read pods from state cache. Instant even for 1M pods.
    Supports search and status filter.
    """
    _ensure_tables(conn)

    filters = [
        f"context = '{ctx}'",
        f"namespace = '{ns}'",
    ]
    if search:
        filters.append(f"name LIKE '%{search}%'")
    if status:
        filters.append(f"status = '{status}'")

    where = " AND ".join(filters)

    rows = conn.execute(f"""
        SELECT name, status, restarts, deployment,
               cpu_request, mem_request, age_seconds, labels
        FROM pod_state
        WHERE {where}
        ORDER BY
            CASE status
                WHEN 'CrashLoopBackOff' THEN 0
                WHEN 'Error' THEN 1
                WHEN 'Pending' THEN 2
                ELSE 3
            END,
            restarts DESC
        LIMIT {limit}
    """).fetchall()

    return [
        {
            "name": r[0], "status": r[1], "restarts": r[2],
            "deployment": r[3], "cpu_request": r[4],
            "mem_request": r[5], "age_seconds": r[6],
            "labels": r[7],
        }
        for r in rows
    ]


def get_deployments(conn, ctx, ns):
    """Read deployments from state cache."""
    _ensure_tables(conn)

    rows = conn.execute(f"""
        SELECT name, desired, available, ready, image, labels
        FROM deployment_state
        WHERE context = '{ctx}' AND namespace = '{ns}'
        ORDER BY name
    """).fetchall()

    return [
        {
            "name": r[0], "desired": r[1], "available": r[2],
            "ready": r[3], "image": r[4], "labels": r[5],
        }
        for r in rows
    ]


def get_nodes(conn, ctx):
    """Read nodes from state cache."""
    _ensure_tables(conn)

    rows = conn.execute(f"""
        SELECT name, ready, cpu_allocatable, mem_allocatable_mb,
               pod_count, labels
        FROM node_state
        WHERE context = '{ctx}'
        ORDER BY name
    """).fetchall()

    return [
        {
            "name": r[0], "ready": r[1],
            "cpu_allocatable": r[2], "mem_allocatable_mb": r[3],
            "pod_count": r[4], "labels": r[5],
        }
        for r in rows
    ]


def search_events(conn, ctx, ns, query=None, event_type=None,
                  reason=None, hours=24, limit=100):
    """
    Search events from persistent history.
    Much richer than kubectl get events (which only shows recent).
    """
    _ensure_tables(conn)

    filters = [
        f"context = '{ctx}'",
        f"namespace = '{ns}'",
        f"ts >= NOW() - INTERVAL '{hours} hours'",
    ]
    if query:
        filters.append(
            f"(object LIKE '%{query}%' OR message LIKE '%{query}%')"
        )
    if event_type:
        filters.append(f"type = '{event_type}'")
    if reason:
        filters.append(f"reason = '{reason}'")

    where = " AND ".join(filters)

    rows = conn.execute(f"""
        SELECT ts, type, reason, object, kind, message, count
        FROM event_log
        WHERE {where}
        ORDER BY ts DESC
        LIMIT {limit}
    """).fetchall()

    return [
        {
            "timestamp": str(r[0]), "type": r[1], "reason": r[2],
            "object": r[3], "kind": r[4], "message": r[5],
            "count": r[6],
        }
        for r in rows
    ]


def event_heatmap(conn, ctx, ns, hours=24):
    """Event count by hour for heatmap visualization."""
    _ensure_tables(conn)

    rows = conn.execute(f"""
        SELECT
            EXTRACT(HOUR FROM ts)::INTEGER AS hour,
            type,
            COUNT(*) AS count
        FROM event_log
        WHERE context = '{ctx}' AND namespace = '{ns}'
          AND ts >= NOW() - INTERVAL '{hours} hours'
        GROUP BY hour, type
        ORDER BY hour
    """).fetchall()

    return [
        {"hour": r[0], "type": r[1], "count": r[2]}
        for r in rows
    ]


def state_stats(conn, ctx, ns):
    """Quick stats from state cache."""
    _ensure_tables(conn)

    pods = conn.execute(f"""
        SELECT
            COUNT(*) AS total,
            SUM(CASE WHEN status = 'Running' THEN 1 ELSE 0 END) AS running,
            SUM(CASE WHEN status IN ('CrashLoopBackOff','Error','Failed')
                THEN 1 ELSE 0 END) AS failing,
            SUM(restarts) AS total_restarts
        FROM pod_state
        WHERE context = '{ctx}' AND namespace = '{ns}'
    """).fetchone()

    deps = conn.execute(f"""
        SELECT
            COUNT(*) AS total,
            SUM(CASE WHEN available >= desired THEN 1 ELSE 0 END) AS healthy
        FROM deployment_state
        WHERE context = '{ctx}' AND namespace = '{ns}'
    """).fetchone()

    events_1h = conn.execute(f"""
        SELECT COUNT(*) FROM event_log
        WHERE context = '{ctx}' AND namespace = '{ns}'
          AND ts >= NOW() - INTERVAL '1 hour'
          AND type = 'Warning'
    """).fetchone()[0]

    return {
        "pods_total": pods[0] if pods else 0,
        "pods_running": pods[1] if pods else 0,
        "pods_failing": pods[2] if pods else 0,
        "total_restarts": pods[3] if pods else 0,
        "deployments_total": deps[0] if deps else 0,
        "deployments_healthy": deps[1] if deps else 0,
        "warning_events_1h": events_1h,
    }


# --- Internal refresh functions ---

def _refresh_pods(conn, ctx, ns, pods_raw):
    """Replace pod_state with current data."""
    if not pods_raw:
        return

    # Delete current state for this context/namespace
    conn.execute(
        "DELETE FROM pod_state WHERE context = ? AND namespace = ?",
        [ctx, ns]
    )

    rows = []
    for item in pods_raw.get("items", []):
        meta = item.get("metadata", {})
        status = item.get("status", {})
        spec = item.get("spec", {})

        name = meta.get("name", "")
        phase = status.get("phase", "Unknown")

        # Check container status for CrashLoopBackOff
        for cs in status.get("containerStatuses", []):
            waiting = cs.get("waiting", {})
            if waiting.get("reason") in (
                "CrashLoopBackOff", "ImagePullBackOff", "ErrImagePull"
            ):
                phase = waiting["reason"]
                break

        restarts = sum(
            cs.get("restartCount", 0)
            for cs in status.get("containerStatuses", [])
        )

        # Deployment from owner
        deployment = ""
        for o in meta.get("ownerReferences", []):
            if o.get("kind") == "ReplicaSet":
                deployment = "-".join(o["name"].split("-")[:-1])

        # Resources
        containers = spec.get("containers", [])
        cpu_req = 0
        mem_req = 0
        if containers:
            res = containers[0].get("resources", {})
            cpu_req = _parse_cpu(res.get("requests", {}).get("cpu", "0"))
            mem_req = _parse_mem(res.get("requests", {}).get("memory", "0"))

        # Age
        age_seconds = 0
        created = meta.get("creationTimestamp", "")
        if created:
            try:
                from datetime import timezone
                ts = datetime.fromisoformat(created.replace("Z", "+00:00"))
                age_seconds = int(
                    (datetime.now(timezone.utc) - ts).total_seconds()
                )
            except Exception:
                pass

        labels = ",".join(
            f"{k}={v}" for k, v in meta.get("labels", {}).items()
        )

        rows.append((
            ctx, ns, name, phase, restarts, deployment,
            cpu_req, mem_req, age_seconds, labels
        ))

    if rows:
        conn.executemany(
            "INSERT INTO pod_state VALUES (?,?,?,?,?,?,?,?,?,?)",
            rows
        )


def _refresh_deployments(conn, ctx, ns, deployments_raw):
    """Replace deployment_state with current data."""
    if not deployments_raw:
        return

    conn.execute(
        "DELETE FROM deployment_state WHERE context = ? AND namespace = ?",
        [ctx, ns]
    )

    rows = []
    for item in deployments_raw.get("items", []):
        meta = item.get("metadata", {})
        spec = item.get("spec", {})
        status = item.get("status", {})

        name = meta.get("name", "")
        desired = spec.get("replicas", 0)
        available = status.get("availableReplicas", 0)
        ready = status.get("readyReplicas", 0)

        containers = spec.get("template", {}).get("spec", {}).get("containers", [])
        image = containers[0].get("image", "") if containers else ""

        labels = ",".join(
            f"{k}={v}" for k, v in meta.get("labels", {}).items()
        )

        rows.append((ctx, ns, name, desired, available, ready, image, labels))

    if rows:
        conn.executemany(
            "INSERT INTO deployment_state VALUES (?,?,?,?,?,?,?,?)",
            rows
        )


def _refresh_nodes(conn, ctx, nodes_raw):
    """Replace node_state with current data."""
    if not nodes_raw:
        return

    conn.execute(
        "DELETE FROM node_state WHERE context = ?", [ctx]
    )

    rows = []
    for item in nodes_raw.get("items", []):
        meta = item.get("metadata", {})
        status = item.get("status", {})

        name = meta.get("name", "")
        ready = any(
            c["type"] == "Ready" and c["status"] == "True"
            for c in status.get("conditions", [])
        )

        alloc = status.get("allocatable", {})
        cpu_alloc = _parse_cpu(alloc.get("cpu", "0"))
        mem_alloc = _parse_mem(alloc.get("memory", "0"))
        pod_count = int(alloc.get("pods", "0"))

        labels = ",".join(
            f"{k}={v}" for k, v in meta.get("labels", {}).items()
        )

        rows.append((ctx, name, ready, cpu_alloc, mem_alloc, pod_count, labels))

    if rows:
        conn.executemany(
            "INSERT INTO node_state VALUES (?,?,?,?,?,?,?)",
            rows
        )


def _ingest_events(conn, ctx, ns, events_raw):
    """Append new events to persistent event_log (deduped by message+object+time)."""
    if not events_raw:
        return

    for item in events_raw.get("items", []):
        ts = item.get("lastTimestamp") or item.get("eventTime") or ""
        if not ts:
            continue

        try:
            event_ts = datetime.fromisoformat(ts.replace("Z", "+00:00"))
        except Exception:
            continue

        # Dedupe: skip if same event already exists within 1 minute
        obj = item.get("involvedObject", {}).get("name", "")
        reason = item.get("reason", "")
        existing = conn.execute(
            "SELECT 1 FROM event_log WHERE object = ? AND reason = ? "
            "AND ts >= ? - INTERVAL '1 minute' AND ts <= ? + INTERVAL '1 minute' LIMIT 1",
            [obj, reason, event_ts, event_ts]
        ).fetchone()

        if existing:
            continue

        conn.execute(
            "INSERT INTO event_log VALUES (?,?,?,?,?,?,?,?)",
            [
                event_ts, ctx, ns,
                item.get("type", "Normal"),
                reason,
                obj,
                item.get("involvedObject", {}).get("kind", ""),
                item.get("message", ""),
                item.get("count", 1),
            ]
        )


def _ensure_tables(conn):
    """Create state cache tables."""
    global _tables_created
    if _tables_created:
        return

    conn.execute("""
        CREATE TABLE IF NOT EXISTS pod_state (
            context VARCHAR,
            namespace VARCHAR,
            name VARCHAR,
            status VARCHAR,
            restarts INTEGER,
            deployment VARCHAR,
            cpu_request INTEGER,
            mem_request INTEGER,
            age_seconds INTEGER,
            labels VARCHAR
        )
    """)

    conn.execute("""
        CREATE TABLE IF NOT EXISTS deployment_state (
            context VARCHAR,
            namespace VARCHAR,
            name VARCHAR,
            desired INTEGER,
            available INTEGER,
            ready INTEGER,
            image VARCHAR,
            labels VARCHAR
        )
    """)

    conn.execute("""
        CREATE TABLE IF NOT EXISTS node_state (
            context VARCHAR,
            name VARCHAR,
            ready BOOLEAN,
            cpu_allocatable INTEGER,
            mem_allocatable_mb INTEGER,
            pod_count INTEGER,
            labels VARCHAR
        )
    """)

    conn.execute("""
        CREATE TABLE IF NOT EXISTS event_log (
            ts TIMESTAMP,
            context VARCHAR,
            namespace VARCHAR,
            type VARCHAR,
            reason VARCHAR,
            object VARCHAR,
            kind VARCHAR,
            message VARCHAR,
            count INTEGER
        )
    """)

    # Indexes for fast queries
    conn.execute("""
        CREATE INDEX IF NOT EXISTS idx_pod_state_ns
        ON pod_state (context, namespace)
    """)
    conn.execute("""
        CREATE INDEX IF NOT EXISTS idx_pod_state_deploy
        ON pod_state (deployment)
    """)
    conn.execute("""
        CREATE INDEX IF NOT EXISTS idx_dep_state_ns
        ON deployment_state (context, namespace)
    """)
    conn.execute("""
        CREATE INDEX IF NOT EXISTS idx_event_ts
        ON event_log (ts)
    """)
    conn.execute("""
        CREATE INDEX IF NOT EXISTS idx_event_object
        ON event_log (object, ts)
    """)

    _tables_created = True


def _parse_cpu(val):
    if not val or val == "0":
        return 0
    val = str(val).strip()
    if val.endswith("m"):
        return int(val[:-1])
    if val.endswith("n"):
        return int(val[:-1]) // 1000000
    try:
        return int(float(val) * 1000)
    except ValueError:
        return 0


def _parse_mem(val):
    if not val or val == "0":
        return 0
    val = str(val).strip()
    if val.endswith("Mi"):
        return int(val[:-2])
    if val.endswith("Gi"):
        return int(float(val[:-2]) * 1024)
    if val.endswith("Ki"):
        return int(val[:-2]) // 1024
    try:
        return int(int(val) / (1024 * 1024))
    except ValueError:
        return 0
