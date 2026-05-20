"""
Enriched Monitor Collector — extends base collector with
HPA state, OOMKill signals, quota pressure, and rollout
status for deeper cluster observability.
"""

import json
import subprocess
from datetime import datetime

from core.context import context
from core.analytics.engine import get_conn, execute_many, execute_write


_tables_created = False


def collect_enriched():
    """
    Run enriched collection cycle.
    Call after base collector or on its own schedule.
    """
    ctx = context.current_context
    ns = context.namespace
    if not ctx:
        return {"hpa": 0, "oomkills": 0, "quotas": 0, "rollouts": 0}

    conn = get_conn()
    _ensure_tables(conn)
    ts = datetime.utcnow()

    hpa = _collect_hpa(conn, ts, ctx, ns)
    oomkills = _collect_oomkills(conn, ts, ctx, ns)
    quotas = _collect_quotas(conn, ts, ctx, ns)
    rollouts = _collect_rollouts(conn, ts, ctx, ns)

    return {
        "hpa": hpa,
        "oomkills": oomkills,
        "quotas": quotas,
        "rollouts": rollouts,
    }


def _collect_hpa(conn, ts, ctx, ns):
    """Collect HPA current/min/max/target metrics."""
    cmd = [
        "kubectl", "--context", ctx,
        "get", "hpa", "-n", ns, "-o", "json"
    ]
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode != 0:
        return 0

    data = json.loads(r.stdout)
    rows = []

    for item in data.get("items", []):
        meta = item.get("metadata", {})
        spec = item.get("spec", {})
        status = item.get("status", {})

        name = meta.get("name", "")
        target = spec.get("scaleTargetRef", {}).get("name", "")
        min_replicas = spec.get("minReplicas", 1)
        max_replicas = spec.get("maxReplicas", 1)
        current = status.get("currentReplicas", 0)
        desired = status.get("desiredReplicas", 0)

        # CPU target vs current
        cpu_target = 0
        cpu_current = 0
        for metric in spec.get("metrics", []):
            if metric.get("type") == "Resource":
                res = metric.get("resource", {})
                if res.get("name") == "cpu":
                    cpu_target = (
                        res.get("target", {})
                        .get("averageUtilization", 0)
                    )
        for metric in status.get("currentMetrics", []):
            if metric.get("type") == "Resource":
                res = metric.get("resource", {})
                if res.get("name") == "cpu":
                    cpu_current = (
                        res.get("current", {})
                        .get("averageUtilization", 0)
                    )

        # Detect scaling pressure
        at_max = current >= max_replicas
        scaling_up = desired > current

        rows.append((
            ts, ctx, ns, name, target,
            min_replicas, max_replicas, current, desired,
            cpu_target, cpu_current, at_max, scaling_up,
        ))

    if rows:
        execute_many(
            "INSERT INTO hpa_metrics VALUES "
            "(?,?,?,?,?,?,?,?,?,?,?,?,?)",
            rows
        )
    return len(rows)


def _collect_oomkills(conn, ts, ctx, ns):
    """Detect OOMKilled containers from pod status."""
    cmd = [
        "kubectl", "--context", ctx,
        "get", "pods", "-n", ns, "-o", "json"
    ]
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode != 0:
        return 0

    data = json.loads(r.stdout)
    rows = []

    for item in data.get("items", []):
        pod_name = item["metadata"]["name"]
        for cs in item.get("status", {}).get("containerStatuses", []):
            # Check lastState for OOMKilled
            last = cs.get("lastState", {}).get("terminated", {})
            if last.get("reason") == "OOMKilled":
                finished = last.get("finishedAt", "")
                container = cs.get("name", "")
                mem_limit = 0

                # Get limit from spec
                for c in item["spec"].get("containers", []):
                    if c.get("name") == container:
                        lim = (c.get("resources", {})
                               .get("limits", {})
                               .get("memory", "0"))
                        mem_limit = _parse_mem(lim)

                rows.append((
                    ts, ctx, ns, pod_name, container,
                    mem_limit, finished,
                ))

    if rows:
        execute_many(
            "INSERT INTO oomkill_events VALUES "
            "(?,?,?,?,?,?,?)",
            rows
        )
    return len(rows)


def _collect_quotas(conn, ts, ctx, ns):
    """Collect resource quota usage vs limits."""
    cmd = [
        "kubectl", "--context", ctx,
        "get", "resourcequota", "-n", ns, "-o", "json"
    ]
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode != 0:
        return 0

    data = json.loads(r.stdout)
    rows = []

    for item in data.get("items", []):
        name = item["metadata"]["name"]
        status = item.get("status", {})
        hard = status.get("hard", {})
        used = status.get("used", {})

        for resource in hard:
            hard_val = hard[resource]
            used_val = used.get(resource, "0")
            hard_num = _parse_quantity(hard_val)
            used_num = _parse_quantity(used_val)
            pct = (
                round(used_num * 100 / hard_num, 1)
                if hard_num > 0 else 0
            )

            rows.append((
                ts, ctx, ns, name, resource,
                hard_num, used_num, pct,
            ))

    if rows:
        execute_many(
            "INSERT INTO quota_metrics VALUES "
            "(?,?,?,?,?,?,?,?)",
            rows
        )
    return len(rows)


def _collect_rollouts(conn, ts, ctx, ns):
    """Capture deployment rollout state — progressing, stalled, complete."""
    cmd = [
        "kubectl", "--context", ctx,
        "get", "deployments", "-n", ns, "-o", "json"
    ]
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode != 0:
        return 0

    data = json.loads(r.stdout)
    rows = []

    for item in data.get("items", []):
        name = item["metadata"]["name"]
        status = item.get("status", {})
        spec = item.get("spec", {})

        desired = spec.get("replicas", 0)
        updated = status.get("updatedReplicas", 0)
        available = status.get("availableReplicas", 0)
        unavailable = status.get("unavailableReplicas", 0)

        # Determine rollout state from conditions
        state = "complete"
        for cond in status.get("conditions", []):
            if (cond.get("type") == "Progressing"
                    and cond.get("status") == "True"
                    and "NewReplicaSetAvailable" not in
                    cond.get("reason", "")):
                state = "progressing"
            if (cond.get("type") == "Progressing"
                    and cond.get("reason") == "ProgressDeadlineExceeded"):
                state = "stalled"
            if (cond.get("type") == "Available"
                    and cond.get("status") == "False"):
                state = "degraded"

        if unavailable and unavailable > 0:
            state = "progressing" if state == "complete" else state

        rows.append((
            ts, ctx, ns, name,
            desired, updated, available, unavailable or 0,
            state,
        ))

    if rows:
        execute_many(
            "INSERT INTO rollout_metrics VALUES "
            "(?,?,?,?,?,?,?,?,?)",
            rows
        )
    return len(rows)


def _ensure_tables(conn):
    """Create enriched monitoring tables."""
    global _tables_created
    if _tables_created:
        return

    conn.execute("""
        CREATE TABLE IF NOT EXISTS hpa_metrics (
            ts TIMESTAMP,
            context VARCHAR,
            namespace VARCHAR,
            hpa_name VARCHAR,
            target_deployment VARCHAR,
            min_replicas INTEGER,
            max_replicas INTEGER,
            current_replicas INTEGER,
            desired_replicas INTEGER,
            cpu_target_pct INTEGER,
            cpu_current_pct INTEGER,
            at_max BOOLEAN,
            scaling_up BOOLEAN
        )
    """)

    conn.execute("""
        CREATE TABLE IF NOT EXISTS oomkill_events (
            ts TIMESTAMP,
            context VARCHAR,
            namespace VARCHAR,
            pod VARCHAR,
            container VARCHAR,
            mem_limit_mb INTEGER,
            killed_at VARCHAR
        )
    """)

    conn.execute("""
        CREATE TABLE IF NOT EXISTS quota_metrics (
            ts TIMESTAMP,
            context VARCHAR,
            namespace VARCHAR,
            quota_name VARCHAR,
            resource VARCHAR,
            hard_value DOUBLE,
            used_value DOUBLE,
            used_pct DOUBLE
        )
    """)

    conn.execute("""
        CREATE TABLE IF NOT EXISTS rollout_metrics (
            ts TIMESTAMP,
            context VARCHAR,
            namespace VARCHAR,
            deployment VARCHAR,
            desired INTEGER,
            updated INTEGER,
            available INTEGER,
            unavailable INTEGER,
            state VARCHAR
        )
    """)

    conn.execute("""
        CREATE INDEX IF NOT EXISTS idx_hpa_ts
        ON hpa_metrics (context, ts)
    """)
    conn.execute("""
        CREATE INDEX IF NOT EXISTS idx_oomkill_ts
        ON oomkill_events (context, ts)
    """)
    conn.execute("""
        CREATE INDEX IF NOT EXISTS idx_rollout_ts
        ON rollout_metrics (context, namespace, ts)
    """)

    _tables_created = True


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


def _parse_quantity(val):
    """Parse k8s quantity (cpu, memory, count)."""
    val = str(val).strip()
    if not val or val == "0":
        return 0
    # Pure integer (pod count, etc.)
    try:
        return float(val)
    except ValueError:
        pass
    if val.endswith("m"):
        return float(val[:-1]) / 1000
    if val.endswith("Mi"):
        return float(val[:-2])
    if val.endswith("Gi"):
        return float(val[:-2]) * 1024
    if val.endswith("Ki"):
        return float(val[:-2]) / 1024
    return 0
