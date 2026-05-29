"""
Blast Radius Analysis — maps all resources affected if a
given deployment/pod is restarted, scaled, or deleted.

Answers: "If I touch this, what breaks?"

Checks:
  - Services routing to this deployment
  - Ingress rules pointing to the service
  - HPA targeting this deployment
  - PDB protecting these pods
  - ConfigMaps/Secrets mounted by this deployment
  - Other deployments consuming the same ConfigMaps
  - Downstream services (env var references)
  - Pod Disruption Budget violations
"""

import json
import subprocess
from core.context import context


def analyze_blast_radius(target, action="restart"):
    """
    Analyze blast radius for a deployment.

    Args:
        target: deployment name
        action: restart, delete, scale-down

    Returns dict with affected resources, risk score, warnings.
    """
    ctx = context.current_context
    ns = context.namespace

    # Get the deployment
    dep = _get_deployment(ctx, ns, target)
    if not dep:
        return {"error": f"Deployment '{target}' not found in {ns}"}

    # Gather all connections
    services = _find_services(ctx, ns, dep)
    ingresses = _find_ingresses(ctx, ns, services)
    hpa = _find_hpa(ctx, ns, target)
    pdb = _find_pdb(ctx, ns, dep)
    configmaps = _find_configmaps(dep)
    secrets = _find_secrets(dep)
    co_dependents = _find_co_dependents(ctx, ns, configmaps, target)
    downstream = _find_downstream_refs(ctx, ns, target)
    pod_count = (
        dep.get("spec", {}).get("replicas")
        or dep.get("status", {}).get("replicas")
        or 1
    )

    # Build impact list
    affected = []

    for svc in services:
        affected.append({
            "type": "Service",
            "name": svc["name"],
            "impact": "Traffic will be disrupted",
            "severity": "high",
        })

    for ing in ingresses:
        affected.append({
            "type": "Ingress",
            "name": ing["name"],
            "impact": f"External traffic via {ing.get('host', '*')} affected",
            "severity": "critical",
        })

    if hpa:
        affected.append({
            "type": "HPA",
            "name": hpa["name"],
            "impact": "Autoscaler will react to disruption",
            "severity": "low",
        })

    if pdb:
        max_unavailable = pdb.get("max_unavailable", 1)
        affected.append({
            "type": "PDB",
            "name": pdb["name"],
            "impact": f"Max {max_unavailable} unavailable allowed",
            "severity": (
                "critical" if action == "delete"
                else "medium"
            ),
        })

    for cm in configmaps:
        affected.append({
            "type": "ConfigMap",
            "name": cm,
            "impact": "Mounted by this deployment",
            "severity": "info",
        })

    for s in secrets:
        affected.append({
            "type": "Secret",
            "name": s,
            "impact": "Mounted by this deployment",
            "severity": "info",
        })

    for dep_name in co_dependents:
        affected.append({
            "type": "Co-dependent",
            "name": dep_name,
            "impact": "Shares ConfigMap — may need coordinated restart",
            "severity": "medium",
        })

    for ds in downstream:
        affected.append({
            "type": "Downstream",
            "name": ds["name"],
            "impact": f"References this service via env:{ds['via']}",
            "severity": "high",
        })

    # Risk score (1-10)
    risk_score = _calculate_risk(
        affected, action, pod_count, pdb, services, ingresses
    )

    # Warnings
    warnings = _generate_warnings(
        action, risk_score, pdb, pod_count, ingresses, services
    )

    return {
        "target": target,
        "namespace": ns,
        "action": action,
        "pod_count": pod_count,
        "risk_score": risk_score,
        "risk_level": (
            "critical" if risk_score >= 8
            else "high" if risk_score >= 6
            else "medium" if risk_score >= 4
            else "low"
        ),
        "affected_count": len(affected),
        "affected": affected,
        "warnings": warnings,
        "safe_to_proceed": risk_score < 6,
        "recommendation": _recommend(action, risk_score, pdb, pod_count),
    }


def _calculate_risk(affected, action, pod_count, pdb, services, ingresses):
    """Calculate risk score 1-10."""
    score = 1

    # Action severity
    if action == "delete":
        score += 3
    elif action == "restart":
        score += 1
    elif action == "scale-down":
        score += 2

    # External exposure
    if ingresses:
        score += 2
    if services:
        score += 1

    # PDB violation risk
    if pdb and action == "delete":
        score += 2
    elif pdb and pod_count <= (pdb.get("min_available", 0)):
        score += 2

    # Single replica = no redundancy
    if pod_count <= 1:
        score += 2

    # Co-dependents
    co_deps = sum(1 for a in affected if a["type"] == "Co-dependent")
    if co_deps > 0:
        score += 1

    # Downstream services
    downstream = sum(1 for a in affected if a["type"] == "Downstream")
    if downstream > 2:
        score += 1

    return min(10, score)


def _generate_warnings(action, risk, pdb, pod_count, ingresses, services):
    """Generate human-readable warnings."""
    warnings = []

    if pod_count <= 1 and action in ("restart", "delete"):
        warnings.append(
            "⚠ Single replica — restart will cause downtime"
        )

    if ingresses and action != "scale-down":
        hosts = [i.get("host", "*") for i in ingresses]
        warnings.append(
            f"⚠ External traffic affected: {', '.join(hosts)}"
        )

    if pdb and action == "delete":
        warnings.append(
            f"⚠ PDB '{pdb['name']}' may be violated"
        )

    if risk >= 8:
        warnings.append(
            "🛑 HIGH RISK — consider off-peak hours or canary approach"
        )

    return warnings


def _recommend(action, risk, pdb, pod_count):
    """Generate recommendation based on analysis."""
    if risk <= 3:
        return "Safe to proceed"

    recs = []
    if pod_count <= 1:
        recs.append("Scale to 2+ replicas before restart")
    if risk >= 6:
        recs.append("Perform during maintenance window")
    if action == "delete" and pdb:
        recs.append("Use rolling restart instead of delete")
    if risk >= 8:
        recs.append("Test in non-prod first")

    return "; ".join(recs) if recs else "Proceed with caution"


# --- kubectl helpers ---

def _get_deployment(ctx, ns, name):
    cmd = [
        "kubectl", "--context", str(ctx or ""),
        "get", "deployment", name,
        "-n", str(ns), "-o", "json"
    ]
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode != 0:
        return None
    return json.loads(r.stdout)


def _find_services(ctx, ns, dep):
    """Find services that select this deployment's pods."""
    dep_labels = (
        dep.get("spec", {}).get("selector", {})
        .get("matchLabels", {})
    )
    if not dep_labels:
        return []

    cmd = [
        "kubectl", "--context", str(ctx or ""),
        "get", "services", "-n", str(ns), "-o", "json"
    ]
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode != 0:
        return []

    data = json.loads(r.stdout)
    matches = []
    for svc in data.get("items", []):
        selector = svc["spec"].get("selector", {})
        if selector and all(
            dep_labels.get(k) == v for k, v in selector.items()
        ):
            ports = [
                f"{p['port']}/{p.get('protocol', 'TCP')}"
                for p in svc["spec"].get("ports", [])
            ]
            matches.append({
                "name": svc["metadata"]["name"],
                "type": svc["spec"].get("type", "ClusterIP"),
                "ports": ports,
            })

    return matches


def _find_ingresses(ctx, ns, services):
    """Find ingresses routing to these services."""
    if not services:
        return []

    svc_names = {s["name"] for s in services}

    cmd = [
        "kubectl", "--context", str(ctx or ""),
        "get", "ingress", "-n", str(ns), "-o", "json"
    ]
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode != 0:
        return []

    data = json.loads(r.stdout)
    matches = []
    for ing in data.get("items", []):
        for rule in ing["spec"].get("rules", []):
            for path in rule.get("http", {}).get("paths", []):
                backend_svc = (
                    path.get("backend", {})
                    .get("service", {})
                    .get("name", "")
                )
                if backend_svc in svc_names:
                    matches.append({
                        "name": ing["metadata"]["name"],
                        "host": rule.get("host", "*"),
                        "path": path.get("path", "/"),
                    })

    return matches


def _find_hpa(ctx, ns, deployment_name):
    """Find HPA targeting this deployment."""
    cmd = [
        "kubectl", "--context", str(ctx or ""),
        "get", "hpa", "-n", str(ns), "-o", "json"
    ]
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode != 0:
        return None

    data = json.loads(r.stdout)
    for item in data.get("items", []):
        ref = item["spec"].get("scaleTargetRef", {})
        if ref.get("name") == deployment_name:
            return {
                "name": item["metadata"]["name"],
                "min": item["spec"].get("minReplicas", 1),
                "max": item["spec"].get("maxReplicas", 1),
            }
    return None


def _find_pdb(ctx, ns, dep):
    """Find PDB protecting this deployment's pods."""
    dep_labels = (
        dep.get("spec", {}).get("selector", {})
        .get("matchLabels", {})
    )

    cmd = [
        "kubectl", "--context", str(ctx or ""),
        "get", "pdb", "-n", str(ns), "-o", "json"
    ]
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode != 0:
        return None

    data = json.loads(r.stdout)
    for item in data.get("items", []):
        selector = (
            item["spec"].get("selector", {})
            .get("matchLabels", {})
        )
        if selector and all(
            dep_labels.get(k) == v for k, v in selector.items()
        ):
            return {
                "name": item["metadata"]["name"],
                "min_available": item["spec"].get("minAvailable"),
                "max_unavailable": item["spec"].get("maxUnavailable"),
            }
    return None


def _find_configmaps(dep):
    """Find ConfigMaps mounted by this deployment."""
    volumes = (
        dep.get("spec", {}).get("template", {})
        .get("spec", {})
        .get("volumes", [])
    ) or []
    cms = []
    for v in volumes:
        if "configMap" in v:
            cms.append(v["configMap"].get("name", ""))
    # Also check envFrom
    containers = (
        dep.get("spec", {}).get("template", {})
        .get("spec", {})
        .get("containers", [])
    ) or []
    for c in containers:
        for ef in c.get("envFrom", []) or []:
            if "configMapRef" in ef:
                cms.append(ef["configMapRef"].get("name", ""))
    return list(set(filter(None, cms)))


def _find_secrets(dep):
    """Find Secrets mounted by this deployment."""
    volumes = (
        dep.get("spec", {}).get("template", {})
        .get("spec", {})
        .get("volumes", [])
    ) or []
    secrets = []
    for v in volumes:
        if "secret" in v:
            secrets.append(v["secret"].get("secretName", ""))
    return list(set(filter(None, secrets)))


def _find_co_dependents(ctx, ns, configmaps, exclude):
    """Find other deployments using the same ConfigMaps."""
    if not configmaps:
        return []

    cmd = [
        "kubectl", "--context", str(ctx or ""),
        "get", "deployments", "-n", str(ns), "-o", "json"
    ]
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode != 0:
        return []

    data = json.loads(r.stdout)
    co_deps = set()

    for item in data.get("items", []):
        name = item["metadata"]["name"]
        if name == exclude:
            continue

        volumes = (
            item.get("spec", {}).get("template", {})
            .get("spec", {})
            .get("volumes", [])
        ) or []
        for v in volumes:
            if "configMap" in v and v["configMap"].get("name") in configmaps:
                co_deps.add(name)

    return list(co_deps)


def _find_downstream_refs(ctx, ns, target):
    """Find deployments that reference this service in env vars."""
    cmd = [
        "kubectl", "--context", str(ctx or ""),
        "get", "deployments", "-n", str(ns), "-o", "json"
    ]
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode != 0:
        return []

    data = json.loads(r.stdout)
    downstream = []

    for item in data.get("items", []):
        name = item["metadata"]["name"]
        if name == target:
            continue

        containers = (
            item.get("spec", {}).get("template", {})
            .get("spec", {})
            .get("containers", [])
        ) or []
        for c in containers:
            for env in c.get("env", []):
                val = env.get("value", "")
                if target in val:
                    downstream.append({
                        "name": name,
                        "via": env.get("name", ""),
                    })
                    break

    return downstream
