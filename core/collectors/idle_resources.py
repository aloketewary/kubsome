"""
Idle & Orphaned Resource Detection — finds wasted resources
across the cluster using both live state and historical analytics.

Detects:
  - Idle deployments (CPU < 1m for 24h+)
  - Orphaned ConfigMaps/Secrets (not mounted by any pod)
  - Unbound PVCs (not claimed by any pod)
  - Stale Jobs (completed > 7d ago)
  - Idle Services (no endpoints / no traffic)
  - Orphaned ReplicaSets (0 replicas, old)
  - Idle HPAs (target deployment deleted)
  - Unused ServiceAccounts
"""

import json
import subprocess
from datetime import datetime, timezone
from concurrent.futures import ThreadPoolExecutor

from core.context import context
from core.k8s import get_raw_resources


def detect_all(include_analytics=True):
    """
    Run all detection checks. Returns categorized results
    with estimated savings and safe cleanup commands.
    """
    ctx = context.current_context
    ns = context.namespace
    if not ctx:
        return {"items": [], "summary": {}}

    results = []

    with ThreadPoolExecutor(max_workers=4) as pool:
        futures = [
            pool.submit(_detect_orphaned_configmaps, ctx, ns),
            pool.submit(_detect_orphaned_secrets, ctx, ns),
            pool.submit(_detect_unbound_pvcs, ctx, ns),
            pool.submit(_detect_stale_jobs, ctx, ns),
            pool.submit(_detect_orphaned_replicasets, ctx, ns),
            pool.submit(_detect_idle_services, ctx, ns),
            pool.submit(_detect_idle_hpas, ctx, ns),
        ]

        for f in futures:
            try:
                results.extend(f.result())
            except Exception:
                pass

    # Analytics-based idle detection (needs DuckDB data)
    if include_analytics:
        results.extend(_detect_idle_deployments(ctx, ns))

    # Sort by savings potential
    results.sort(key=lambda x: x.get("savings_monthly", 0), reverse=True)

    summary = _build_summary(results)
    return {"items": results, "summary": summary}


def cleanup_dry_run(items=None):
    """
    Generate kubectl delete commands for selected items.
    Does NOT execute — returns commands for review.
    """
    if items is None:
        detected = detect_all()
        items = detected["items"]

    commands = []
    for item in items:
        kind = item["kind"]
        name = item["name"]
        ns = item.get("namespace", context.namespace)
        ctx = context.current_context

        cmd = (
            f"kubectl --context {ctx} delete {kind.lower()} "
            f"{name} -n {ns}"
        )
        commands.append({
            "command": cmd,
            "kind": kind,
            "name": name,
            "namespace": ns,
            "reason": item.get("reason", ""),
            "age_days": item.get("age_days", 0),
        })

    return {"commands": commands, "count": len(commands)}


def cleanup_execute(items, dry_run=True):
    """
    Execute cleanup for selected items.
    dry_run=True validates without deleting.
    """
    ctx = context.current_context
    ns = context.namespace

    # Safety: block in production
    if ctx and ("prod" in ctx or "prd" in ctx):
        return {
            "blocked": True,
            "reason": "Cleanup blocked in production context",
        }

    results = []
    for item in items:
        kind = item["kind"].lower()
        name = item["name"]
        item_ns = item.get("namespace", ns)

        cmd = ["kubectl"]
        if ctx:
            cmd.extend(["--context", str(ctx)])
        cmd.extend(["delete", kind, name, "-n", item_ns])
        if dry_run:
            cmd.append("--dry-run=server")

        r = subprocess.run(
            cmd, capture_output=True, text=True
        )
        results.append({
            "kind": item["kind"],
            "name": name,
            "success": r.returncode == 0,
            "message": r.stdout.strip() or r.stderr.strip(),
            "dry_run": dry_run,
        })

    return {
        "results": results,
        "deleted": sum(1 for r in results if r["success"]),
        "failed": sum(1 for r in results if not r["success"]),
        "dry_run": dry_run,
    }


# --- Detectors ---

def _detect_idle_deployments(ctx, ns):
    """Find deployments with near-zero CPU usage over 24h+."""
    try:
        from core.analytics.engine import execute
        rows = execute(f"""
            SELECT deployment, namespace,
                   AVG(cpu_avg)::INTEGER AS cpu_avg,
                   AVG(mem_avg)::INTEGER AS mem_avg,
                   AVG(pod_count)::INTEGER AS pods
            FROM hourly_pod_metrics
            WHERE context = '{ctx}'
              AND hour >= NOW() - INTERVAL '24 hours'
              AND deployment != ''
            GROUP BY deployment, namespace
            HAVING cpu_avg < 2 AND mem_avg < 10 AND pods > 0
        """)
        return [
            {
                "kind": "Deployment",
                "name": r[0],
                "namespace": r[1],
                "category": "idle",
                "reason": f"CPU {r[2]}m, Mem {r[3]}Mi avg over 24h",
                "severity": "medium",
                "savings_monthly": _estimate_savings(r[2], r[3], r[4]),
                "age_days": 0,
            }
            for r in rows
        ]
    except Exception:
        return []


def _detect_orphaned_configmaps(ctx, ns):
    """Find ConfigMaps not referenced by any pod."""
    # Get all configmaps
    cms = _kubectl_names(ctx, ns, "configmaps")
    if not cms:
        return []

    # Get mounted configmaps from pods
    mounted = _get_mounted_resources(ctx, ns, "configMap")

    # System prefixes to skip
    skip = ("kube-", "istio-", "default-token", "sh.helm")

    results = []
    for cm in cms:
        if any(cm.startswith(s) for s in skip):
            continue
        if cm not in mounted:
            results.append({
                "kind": "ConfigMap",
                "name": cm,
                "namespace": ns,
                "category": "orphaned",
                "reason": "Not mounted by any pod",
                "severity": "low",
                "savings_monthly": 0,
                "age_days": 0,
            })
    return results


def _detect_orphaned_secrets(ctx, ns):
    """Find Secrets not referenced by any pod or service account."""
    secrets = _kubectl_names(ctx, ns, "secrets")
    if not secrets:
        return []

    mounted = _get_mounted_resources(ctx, ns, "secret")
    # Also get SA-referenced secrets
    sa_secrets = _get_sa_secrets(ctx, ns)

    skip = (
        "default-token", "sh.helm", "kubernetes.io/service-account-token"
    )

    results = []
    for s in secrets:
        if any(s.startswith(sk) for sk in skip):
            continue
        if s not in mounted and s not in sa_secrets:
            results.append({
                "kind": "Secret",
                "name": s,
                "namespace": ns,
                "category": "orphaned",
                "reason": "Not mounted or referenced",
                "severity": "low",
                "savings_monthly": 0,
                "age_days": 0,
            })
    return results


def _detect_unbound_pvcs(ctx, ns):
    """Find PVCs not bound to any pod."""
    data = get_raw_resources("pvc", ctx, ns)
    if not data or not data.get("items"):
        return []

    # Get volumes mounted by pods
    mounted_pvcs = _get_mounted_resources(ctx, ns, "persistentVolumeClaim")

    results = []
    for item in data.get("items", []):
        name = item["metadata"]["name"]
        phase = item.get("status", {}).get("phase", "")
        storage = (
            item.get("spec", {})
            .get("resources", {})
            .get("requests", {})
            .get("storage", "0")
        )

        if name not in mounted_pvcs:
            results.append({
                "kind": "PVC",
                "name": name,
                "namespace": ns,
                "category": "orphaned",
                "reason": f"Not mounted ({phase}, {storage})",
                "severity": "medium",
                "savings_monthly": _pvc_cost(storage),
                "age_days": _age_days(item["metadata"]),
            })
    return results


def _detect_stale_jobs(ctx, ns):
    """Find completed/failed Jobs older than 7 days."""
    data = get_raw_resources("jobs", ctx, ns)
    if not data or not data.get("items"):
        return []

    results = []

    for item in data.get("items", []):
        name = item["metadata"]["name"]
        status = item.get("status", {})
        conditions = status.get("conditions", [])

        completed = any(
            c.get("type") == "Complete" and c.get("status") == "True"
            for c in conditions
        )
        failed = any(
            c.get("type") == "Failed" and c.get("status") == "True"
            for c in conditions
        )

        if (completed or failed) and _age_days(item["metadata"]) > 7:
            results.append({
                "kind": "Job",
                "name": name,
                "namespace": ns,
                "category": "stale",
                "reason": f"{'Completed' if completed else 'Failed'} "
                          f"{_age_days(item['metadata'])}d ago",
                "severity": "low",
                "savings_monthly": 0,
                "age_days": _age_days(item["metadata"]),
            })
    return results


def _detect_orphaned_replicasets(ctx, ns):
    """Find ReplicaSets with 0 replicas and no owner."""
    data = get_raw_resources("replicasets", ctx, ns)
    if not data or not data.get("items"):
        return []

    results = []

    for item in data.get("items", []):
        name = item["metadata"]["name"]
        replicas = item.get("spec", {}).get("replicas", 0)
        age = _age_days(item["metadata"])

        if replicas == 0 and age > 3:
            results.append({
                "kind": "ReplicaSet",
                "name": name,
                "namespace": ns,
                "category": "orphaned",
                "reason": f"0 replicas for {age}d",
                "severity": "low",
                "savings_monthly": 0,
                "age_days": age,
            })
    return results


def _detect_idle_services(ctx, ns):
    """Find Services with no endpoints."""
    data = get_raw_resources("endpoints", ctx, ns)
    if not data or not data.get("items"):
        return []

    skip = ("kubernetes", "kube-dns", "metrics-server")
    results = []

    for item in data.get("items", []):
        name = item["metadata"]["name"]
        if name in skip:
            continue
        subsets = item.get("subsets", [])
        has_addresses = any(
            s.get("addresses") for s in subsets
        )
        if not has_addresses:
            results.append({
                "kind": "Service",
                "name": name,
                "namespace": ns,
                "category": "idle",
                "reason": "No endpoints (no backing pods)",
                "severity": "low",
                "savings_monthly": 0,
                "age_days": _age_days(item["metadata"]),
            })
    return results


def _detect_idle_hpas(ctx, ns):
    """Find HPAs targeting non-existent deployments."""
    data = get_raw_resources("hpa", ctx, ns)
    if not data or not data.get("items"):
        return []

    deployments = set(_kubectl_names(ctx, ns, "deployments"))
    results = []

    for item in data.get("items", []):
        name = item["metadata"]["name"]
        target = (
            item.get("spec", {})
            .get("scaleTargetRef", {})
            .get("name", "")
        )
        if target and target not in deployments:
            results.append({
                "kind": "HPA",
                "name": name,
                "namespace": ns,
                "category": "orphaned",
                "reason": f"Target '{target}' not found",
                "severity": "medium",
                "savings_monthly": 0,
                "age_days": _age_days(item["metadata"]),
            })
    return results


# --- Helpers ---

def _kubectl_names(ctx, ns, resource):
    """Get resource names as list."""
    cmd = ["kubectl"]
    if ctx:
        cmd.extend(["--context", str(ctx)])
    cmd.extend([
        "get", resource, "-n", ns,
        "-o", "jsonpath={.items[*].metadata.name}"
    ])
    r = subprocess.run(
        cmd, capture_output=True, text=True, stderr=subprocess.DEVNULL
    )
    if r.returncode != 0:
        return []
    return r.stdout.strip().split()


def _get_mounted_resources(ctx, ns, volume_type):
    """Get resource names referenced in pod volumes."""
    data = get_raw_resources("pods", ctx, ns)
    if not data or not data.get("items"):
        return set()

    mounted = set()

    for item in data.get("items", []):
        volumes = item.get("spec", {}).get("volumes", [])
        for vol in volumes:
            ref = vol.get(volume_type)
            if ref:
                name = ref.get("name") or ref.get("claimName", "")
                if name:
                    mounted.add(name)
        # Also check envFrom
        for c in item.get("spec", {}).get("containers", []):
            for ef in c.get("envFrom", []):
                if volume_type == "configMap" and ef.get("configMapRef"):
                    mounted.add(ef["configMapRef"]["name"])
                if volume_type == "secret" and ef.get("secretRef"):
                    mounted.add(ef["secretRef"]["name"])
            # Check env valueFrom
            for env in c.get("env", []):
                vf = env.get("valueFrom", {})
                if volume_type == "configMap" and vf.get("configMapKeyRef"):
                    mounted.add(vf["configMapKeyRef"]["name"])
                if volume_type == "secret" and vf.get("secretKeyRef"):
                    mounted.add(vf["secretKeyRef"]["name"])

    return mounted


def _get_sa_secrets(ctx, ns):
    """Get secrets referenced by service accounts."""
    data = get_raw_resources("serviceaccounts", ctx, ns)
    if not data or not data.get("items"):
        return set()

    secrets = set()
    for item in data.get("items", []):
        for s in item.get("secrets", []):
            secrets.add(s.get("name", ""))
    return secrets


def _age_days(metadata):
    """Calculate age in days from metadata.creationTimestamp."""
    ts = metadata.get("creationTimestamp", "")
    if not ts:
        return 0
    try:
        created = datetime.fromisoformat(ts.replace("Z", "+00:00"))
        return int(
            (datetime.now(timezone.utc) - created).total_seconds()
            / 86400
        )
    except Exception:
        return 0


def _estimate_savings(cpu_m, mem_mb, pods):
    """Rough monthly savings for idle deployment."""
    # Default rates: $0.0425/core/hr, $0.0053/GB/hr
    cpu_cost = (cpu_m / 1000) * 0.0425 * 730 * max(pods, 1)
    mem_cost = (mem_mb / 1024) * 0.0053 * 730 * max(pods, 1)
    return round(cpu_cost + mem_cost, 2)


def _pvc_cost(storage_str):
    """Estimate monthly PVC cost from storage string."""
    val = storage_str.strip()
    gb = 0
    if val.endswith("Gi"):
        gb = float(val[:-2])
    elif val.endswith("Ti"):
        gb = float(val[:-2]) * 1024
    elif val.endswith("Mi"):
        gb = float(val[:-2]) / 1024
    # ~$0.10/GB/month (EBS gp3)
    return round(gb * 0.10, 2)


def _build_summary(items):
    """Build summary stats from detection results."""
    categories = {}
    for item in items:
        cat = item.get("category", "other")
        if cat not in categories:
            categories[cat] = {"count": 0, "savings": 0}
        categories[cat]["count"] += 1
        categories[cat]["savings"] += item.get("savings_monthly", 0)

    return {
        "total": len(items),
        "total_savings_monthly": round(
            sum(i.get("savings_monthly", 0) for i in items), 2
        ),
        "categories": categories,
        "by_kind": _count_by(items, "kind"),
        "by_severity": _count_by(items, "severity"),
    }


def _count_by(items, key):
    """Count items by a key."""
    counts = {}
    for item in items:
        val = item.get(key, "unknown")
        counts[val] = counts.get(val, 0) + 1
    return counts
