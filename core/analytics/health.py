"""
Health Engine — computes pod and deployment health scores,
persists snapshots, and generates incident candidates from
meaningful state transitions.

Scoring v1:
    Start = 100
    Not Ready         -40
    Restart increase  -20
    OOMKilled         -30
    FailedMount       -20
    CPU >90% limit    -10
    MEM >90% limit    -10

Deployment score:
    Average pod score + penalty for unhealthy pods.
    Not worst pod.

Incidents generated only on:
    Healthy → Warning/Critical
    Warning → Critical
    Health drop >20
    Restart spike
    OOMKill
"""

import json
from datetime import datetime

from core.analytics.engine import (
    get_conn, execute_many, execute_write, execute, execute_one,
)
from core.context import context

HEALTH_VERSION = 1

_tables_created = False


def compute_health(ts, ctx, ns, pods_raw, events_raw, metrics):
    """
    Full health pipeline. Called by collector after data fetch.

    Args:
        ts: collection timestamp
        ctx: kubernetes context
        ns: namespace (or None for all)
        pods_raw: raw kubectl get pods JSON
        events_raw: raw kubectl get events JSON
        metrics: dict of {ns/pod: {cpu, mem}} from top pods
    """
    _ensure_tables()

    pod_scores = _compute_pod_health(
        ts, ctx, ns, pods_raw, events_raw, metrics
    )
    if not pod_scores:
        return

    _persist_pod_health(ts, pod_scores)
    dep_scores = _compute_deployment_health(ts, pod_scores)
    _persist_deployment_health(ts, dep_scores)
    _detect_incidents(ts, ctx, ns, dep_scores)


# --- Pod health ---

def _compute_pod_health(ts, ctx, ns, pods_raw, events_raw, metrics):
    """Score each pod. Returns list of dicts."""
    if not pods_raw:
        return []

    # Build event lookup: object → {warning_count, reasons}
    event_map = _build_event_map(events_raw)

    # Previous restart counts for delta detection
    prev_restarts = _get_previous_restarts(ctx, ns)

    scores = []
    for item in pods_raw.get("items", []):
        meta = item.get("metadata", {})
        status = item.get("status", {})
        spec = item.get("spec", {})

        name = meta.get("name", "")
        pod_ns = meta.get("namespace", ns or "")

        # Deployment from owner
        deployment = ""
        for o in meta.get("ownerReferences", []):
            if o.get("kind") == "ReplicaSet":
                deployment = "-".join(
                    o["name"].split("-")[:-1]
                )

        # --- Scoring ---
        score = 100
        reasons = []

        # Phase / ready check
        phase = status.get("phase", "Unknown")
        ready = True
        for cs in status.get("containerStatuses", []):
            if not cs.get("ready", False):
                ready = False
            waiting = cs.get("waiting", {})
            reason = waiting.get("reason", "")
            if reason == "CrashLoopBackOff":
                score -= 40
                reasons.append("CrashLoopBackOff")
                ready = False
            elif reason in ("ImagePullBackOff", "ErrImagePull"):
                score -= 40
                reasons.append(reason)
                ready = False

        if not ready and "CrashLoopBackOff" not in reasons:
            score -= 40
            reasons.append("not_ready")

        # Restart delta
        restarts = sum(
            cs.get("restartCount", 0)
            for cs in status.get("containerStatuses", [])
        )
        prev = prev_restarts.get(name, 0)
        if restarts > prev and prev > 0:
            score -= 20
            reasons.append(
                f"restart_increase({prev}->{restarts})"
            )

        # OOMKilled (check lastState)
        for cs in status.get("containerStatuses", []):
            last = cs.get("lastState", {}).get(
                "terminated", {}
            )
            if last.get("reason") == "OOMKilled":
                score -= 30
                reasons.append("OOMKilled")
                break

        # FailedMount from events
        pod_events = event_map.get(name, {})
        if "FailedMount" in pod_events.get("reasons", []):
            score -= 20
            reasons.append("FailedMount")

        # CPU/MEM vs limits
        key = f"{pod_ns}/{name}"
        usage = metrics.get(key, {})
        containers = spec.get("containers", [])
        if containers:
            res = containers[0].get("resources", {})
            limits = res.get("limits", {})

            cpu_lim = _parse_cpu(limits.get("cpu", "0"))
            mem_lim = _parse_mem(limits.get("memory", "0"))
            cpu_use = usage.get("cpu", 0)
            mem_use = usage.get("mem", 0)

            if cpu_lim > 0 and cpu_use > cpu_lim * 0.9:
                score -= 10
                reasons.append("cpu>90%_limit")
            if mem_lim > 0 and mem_use > mem_lim * 0.9:
                score -= 10
                reasons.append("mem>90%_limit")

        score = max(score, 0)

        # Severity from score
        if score >= 80:
            severity = "healthy"
        elif score >= 60:
            severity = "warning"
        elif score >= 40:
            severity = "degraded"
        else:
            severity = "critical"

        # Event counts for this pod
        ev = pod_events
        scores.append({
            "ts": ts,
            "context": ctx,
            "namespace": pod_ns,
            "pod": name,
            "deployment": deployment,
            "health_score": score,
            "severity": severity,
            "reasons": json.dumps(reasons),
            "event_count": ev.get("total", 0),
            "warning_count": ev.get("warning", 0),
            "critical_count": ev.get("critical", 0),
            "top_reason": (
                ev.get("reasons", [""])[0]
                if ev.get("reasons") else ""
            ),
            "health_version": HEALTH_VERSION,
        })

    return scores


def _compute_deployment_health(ts, pod_scores):
    """
    Aggregate pod scores into deployment health.
    Score = average pod score + penalty for unhealthy pods.
    """
    deployments = {}
    for p in pod_scores:
        dep = p["deployment"]
        if not dep:
            continue
        if dep not in deployments:
            deployments[dep] = {
                "context": p["context"],
                "namespace": p["namespace"],
                "pods": [],
            }
        deployments[dep]["pods"].append(p)

    results = []
    for dep_name, info in deployments.items():
        pods = info["pods"]
        pod_count = len(pods)
        if pod_count == 0:
            continue

        # Average score
        avg_score = sum(
            p["health_score"] for p in pods
        ) / pod_count

        # Count unhealthy
        unhealthy = sum(
            1 for p in pods
            if p["severity"] in ("critical", "degraded")
        )

        # Penalty: -5 per unhealthy pod (capped)
        penalty = min(unhealthy * 5, 30)
        final_score = max(int(avg_score - penalty), 0)

        # Severity from final score
        if final_score >= 80:
            severity = "healthy"
        elif final_score >= 60:
            severity = "warning"
        elif final_score >= 40:
            severity = "degraded"
        else:
            severity = "critical"

        # Aggregate counts
        warning_count = sum(
            p["warning_count"] for p in pods
        )
        restart_reasons = [
            r for p in pods
            for r in json.loads(p["reasons"])
            if "restart" in r
        ]

        # Top reason across pods
        all_reasons = []
        for p in pods:
            all_reasons.extend(json.loads(p["reasons"]))
        top_reason = (
            max(set(all_reasons), key=all_reasons.count)
            if all_reasons else ""
        )

        # Replicas from deployment_state
        desired = pod_count  # fallback
        available = sum(
            1 for p in pods
            if p["severity"] != "critical"
        )

        results.append({
            "ts": ts,
            "context": info["context"],
            "namespace": info["namespace"],
            "deployment": dep_name,
            "health_score": final_score,
            "severity": severity,
            "available_replicas": available,
            "desired_replicas": desired,
            "warning_count": warning_count,
            "restart_count": len(restart_reasons),
            "pod_count": pod_count,
            "unhealthy_pods": unhealthy,
            "top_reason": top_reason,
            "health_version": HEALTH_VERSION,
        })

    return results


# --- Incident detection ---

def _detect_incidents(ts, ctx, ns, dep_scores):
    """
    Generate incident candidates from meaningful transitions.
    Compares current deployment health to previous snapshot.
    """
    if not dep_scores:
        return

    # Get previous deployment scores
    prev = _get_previous_deployment_health(ctx, ns)

    candidates = []
    for dep in dep_scores:
        name = dep["deployment"]
        current_score = dep["health_score"]
        current_sev = dep["severity"]

        prev_entry = prev.get(name)
        if not prev_entry:
            # First snapshot — no transition to detect
            continue

        prev_score = prev_entry[0]
        prev_sev = prev_entry[1]

        # Meaningful transitions only
        generate = False
        reason = ""

        sev_order = {
            "healthy": 0, "warning": 1,
            "degraded": 2, "critical": 3,
        }
        prev_level = sev_order.get(prev_sev, 0)
        curr_level = sev_order.get(current_sev, 0)

        # Healthy → Warning/Critical
        if prev_sev == "healthy" and curr_level >= 1:
            generate = True
            reason = f"healthy_to_{current_sev}"

        # Warning → Critical
        elif prev_sev == "warning" and curr_level >= 2:
            generate = True
            reason = f"warning_to_{current_sev}"

        # Health drop >20
        elif prev_score - current_score > 20:
            generate = True
            reason = (
                f"health_drop_{prev_score}->{current_score}"
            )

        if generate:
            from core.analytics.queue import uuid7
            candidates.append((
                uuid7(),
                ts,
                ctx,
                dep["namespace"],
                name,
                "Deployment",
                current_sev,
                "OPEN",
                reason,
                prev_score,
                current_score,
                dep["top_reason"],
            ))

    if candidates:
        execute_many(
            "INSERT INTO incident_candidate VALUES "
            "(?,?,?,?,?,?,?,?,?,?,?,?)",
            candidates,
        )


# --- Persistence ---

def _persist_pod_health(ts, pod_scores):
    """Batch insert pod health snapshots."""
    rows = [
        (
            p["ts"], p["context"], p["namespace"],
            p["pod"], p["deployment"],
            p["health_score"], p["severity"], p["reasons"],
            p["event_count"], p["warning_count"],
            p["critical_count"], p["top_reason"],
            p["health_version"],
        )
        for p in pod_scores
    ]
    if rows:
        execute_many(
            "INSERT INTO pod_health_snapshot VALUES "
            "(?,?,?,?,?,?,?,?,?,?,?,?,?)",
            rows,
        )


def _persist_deployment_health(ts, dep_scores):
    """Batch insert deployment health snapshots."""
    rows = [
        (
            d["ts"], d["context"], d["namespace"],
            d["deployment"], d["health_score"], d["severity"],
            d["available_replicas"], d["desired_replicas"],
            d["warning_count"], d["restart_count"],
            d["pod_count"], d["unhealthy_pods"],
            d["top_reason"], d["health_version"],
        )
        for d in dep_scores
    ]
    if rows:
        execute_many(
            "INSERT INTO deployment_health_snapshot VALUES "
            "(?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
            rows,
        )


# --- Query helpers ---

def _get_previous_restarts(ctx, ns):
    """Get restart counts from the most recent raw snapshot."""
    try:
        rows = execute("""
            SELECT pod, restarts FROM raw_pod_metrics
            WHERE context = ? AND namespace = ?
              AND ts = (
                  SELECT MAX(ts) FROM raw_pod_metrics
                  WHERE context = ? AND namespace = ?
              )
        """, [ctx, ns or "", ctx, ns or ""])
        return {r[0]: r[1] for r in rows}
    except Exception:
        return {}


def _get_previous_deployment_health(ctx, ns):
    """Get previous deployment health for transition detection."""
    try:
        rows = execute("""
            SELECT deployment, health_score, severity
            FROM deployment_health_snapshot
            WHERE context = ? AND namespace = ?
              AND ts = (
                  SELECT MAX(ts)
                  FROM deployment_health_snapshot
                  WHERE context = ? AND namespace = ?
              )
        """, [ctx, ns, ctx, ns])
        return {r[0]: (r[1], r[2]) for r in rows}
    except Exception:
        return {}


def _build_event_map(events_raw):
    """Build per-object event summary from raw events."""
    event_map = {}
    if not events_raw:
        return event_map

    for item in events_raw.get("items", []):
        obj = item.get(
            "involvedObject", {}
        ).get("name", "")
        if not obj:
            continue

        if obj not in event_map:
            event_map[obj] = {
                "total": 0, "warning": 0,
                "critical": 0, "reasons": [],
            }

        entry = event_map[obj]
        entry["total"] += item.get("count", 1)

        etype = item.get("type", "Normal")
        if etype == "Warning":
            entry["warning"] += item.get("count", 1)

        reason = item.get("reason", "")
        if reason and reason not in entry["reasons"]:
            entry["reasons"].append(reason)

    return event_map


# --- Trend queries (computed, not stored) ---

def deployment_trend(deployment, ctx=None, ns=None, hours=1):
    """
    Compute health trend for a deployment.
    Returns current score minus score from N hours ago.
    """
    ctx = ctx or context.current_context
    ns = ns or context.namespace

    try:
        row = execute_one(f"""
            WITH current AS (
                SELECT health_score FROM deployment_health_snapshot
                WHERE context = ? AND namespace = ?
                  AND deployment = ?
                ORDER BY ts DESC LIMIT 1
            ),
            previous AS (
                SELECT health_score FROM deployment_health_snapshot
                WHERE context = ? AND namespace = ?
                  AND deployment = ?
                  AND ts <= NOW() - INTERVAL '{hours} hours'
                ORDER BY ts DESC LIMIT 1
            )
            SELECT
                (SELECT health_score FROM current),
                (SELECT health_score FROM previous)
        """, [ctx, ns, deployment, ctx, ns, deployment])

        if row and row[0] is not None and row[1] is not None:
            return {
                "current": row[0],
                "previous": row[1],
                "trend": row[0] - row[1],
            }
        return None
    except Exception:
        return None

def deployment_health_current(ctx=None, ns=None):
    """
    Get latest deployment health with 1h trend.
    Single query, returns everything the UI needs.
    """
    ctx = ctx or context.current_context
    ns = ns or context.namespace

    try:
        rows = execute("""
            WITH latest AS (
                SELECT deployment, health_score, severity,
                       available_replicas, desired_replicas,
                       warning_count, restart_count,
                       pod_count, unhealthy_pods, top_reason
                FROM deployment_health_snapshot
                WHERE context = ? AND namespace = ?
                  AND ts = (
                      SELECT MAX(ts)
                      FROM deployment_health_snapshot
                      WHERE context = ? AND namespace = ?
                  )
            ),
            hour_ago AS (
                SELECT deployment, health_score
                FROM deployment_health_snapshot
                WHERE context = ? AND namespace = ?
                  AND ts = (
                      SELECT MAX(ts)
                      FROM deployment_health_snapshot
                      WHERE context = ? AND namespace = ?
                        AND ts <= NOW() - INTERVAL '1 hour'
                  )
            )
            SELECT
                l.deployment, l.health_score, l.severity,
                l.available_replicas, l.desired_replicas,
                l.warning_count, l.restart_count,
                l.pod_count, l.unhealthy_pods, l.top_reason,
                l.health_score - h.health_score AS trend_1h
            FROM latest l
            LEFT JOIN hour_ago h
              ON l.deployment = h.deployment
            ORDER BY l.health_score ASC
        """, [ctx, ns, ctx, ns, ctx, ns, ctx, ns])

        return [
            {
                "deployment": r[0],
                "health_score": r[1],
                "severity": r[2],
                "available_replicas": r[3],
                "desired_replicas": r[4],
                "warning_count": r[5],
                "restart_count": r[6],
                "pod_count": r[7],
                "unhealthy_pods": r[8],
                "top_reason": r[9],
                "trend_1h": r[10],
            }
            for r in rows
        ]
    except Exception:
        return []



def open_incidents(ctx=None, ns=None):
    """Get open/active incident candidates."""
    ctx = ctx or context.current_context
    ns = ns or context.namespace

    try:
        rows = execute("""
            SELECT incident_id, ts, object, object_kind,
                   severity, status, reason,
                   health_before, health_after, details
            FROM incident_candidate
            WHERE context = ? AND namespace = ?
              AND status IN ('OPEN', 'ACTIVE')
            ORDER BY ts DESC
        """, [ctx, ns])

        return [
            {
                "incident_id": r[0],
                "ts": str(r[1]),
                "object": r[2],
                "object_kind": r[3],
                "severity": r[4],
                "status": r[5],
                "reason": r[6],
                "health_before": r[7],
                "health_after": r[8],
                "details": r[9],
            }
            for r in rows
        ]
    except Exception:
        return []


def resolve_incidents(ctx=None, ns=None):
    """
    Auto-resolve incidents where deployment is now healthy.
    Called periodically after health computation.
    """
    ctx = ctx or context.current_context
    ns = ns or context.namespace

    try:
        execute_write("""
            UPDATE incident_candidate
            SET status = 'RESOLVED'
            WHERE context = ? AND namespace = ?
              AND status IN ('OPEN', 'ACTIVE')
              AND object IN (
                  SELECT deployment
                  FROM deployment_health_snapshot
                  WHERE context = ? AND namespace = ?
                    AND ts = (
                        SELECT MAX(ts)
                        FROM deployment_health_snapshot
                        WHERE context = ? AND namespace = ?
                    )
                    AND severity = 'healthy'
              )
        """, [ctx, ns, ctx, ns, ctx, ns])
    except Exception:
        pass


# --- Schema ---

def _ensure_tables():
    """Create health tables if not exist."""
    global _tables_created
    if _tables_created:
        return

    conn = get_conn()

    conn.execute("""
        CREATE TABLE IF NOT EXISTS pod_health_snapshot (
            ts TIMESTAMP,
            context VARCHAR,
            namespace VARCHAR,
            pod VARCHAR,
            deployment VARCHAR,
            health_score INTEGER,
            severity VARCHAR,
            reasons VARCHAR,
            event_count INTEGER,
            warning_count INTEGER,
            critical_count INTEGER,
            top_reason VARCHAR,
            health_version INTEGER
        )
    """)

    conn.execute("""
        CREATE TABLE IF NOT EXISTS deployment_health_snapshot (
            ts TIMESTAMP,
            context VARCHAR,
            namespace VARCHAR,
            deployment VARCHAR,
            health_score INTEGER,
            severity VARCHAR,
            available_replicas INTEGER,
            desired_replicas INTEGER,
            warning_count INTEGER,
            restart_count INTEGER,
            pod_count INTEGER,
            unhealthy_pods INTEGER,
            top_reason VARCHAR,
            health_version INTEGER
        )
    """)

    conn.execute("""
        CREATE TABLE IF NOT EXISTS incident_candidate (
            incident_id VARCHAR,
            ts TIMESTAMP,
            context VARCHAR,
            namespace VARCHAR,
            object VARCHAR,
            object_kind VARCHAR,
            severity VARCHAR,
            status VARCHAR,
            reason VARCHAR,
            health_before INTEGER,
            health_after INTEGER,
            details VARCHAR
        )
    """)

    conn.execute("""
        CREATE INDEX IF NOT EXISTS idx_pod_health_ts
        ON pod_health_snapshot (context, namespace, ts)
    """)
    conn.execute("""
        CREATE INDEX IF NOT EXISTS idx_dep_health_ts
        ON deployment_health_snapshot (
            context, namespace, ts
        )
    """)
    conn.execute("""
        CREATE INDEX IF NOT EXISTS idx_dep_health_deploy
        ON deployment_health_snapshot (deployment, ts)
    """)
    conn.execute("""
        CREATE INDEX IF NOT EXISTS idx_incident_status
        ON incident_candidate (context, namespace, status)
    """)

    _tables_created = True


# --- Parsing helpers ---

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
