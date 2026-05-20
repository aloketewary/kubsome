"""
Safe Rightsizing Applicator — dry-run validation, diff preview,
canary apply with health-gated rollback, and GitOps-ready output.

Flow:
  1. dry_run()     → validate patches against API server
  2. diff()        → show current vs recommended side-by-side
  3. apply_safe()  → apply one-at-a-time with health monitoring
  4. gitops_output() → generate branch-ready manifests
"""

import json
import subprocess
import time
import tempfile
from pathlib import Path
from datetime import datetime

from core.context import context
from core.analytics.rightsizing import (
    pod_rightsizing, safe_rollout_plan, export_yaml_patches
)

EXPORT_DIR = Path.home() / ".kubsome" / "rightsizing"


def dry_run(recommendations=None, days=7, namespace=None):
    """
    Validate patches via kubectl apply --dry-run=server.
    Returns per-deployment pass/fail with error messages.
    """
    if not recommendations:
        recommendations = pod_rightsizing(days, namespace)
    if not recommendations:
        return {"results": [], "passed": 0, "failed": 0}

    ctx = context.current_context
    results = []

    for rec in recommendations:
        patch_yaml = _build_patch_yaml(rec)
        tmp = _write_temp(patch_yaml)

        cmd = (
            f"kubectl --context {ctx} apply "
            f"--dry-run=server -f {tmp} 2>&1"
        )
        r = subprocess.run(
            cmd, shell=True, capture_output=True, text=True
        )

        results.append({
            "deployment": rec["deployment"],
            "namespace": rec["namespace"],
            "passed": r.returncode == 0,
            "message": r.stdout.strip() or r.stderr.strip(),
            "risk": rec["risk"],
            "confidence": rec["confidence"],
        })

        Path(tmp).unlink(missing_ok=True)

    passed = sum(1 for r in results if r["passed"])
    return {
        "results": results,
        "passed": passed,
        "failed": len(results) - passed,
        "total": len(results),
    }


def diff(recommendations=None, days=7, namespace=None):
    """
    Show current vs recommended resources for each deployment.
    Returns structured diff for UI rendering.
    """
    if not recommendations:
        recommendations = pod_rightsizing(days, namespace)
    if not recommendations:
        return []

    ctx = context.current_context
    ns = namespace or context.namespace
    diffs = []

    for rec in recommendations:
        deploy = rec["deployment"]
        rec_ns = rec["namespace"]

        # Get current resources from cluster
        cmd = (
            f"kubectl --context {ctx} get deployment {deploy} "
            f"-n {rec_ns} -o json 2>/dev/null"
        )
        r = subprocess.run(
            cmd, shell=True, capture_output=True, text=True
        )

        current = {"cpu_request": "?", "mem_request": "?",
                   "cpu_limit": "?", "mem_limit": "?"}
        if r.returncode == 0:
            data = json.loads(r.stdout)
            containers = (
                data.get("spec", {})
                .get("template", {})
                .get("spec", {})
                .get("containers", [])
            )
            if containers:
                res = containers[0].get("resources", {})
                req = res.get("requests", {})
                lim = res.get("limits", {})
                current = {
                    "cpu_request": req.get("cpu", "unset"),
                    "mem_request": req.get("memory", "unset"),
                    "cpu_limit": lim.get("cpu", "unset"),
                    "mem_limit": lim.get("memory", "unset"),
                }

        recommended = rec["recommended"]
        diffs.append({
            "deployment": deploy,
            "namespace": rec_ns,
            "risk": rec["risk"],
            "confidence": rec["confidence"],
            "savings_monthly": rec.get("total_savings_monthly", 0),
            "current": current,
            "recommended": {
                "cpu_request": f"{recommended['cpu_request']}m",
                "mem_request": f"{recommended['mem_request']}Mi",
                "cpu_limit": f"{recommended['cpu_limit']}m",
                "mem_limit": f"{recommended['mem_limit']}Mi",
            },
            "usage": rec.get("usage", {}),
        })

    return diffs


def apply_safe(recommendations=None, days=7, namespace=None,
               watch_seconds=300, rollback_on_failure=True):
    """
    Apply recommendations one-at-a-time with health monitoring.
    For each deployment:
      1. Record current state (for rollback)
      2. Apply patch
      3. Watch for watch_seconds
      4. If health degrades → rollback
      5. If healthy → proceed to next

    Returns results per deployment.
    """
    if not recommendations:
        recs = pod_rightsizing(days, namespace)
        plan = safe_rollout_plan(recs)
        # Only auto-apply phase 1 (safe)
        recommendations = plan["phase_1"]["items"]

    if not recommendations:
        return {"applied": [], "rolled_back": [], "skipped": []}

    ctx = context.current_context
    applied = []
    rolled_back = []
    skipped = []

    for rec in recommendations:
        deploy = rec["deployment"]
        ns = rec["namespace"]

        # 1. Dry-run first
        patch_yaml = _build_patch_yaml(rec)
        tmp = _write_temp(patch_yaml)
        dr = subprocess.run(
            f"kubectl --context {ctx} apply "
            f"--dry-run=server -f {tmp}",
            shell=True, capture_output=True, text=True
        )
        if dr.returncode != 0:
            skipped.append({
                "deployment": deploy,
                "reason": f"dry-run failed: {dr.stderr.strip()}",
            })
            Path(tmp).unlink(missing_ok=True)
            continue

        # 2. Snapshot current state
        snapshot = _snapshot_resources(ctx, deploy, ns)

        # 3. Apply
        apply_r = subprocess.run(
            f"kubectl --context {ctx} apply -f {tmp}",
            shell=True, capture_output=True, text=True
        )
        Path(tmp).unlink(missing_ok=True)

        if apply_r.returncode != 0:
            skipped.append({
                "deployment": deploy,
                "reason": f"apply failed: {apply_r.stderr.strip()}",
            })
            continue

        # 4. Watch health
        healthy = _watch_health(
            ctx, deploy, ns, watch_seconds
        )

        if healthy:
            applied.append({
                "deployment": deploy,
                "namespace": ns,
                "savings": rec.get("total_savings_monthly", 0),
                "applied_at": datetime.utcnow().isoformat(),
            })
        elif rollback_on_failure:
            # 5. Rollback
            _rollback(ctx, deploy, ns, snapshot)
            rolled_back.append({
                "deployment": deploy,
                "namespace": ns,
                "reason": "health degraded during watch period",
            })
        else:
            applied.append({
                "deployment": deploy,
                "namespace": ns,
                "warning": "health degraded but rollback disabled",
            })

    return {
        "applied": applied,
        "rolled_back": rolled_back,
        "skipped": skipped,
        "summary": {
            "total": len(recommendations),
            "applied": len(applied),
            "rolled_back": len(rolled_back),
            "skipped": len(skipped),
        },
    }


def gitops_output(recommendations=None, days=7, namespace=None,
                  output_dir=None, format="kustomize"):
    """
    Generate GitOps-ready output for PR/merge workflow.

    Formats:
      - kustomize: generates patches/ dir with kustomization.yaml
      - plain: individual YAML files per deployment
      - helm: values override file

    Returns path to output directory.
    """
    if not recommendations:
        recommendations = pod_rightsizing(days, namespace)
    if not recommendations:
        return None

    out = Path(output_dir) if output_dir else (
        EXPORT_DIR / f"gitops_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
    )
    out.mkdir(parents=True, exist_ok=True)

    if format == "kustomize":
        return _gitops_kustomize(recommendations, out)
    elif format == "helm":
        return _gitops_helm(recommendations, out)
    else:
        paths = export_yaml_patches(recommendations, str(out))
        return str(out)


def _gitops_kustomize(recommendations, out):
    """Generate kustomize patches with kustomization.yaml."""
    import yaml

    patches_dir = out / "patches"
    patches_dir.mkdir(exist_ok=True)

    patch_files = []
    for rec in recommendations:
        r = rec["recommended"]
        deploy = rec["deployment"]
        ns = rec["namespace"]

        patch = {
            "apiVersion": "apps/v1",
            "kind": "Deployment",
            "metadata": {"name": deploy, "namespace": ns},
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

        filename = f"{deploy}.yaml"
        (patches_dir / filename).write_text(
            yaml.dump(patch, default_flow_style=False)
        )
        patch_files.append(f"patches/{filename}")

    # Generate kustomization.yaml
    kustomization = {
        "apiVersion": "kustomize.config.k8s.io/v1beta1",
        "kind": "Kustomization",
        "patches": [
            {"path": f} for f in patch_files
        ],
    }
    (out / "kustomization.yaml").write_text(
        yaml.dump(kustomization, default_flow_style=False)
    )

    # Generate README with summary
    readme = _generate_readme(recommendations)
    (out / "README.md").write_text(readme)

    return str(out)


def _gitops_helm(recommendations, out):
    """Generate Helm values override."""
    import yaml

    values = {"resources": {}}
    for rec in recommendations:
        r = rec["recommended"]
        deploy = rec["deployment"]
        values["resources"][deploy] = {
            "requests": {
                "cpu": f"{r['cpu_request']}m",
                "memory": f"{r['mem_request']}Mi",
            },
            "limits": {
                "cpu": f"{r['cpu_limit']}m",
                "memory": f"{r['mem_limit']}Mi",
            },
        }

    (out / "values-rightsizing.yaml").write_text(
        yaml.dump(values, default_flow_style=False)
    )

    readme = _generate_readme(recommendations)
    (out / "README.md").write_text(readme)

    return str(out)


def _generate_readme(recommendations):
    """Generate PR description / README."""
    total_savings = sum(
        r.get("total_savings_monthly", 0) for r in recommendations
    )
    lines = [
        "# Right-Sizing Recommendations",
        "",
        f"Generated: {datetime.utcnow().strftime('%Y-%m-%d %H:%M UTC')}",
        f"Deployments: {len(recommendations)}",
        f"Estimated savings: ${total_savings:.2f}/month",
        "",
        "## Changes",
        "",
        "| Deployment | CPU req | Mem req | CPU lim | Mem lim | Risk | Confidence | Savings |",
        "|---|---|---|---|---|---|---|---|",
    ]

    for rec in recommendations:
        r = rec["recommended"]
        c = rec["current"]
        lines.append(
            f"| {rec['deployment']} "
            f"| {c.get('cpu_request', '?')}→{r['cpu_request']}m "
            f"| {c.get('mem_request', '?')}→{r['mem_request']}Mi "
            f"| {c.get('cpu_limit', '?')}→{r['cpu_limit']}m "
            f"| {c.get('mem_limit', '?')}→{r['mem_limit']}Mi "
            f"| {rec['risk']} "
            f"| {rec['confidence']}% "
            f"| ${rec.get('total_savings_monthly', 0):.2f} |"
        )

    lines.extend([
        "",
        "## Methodology",
        "- Requests: P95 usage + 20% buffer",
        "- Limits: P99 usage + 30% buffer",
        "- Minimum 12h of hourly data required",
        "- Confidence based on sample count and volatility",
        "",
        "## How to apply",
        "```bash",
        "# Kustomize",
        "kubectl apply -k .",
        "",
        "# Or dry-run first",
        "kubectl apply -k . --dry-run=server",
        "```",
    ])

    return "\n".join(lines)


# --- Internal helpers ---

def _build_patch_yaml(rec):
    """Build YAML patch string for a single recommendation."""
    import yaml
    r = rec["recommended"]
    patch = {
        "apiVersion": "apps/v1",
        "kind": "Deployment",
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
    }
    return yaml.dump(patch, default_flow_style=False)


def _write_temp(content):
    """Write content to a temp file, return path."""
    tmp = tempfile.NamedTemporaryFile(
        mode="w", suffix=".yaml", delete=False
    )
    tmp.write(content)
    tmp.close()
    return tmp.name


def _snapshot_resources(ctx, deploy, ns):
    """Capture current resource spec for rollback."""
    cmd = (
        f"kubectl --context {ctx} get deployment {deploy} "
        f"-n {ns} -o json"
    )
    r = subprocess.run(
        cmd, shell=True, capture_output=True, text=True
    )
    if r.returncode != 0:
        return None
    data = json.loads(r.stdout)
    containers = (
        data.get("spec", {})
        .get("template", {})
        .get("spec", {})
        .get("containers", [])
    )
    if not containers:
        return None
    return containers[0].get("resources", {})


def _rollback(ctx, deploy, ns, snapshot):
    """Rollback to previous resource spec."""
    if not snapshot:
        return
    import yaml
    patch = {
        "apiVersion": "apps/v1",
        "kind": "Deployment",
        "metadata": {"name": deploy, "namespace": ns},
        "spec": {
            "template": {
                "spec": {
                    "containers": [{
                        "name": deploy,
                        "resources": snapshot,
                    }],
                },
            },
        },
    }
    tmp = _write_temp(yaml.dump(patch, default_flow_style=False))
    subprocess.run(
        f"kubectl --context {ctx} apply -f {tmp}",
        shell=True, capture_output=True, text=True
    )
    Path(tmp).unlink(missing_ok=True)


def _watch_health(ctx, deploy, ns, seconds):
    """
    Watch deployment health for N seconds.
    Returns True if healthy throughout, False if degraded.
    Checks every 15 seconds.
    """
    interval = 15
    checks = max(seconds // interval, 1)

    for i in range(checks):
        time.sleep(interval)
        cmd = (
            f"kubectl --context {ctx} get deployment {deploy} "
            f"-n {ns} -o json 2>/dev/null"
        )
        r = subprocess.run(
            cmd, shell=True, capture_output=True, text=True
        )
        if r.returncode != 0:
            return False

        data = json.loads(r.stdout)
        status = data.get("status", {})
        desired = data.get("spec", {}).get("replicas", 1)
        available = status.get("availableReplicas", 0)
        unavailable = status.get("unavailableReplicas", 0)

        # Check for crash loops
        if unavailable > 0 and i > 1:
            return False

        # Check conditions for deadline exceeded
        for cond in status.get("conditions", []):
            if (cond.get("reason") == "ProgressDeadlineExceeded"):
                return False

        # After initial rollout (first 2 checks), require full availability
        if i > 1 and available < desired:
            return False

    return True
