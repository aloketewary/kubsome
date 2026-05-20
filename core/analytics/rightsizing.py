"""
Analytics Right-Sizing v2 — safe, data-driven CPU/memory
request/limit recommendations.

Key design:
  - Queries hourly_pod_metrics (pre-aggregated, fast at scale)
  - Groups by workload type (deployment, statefulset, daemonset)
  - Filters by namespace or label for phased rollout
  - Caches recommendations for 6-12 hours
  - Exports YAML patches for easy application
  - Integrates with VPA recommendations
  - Auto safe-rollout logic (canary → full)

Methodology:
  Request = P95 + 20% buffer
  Limit   = P99 + 50% headroom
"""

import time
import json
import subprocess
from pathlib import Path
from datetime import datetime

from core.analytics.engine import get_conn, cached_query, invalidate_cache
from core.context import context

# Safety thresholds
MIN_CPU_REQUEST_M = 10
MIN_CPU_LIMIT_M = 50
MIN_MEM_REQUEST_MI = 32
MIN_MEM_LIMIT_MI = 64
MIN_SAMPLES = 12
MAX_REDUCTION_PCT = 70

# Buffer multipliers
REQUEST_BUFFER = 1.20
LIMIT_BUFFER = 1.50
VOLATILITY_THRESHOLD = 0.5

# Cache TTL for recommendations (seconds)
RECOMMENDATION_CACHE_TTL = 6 * 3600  # 6 hours

EXPORT_DIR = Path.home() / ".kubsome" / "analytics" / "patches"


def pod_rightsizing(days=7, namespace=None, labels=None,
                    workload_type=None, min_savings_usd=0.50):
    """
    Generate safe right-sizing recommendations.

    Args:
        days: lookback window
        namespace: filter by namespace (None = all)
        labels: filter by label selector dict (e.g. {"app": "payment"})
        workload_type: filter by type (deployment/statefulset/daemonset)
        min_savings_usd: minimum monthly savings to include
    """
    cache_key = f"rightsizing_{days}_{namespace}_{workload_type}"
    cached = _get_cached_recommendations(cache_key)
    if cached:
        return cached

    conn = get_conn()

    # Build WHERE filters
    filters = [
        f"hour >= NOW() - INTERVAL '{days} days'",
        "deployment != ''",
        "cpu_request > 0",
    ]
    if namespace:
        filters.append(f"namespace = '{namespace}'")

    where = " AND ".join(filters)

    rows = conn.execute(f"""
        SELECT
            deployment,
            namespace,
            AVG(pod_count)::INTEGER AS avg_pods,
            MAX(cpu_request) AS cpu_request,
            (MAX(cpu_request) * 2) AS cpu_limit,
            AVG(cpu_avg)::INTEGER AS cpu_avg,
            PERCENTILE_CONT(0.50) WITHIN GROUP
                (ORDER BY cpu_avg)::INTEGER AS cpu_p50,
            MAX(cpu_p95) AS cpu_p95,
            MAX(cpu_max) AS cpu_p99,
            MAX(cpu_max) AS cpu_max,
            STDDEV(cpu_avg)::INTEGER AS cpu_stddev,
            MAX(mem_request) AS mem_request,
            (MAX(mem_request) * 2) AS mem_limit,
            AVG(mem_avg)::INTEGER AS mem_avg,
            PERCENTILE_CONT(0.50) WITHIN GROUP
                (ORDER BY mem_avg)::INTEGER AS mem_p50,
            MAX(mem_p95) AS mem_p95,
            MAX(mem_max) AS mem_p99,
            MAX(mem_max) AS mem_max,
            STDDEV(mem_avg)::INTEGER AS mem_stddev,
            COUNT(*) AS sample_count,
            SUM(restart_count) AS total_restarts
        FROM hourly_pod_metrics
        WHERE {where}
        GROUP BY deployment, namespace
        HAVING COUNT(*) >= {MIN_SAMPLES}
        ORDER BY deployment
    """).fetchall()

    cols = [
        "deployment", "namespace", "avg_pods",
        "cpu_request", "cpu_limit",
        "cpu_avg", "cpu_p50", "cpu_p95", "cpu_p99", "cpu_max", "cpu_stddev",
        "mem_request", "mem_limit",
        "mem_avg", "mem_p50", "mem_p95", "mem_p99", "mem_max", "mem_stddev",
        "sample_count", "total_restarts",
    ]

    # Get cost model
    cost = conn.execute(
        "SELECT cpu_per_core_hour, mem_per_gb_hour "
        "FROM cost_model WHERE name='default'"
    ).fetchone()
    cpu_rate = cost[0] if cost else 0.0425
    mem_rate = cost[1] if cost else 0.0053

    # Get workload types from cluster
    workload_map = _get_workload_types()

    # Get VPA recommendations if available
    vpa_map = _get_vpa_recommendations()

    recommendations = []
    for row in rows:
        data = dict(zip(cols, row))
        deploy_name = data["deployment"]

        # Determine workload type
        wtype = workload_map.get(deploy_name, "deployment")
        data["workload_type"] = wtype

        # Filter by workload type
        if workload_type and wtype != workload_type:
            continue

        # Filter by labels
        if labels and not _matches_labels(deploy_name, labels):
            continue

        # Compute recommendation
        rec = _compute_recommendation(data, cpu_rate, mem_rate)
        if not rec:
            continue

        # Enrich with workload type
        rec["workload_type"] = wtype

        # Merge VPA recommendation if available
        vpa = vpa_map.get(f"{data['namespace']}/{deploy_name}")
        if vpa:
            rec["vpa"] = vpa
            rec["vpa_aligned"] = _check_vpa_alignment(rec, vpa)

        if rec["total_savings_monthly"] >= min_savings_usd:
            recommendations.append(rec)

    recommendations.sort(
        key=lambda x: x["total_savings_monthly"], reverse=True
    )

    # Cache results
    _cache_recommendations(cache_key, recommendations)

    return recommendations


def _compute_recommendation(data, cpu_rate, mem_rate):
    """Compute safe recommendation for a single workload."""
    deployment = data["deployment"]
    namespace = data["namespace"]
    pods = data["avg_pods"] or 1

    # CPU
    cpu_req_current = data["cpu_request"]
    cpu_lim_current = data["cpu_limit"] or cpu_req_current * 2
    cpu_p95 = data["cpu_p95"] or 0
    cpu_p99 = data["cpu_p99"] or cpu_p95
    cpu_avg = data["cpu_avg"] or 0
    cpu_stddev = data["cpu_stddev"] or 0

    cpu_volatile = (
        cpu_stddev / max(cpu_avg, 1) > VOLATILITY_THRESHOLD
    ) if cpu_avg > 0 else False

    cpu_req_rec = max(int(cpu_p95 * REQUEST_BUFFER), MIN_CPU_REQUEST_M)
    cpu_lim_rec = max(
        int(cpu_p99 * LIMIT_BUFFER), MIN_CPU_LIMIT_M, cpu_req_rec
    )

    if cpu_req_current > 0:
        min_allowed = int(cpu_req_current * (1 - MAX_REDUCTION_PCT / 100))
        cpu_req_rec = max(cpu_req_rec, min_allowed)

    if cpu_volatile:
        cpu_req_rec = int(cpu_req_rec * 1.3)
        cpu_lim_rec = int(cpu_lim_rec * 1.3)

    # Memory (more conservative — OOM is fatal)
    mem_req_current = data["mem_request"]
    mem_lim_current = data["mem_limit"] or mem_req_current * 2
    mem_p95 = data["mem_p95"] or 0
    mem_p99 = data["mem_p99"] or mem_p95
    mem_avg = data["mem_avg"] or 0
    mem_stddev = data["mem_stddev"] or 0

    mem_volatile = (
        mem_stddev / max(mem_avg, 1) > VOLATILITY_THRESHOLD
    ) if mem_avg > 0 else False

    mem_req_rec = max(int(mem_p95 * REQUEST_BUFFER * 1.1), MIN_MEM_REQUEST_MI)
    mem_lim_rec = max(
        int(mem_p99 * LIMIT_BUFFER * 1.2), MIN_MEM_LIMIT_MI, mem_req_rec
    )

    if mem_req_current > 0:
        min_allowed = int(mem_req_current * (1 - MAX_REDUCTION_PCT / 100))
        mem_req_rec = max(mem_req_rec, min_allowed)

    if mem_volatile:
        mem_req_rec = int(mem_req_rec * 1.3)
        mem_lim_rec = int(mem_lim_rec * 1.3)

    # High restarts = never reduce memory
    if data["total_restarts"] > 10:
        mem_req_rec = max(mem_req_rec, mem_req_current)
        mem_lim_rec = max(mem_lim_rec, mem_lim_current)

    # Skip if no meaningful change
    cpu_delta = cpu_req_current - cpu_req_rec
    mem_delta = mem_req_current - mem_req_rec
    if abs(cpu_delta) < 10 and abs(mem_delta) < 10:
        return None

    # Savings
    cpu_savings = max(0, cpu_delta / 1000.0 * cpu_rate * 720 * pods)
    mem_savings = max(0, mem_delta / 1024.0 * mem_rate * 720 * pods)
    total_savings = round(cpu_savings + mem_savings, 2)

    # Confidence & risk
    confidence = _compute_confidence(data, cpu_volatile, mem_volatile)
    risk = _compute_risk(
        cpu_req_current, cpu_req_rec,
        mem_req_current, mem_req_rec,
        data["total_restarts"], cpu_volatile, mem_volatile
    )

    cpu_dir = "decrease" if cpu_delta > 0 else "increase" if cpu_delta < 0 else "keep"
    mem_dir = "decrease" if mem_delta > 0 else "increase" if mem_delta < 0 else "keep"

    return {
        "deployment": deployment,
        "namespace": namespace,
        "pods": pods,
        "sample_hours": data["sample_count"],
        "total_restarts": data["total_restarts"],
        "current": {
            "cpu_request": cpu_req_current,
            "cpu_limit": cpu_lim_current,
            "mem_request": mem_req_current,
            "mem_limit": mem_lim_current,
        },
        "usage": {
            "cpu_avg": cpu_avg, "cpu_p50": data["cpu_p50"],
            "cpu_p95": cpu_p95, "cpu_p99": cpu_p99,
            "cpu_max": data["cpu_max"], "cpu_stddev": cpu_stddev,
            "cpu_volatile": cpu_volatile,
            "mem_avg": mem_avg, "mem_p50": data["mem_p50"],
            "mem_p95": mem_p95, "mem_p99": mem_p99,
            "mem_max": data["mem_max"], "mem_stddev": mem_stddev,
            "mem_volatile": mem_volatile,
        },
        "recommended": {
            "cpu_request": cpu_req_rec,
            "cpu_limit": cpu_lim_rec,
            "mem_request": mem_req_rec,
            "mem_limit": mem_lim_rec,
        },
        "direction": {"cpu": cpu_dir, "mem": mem_dir},
        "confidence": confidence,
        "risk": risk,
        "total_savings_monthly": total_savings,
        "cpu_savings_monthly": round(cpu_savings, 2),
        "mem_savings_monthly": round(mem_savings, 2),
    }


def _compute_confidence(data, cpu_vol, mem_vol):
    score = 50
    samples = data["sample_count"]
    if samples >= 168:
        score += 25
    elif samples >= 72:
        score += 15
    elif samples >= 24:
        score += 5
    if not cpu_vol:
        score += 10
    if not mem_vol:
        score += 10
    if data["total_restarts"] == 0:
        score += 5
    elif data["total_restarts"] > 20:
        score -= 15
    return min(100, max(0, score))


def _compute_risk(cpu_req, cpu_rec, mem_req, mem_rec,
                  restarts, cpu_vol, mem_vol):
    cpu_red = (cpu_req - cpu_rec) * 100 / max(cpu_req, 1) if cpu_rec < cpu_req else 0
    mem_red = (mem_req - mem_rec) * 100 / max(mem_req, 1) if mem_rec < mem_req else 0
    if cpu_red > 50 or mem_red > 50 or restarts > 20 or (cpu_vol and mem_vol):
        return "high"
    if cpu_red > 30 or mem_red > 30 or restarts > 5 or cpu_vol or mem_vol:
        return "medium"
    return "low"


# --- Workload type detection ---

def _get_workload_types():
    """Map deployment names to workload types from cluster."""
    ctx = context.current_context
    ns = context.namespace
    result = {}

    for kind in ("deployments", "statefulsets", "daemonsets"):
        cmd = [
            "kubectl", "--context", str(ctx or ""),
            "get", kind, "-n", str(ns),
            "-o", "jsonpath={.items[*].metadata.name}"
        ]
        r = subprocess.run(cmd, capture_output=True, text=True)
        if r.returncode == 0 and r.stdout.strip():
            wtype = kind.rstrip("s")  # deployment, statefulset, daemonset
            for name in r.stdout.strip().split():
                result[name] = wtype

    return result


def _matches_labels(deployment, labels):
    """Check if a deployment matches label selector."""
    ctx = context.current_context
    ns = context.namespace
    selector = ",".join(f"{k}={v}" for k, v in labels.items())
    cmd = [
        "kubectl", "--context", str(ctx or ""),
        "get", "deployment", deployment, "-n", str(ns),
        "-l", selector, "-o", "name"
    ]
    r = subprocess.run(cmd, capture_output=True, text=True)
    return r.returncode == 0 and r.stdout.strip() != ""


# --- VPA integration ---

def _get_vpa_recommendations():
    """Get VPA recommendations if VPA is installed."""
    ctx = context.current_context
    ns = context.namespace
    cmd = [
        "kubectl", "--context", str(ctx or ""),
        "get", "verticalpodautoscalers.autoscaling.k8s.io",
        "-n", str(ns), "-o", "json"
    ]
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode != 0:
        return {}

    data = json.loads(r.stdout)
    vpa_map = {}
    for item in data.get("items", []):
        target = (
            item.get("spec", {})
            .get("targetRef", {})
            .get("name", "")
        )
        ns_name = item["metadata"].get("namespace", ns)
        key = f"{ns_name}/{target}"

        recs = (
            item.get("status", {})
            .get("recommendation", {})
            .get("containerRecommendations", [])
        )
        if recs:
            c = recs[0]  # First container
            vpa_map[key] = {
                "cpu_target": _parse_cpu(
                    c.get("target", {}).get("cpu", "0")
                ),
                "mem_target": _parse_mem(
                    c.get("target", {}).get("memory", "0")
                ),
                "cpu_upper": _parse_cpu(
                    c.get("upperBound", {}).get("cpu", "0")
                ),
                "mem_upper": _parse_mem(
                    c.get("upperBound", {}).get("memory", "0")
                ),
                "cpu_lower": _parse_cpu(
                    c.get("lowerBound", {}).get("cpu", "0")
                ),
                "mem_lower": _parse_mem(
                    c.get("lowerBound", {}).get("memory", "0")
                ),
            }

    return vpa_map


def _check_vpa_alignment(rec, vpa):
    """Check if our recommendation aligns with VPA."""
    our_cpu = rec["recommended"]["cpu_request"]
    our_mem = rec["recommended"]["mem_request"]
    vpa_cpu = vpa["cpu_target"]
    vpa_mem = vpa["mem_target"]

    cpu_diff = abs(our_cpu - vpa_cpu) / max(vpa_cpu, 1) * 100
    mem_diff = abs(our_mem - vpa_mem) / max(vpa_mem, 1) * 100

    if cpu_diff < 20 and mem_diff < 20:
        return "aligned"
    elif cpu_diff < 40 and mem_diff < 40:
        return "close"
    return "divergent"


# --- YAML patch export ---

def export_yaml_patches(recommendations, output_dir=None):
    """
    Export recommendations as YAML patch files.
    One file per deployment, ready for kubectl apply.
    """
    out = Path(output_dir) if output_dir else EXPORT_DIR
    out.mkdir(parents=True, exist_ok=True)

    paths = []
    for rec in recommendations:
        deploy = rec["deployment"]
        ns = rec["namespace"]
        r = rec["recommended"]
        wtype = rec.get("workload_type", "deployment")

        patch = {
            "apiVersion": "apps/v1",
            "kind": wtype.capitalize(),
            "metadata": {
                "name": deploy,
                "namespace": ns,
            },
            "spec": {
                "template": {
                    "spec": {
                        "containers": [{
                            "name": deploy,
                            "resources": {
                                "requests": {
                                    "cpu": f"{r['cpu_request']}m",
                                    "memory": f"{r['mem_request']}Mi",
                                },
                                "limits": {
                                    "cpu": f"{r['cpu_limit']}m",
                                    "memory": f"{r['mem_limit']}Mi",
                                },
                            },
                        }],
                    },
                },
            },
        }

        import yaml
        filename = f"{ns}_{deploy}_patch.yaml"
        path = out / filename
        path.write_text(yaml.dump(patch, default_flow_style=False))
        paths.append(str(path))

    return paths


def export_combined_patch(recommendations, output=None):
    """Export all patches as a single multi-doc YAML."""
    out = Path(output) if output else EXPORT_DIR / "all_patches.yaml"
    out.parent.mkdir(parents=True, exist_ok=True)

    import yaml
    docs = []
    for rec in recommendations:
        r = rec["recommended"]
        wtype = rec.get("workload_type", "deployment")
        docs.append({
            "apiVersion": "apps/v1",
            "kind": wtype.capitalize(),
            "metadata": {
                "name": rec["deployment"],
                "namespace": rec["namespace"],
            },
            "spec": {
                "template": {
                    "spec": {
                        "containers": [{
                            "name": rec["deployment"],
                            "resources": {
                                "requests": {
                                    "cpu": f"{r['cpu_request']}m",
                                    "memory": f"{r['mem_request']}Mi",
                                },
                                "limits": {
                                    "cpu": f"{r['cpu_limit']}m",
                                    "memory": f"{r['mem_limit']}Mi",
                                },
                            },
                        }],
                    },
                },
            },
        })

    out.write_text(yaml.dump_all(docs, default_flow_style=False))
    return str(out)


# --- Safe rollout logic ---

def safe_rollout_plan(recommendations):
    """
    Generate a phased rollout plan.
    Phase 1: low-risk, high-confidence changes
    Phase 2: medium-risk changes
    Phase 3: high-risk (manual review required)
    """
    phases = {"phase_1": [], "phase_2": [], "phase_3": []}

    for rec in recommendations:
        risk = rec["risk"]
        confidence = rec["confidence"]

        if risk == "low" and confidence >= 70:
            phases["phase_1"].append(rec)
        elif risk == "medium" or confidence >= 50:
            phases["phase_2"].append(rec)
        else:
            phases["phase_3"].append(rec)

    return {
        "phase_1": {
            "label": "Safe to apply (low risk, high confidence)",
            "auto_apply": True,
            "count": len(phases["phase_1"]),
            "items": phases["phase_1"],
        },
        "phase_2": {
            "label": "Apply with monitoring (medium risk)",
            "auto_apply": False,
            "count": len(phases["phase_2"]),
            "items": phases["phase_2"],
        },
        "phase_3": {
            "label": "Manual review required (high risk)",
            "auto_apply": False,
            "count": len(phases["phase_3"]),
            "items": phases["phase_3"],
        },
    }


# --- Caching ---

_rec_cache = {}


def _get_cached_recommendations(key):
    """Get cached recommendations if within TTL."""
    if key in _rec_cache:
        entry = _rec_cache[key]
        if time.time() - entry["ts"] < RECOMMENDATION_CACHE_TTL:
            return entry["data"]
    return None


def _cache_recommendations(key, data):
    """Cache recommendations."""
    _rec_cache[key] = {"ts": time.time(), "data": data}


def invalidate_recommendations():
    """Force refresh on next call."""
    global _rec_cache
    _rec_cache = {}


# --- Convenience ---

def underprovisioned(days=7, namespace=None):
    """Find workloads at risk of OOM/throttle."""
    conn = get_conn()
    ns_filter = f"AND namespace = '{namespace}'" if namespace else ""

    rows = conn.execute(f"""
        SELECT
            deployment, namespace,
            AVG(pod_count)::INTEGER AS pods,
            MAX(cpu_request) AS cpu_req,
            MAX(cpu_p95) AS cpu_p95,
            MAX(mem_request) AS mem_req,
            MAX(mem_p95) AS mem_p95,
            CASE WHEN MAX(cpu_request) > 0
                THEN ROUND(MAX(cpu_p95) * 100.0 / MAX(cpu_request), 1)
                ELSE 0 END AS cpu_util_pct,
            CASE WHEN MAX(mem_request) > 0
                THEN ROUND(MAX(mem_p95) * 100.0 / MAX(mem_request), 1)
                ELSE 0 END AS mem_util_pct,
            SUM(restart_count) AS restarts
        FROM hourly_pod_metrics
        WHERE hour >= NOW() - INTERVAL '{days} days'
          AND deployment != '' AND cpu_request > 0
          {ns_filter}
        GROUP BY deployment, namespace
        HAVING cpu_util_pct > 85 OR mem_util_pct > 85
        ORDER BY mem_util_pct DESC
    """).fetchall()

    cols = [
        "deployment", "namespace", "pods",
        "cpu_request", "cpu_p95", "mem_request", "mem_p95",
        "cpu_util_pct", "mem_util_pct", "restarts",
    ]
    return [dict(zip(cols, row)) for row in rows]


def usage_summary(days=7, namespace=None):
    """Cluster resource usage summary."""
    conn = get_conn()
    ns_filter = f"AND namespace = '{namespace}'" if namespace else ""

    row = conn.execute(f"""
        SELECT
            COUNT(DISTINCT deployment) AS deployments,
            SUM(cpu_avg)::INTEGER AS total_cpu_avg,
            SUM(cpu_request)::INTEGER AS total_cpu_req,
            SUM(mem_avg)::INTEGER AS total_mem_avg,
            SUM(mem_request)::INTEGER AS total_mem_req,
            ROUND(SUM(cpu_avg) * 100.0 / NULLIF(SUM(cpu_request), 0), 1) AS cpu_util_pct,
            ROUND(SUM(mem_avg) * 100.0 / NULLIF(SUM(mem_request), 0), 1) AS mem_util_pct
        FROM (
            SELECT deployment,
                AVG(cpu_avg)::INTEGER AS cpu_avg,
                MAX(cpu_request) AS cpu_request,
                AVG(mem_avg)::INTEGER AS mem_avg,
                MAX(mem_request) AS mem_request
            FROM hourly_pod_metrics
            WHERE hour >= NOW() - INTERVAL '{days} days'
              AND deployment != ''
              {ns_filter}
            GROUP BY deployment
        )
    """).fetchone()

    if not row or not row[0]:
        return {"deployments": 0, "cpu_util_pct": 0, "mem_util_pct": 0}

    return {
        "deployments": row[0],
        "total_cpu_avg_m": row[1],
        "total_cpu_request_m": row[2],
        "total_mem_avg_mb": row[3],
        "total_mem_request_mb": row[4],
        "cpu_util_pct": row[5] or 0,
        "mem_util_pct": row[6] or 0,
        "cpu_waste_m": (row[2] or 0) - (row[1] or 0),
        "mem_waste_mb": (row[4] or 0) - (row[3] or 0),
    }


def optimization_report(days=7, namespace=None, labels=None):
    """Full optimization report."""
    summary = usage_summary(days, namespace)
    recs = pod_rightsizing(days, namespace, labels)
    under = underprovisioned(days, namespace)
    rollout = safe_rollout_plan(recs)

    total_savings = sum(r["total_savings_monthly"] for r in recs)

    return {
        "summary": summary,
        "total_monthly_savings_usd": total_savings,
        "overprovisioned_count": len(recs),
        "underprovisioned_count": len(under),
        "recommendations": recs[:20],
        "at_risk": under[:10],
        "rollout_plan": rollout,
        "methodology": {
            "request_formula": "P95 + 20% buffer",
            "limit_formula": "P99 + 50% headroom",
            "data_source": "hourly_pod_metrics (pre-aggregated)",
            "min_samples": MIN_SAMPLES,
            "max_reduction": f"{MAX_REDUCTION_PCT}%",
            "cache_ttl_hours": RECOMMENDATION_CACHE_TTL // 3600,
            "safety": [
                f"Min CPU request: {MIN_CPU_REQUEST_M}m",
                f"Min memory request: {MIN_MEM_REQUEST_MI}Mi",
                "High-restart pods: memory never reduced",
                "Volatile workloads: extra 30% buffer",
                f"Max single reduction: {MAX_REDUCTION_PCT}%",
            ],
        },
    }


# --- Helpers ---

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
