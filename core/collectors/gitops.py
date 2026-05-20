"""
GitOps Collector — detect ArgoCD/Flux installations,
list applications, sync status, and drift detection.
"""

import subprocess
import json

from core.context import context


def collect_gitops():
    """
    Detect GitOps tool and return application sync status.
    Supports ArgoCD and Flux.
    """
    ctx = context.current_context
    ns = context.namespace

    # Try ArgoCD first
    argocd = _detect_argocd(ctx)
    if argocd:
        apps = _list_argocd_apps(ctx, ns)
        return {
            "provider": "argocd",
            "namespace": argocd["namespace"],
            "version": argocd.get("version", ""),
            "apps": apps,
            "total": len(apps),
            "synced": sum(
                1 for a in apps if a["sync_status"] == "Synced"
            ),
            "out_of_sync": sum(
                1 for a in apps if a["sync_status"] == "OutOfSync"
            ),
            "degraded": sum(
                1 for a in apps if a["health"] == "Degraded"
            ),
        }

    # Try Flux
    flux = _detect_flux(ctx)
    if flux:
        apps = _list_flux_apps(ctx, ns)
        return {
            "provider": "flux",
            "namespace": flux["namespace"],
            "version": flux.get("version", ""),
            "apps": apps,
            "total": len(apps),
            "synced": sum(
                1 for a in apps if a["sync_status"] == "Ready"
            ),
            "out_of_sync": sum(
                1 for a in apps if a["sync_status"] != "Ready"
            ),
            "degraded": sum(
                1 for a in apps if a["health"] == "False"
            ),
        }

    return {"provider": None, "apps": []}


def gitops_app_detail(app_name):
    """Get detailed sync info for a specific app."""
    ctx = context.current_context

    argocd = _detect_argocd(ctx)
    if argocd:
        return _argocd_app_detail(ctx, app_name)

    flux = _detect_flux(ctx)
    if flux:
        return _flux_app_detail(ctx, app_name)

    return None


def _detect_argocd(ctx):
    """Check if ArgoCD is installed."""
    for ns in ("argocd", "argo-cd"):
        cmd = [
            "kubectl", "--context", str(ctx or ""),
            "get", "deployment", "argocd-server",
            "-n", ns, "-o", "json"
        ]
        r = subprocess.run(cmd, capture_output=True, text=True)
        if r.returncode == 0:
            data = json.loads(r.stdout)
            containers = (
                data.get("spec", {})
                .get("template", {})
                .get("spec", {})
                .get("containers", [])
            )
            version = ""
            if containers:
                img = containers[0].get("image", "")
                version = img.split(":")[-1] if ":" in img else ""
            return {"namespace": ns, "version": version}
    return None


def _detect_flux(ctx):
    """Check if Flux is installed."""
    for ns in ("flux-system", "flux"):
        cmd = [
            "kubectl", "--context", str(ctx or ""),
            "get", "deployment", "source-controller",
            "-n", ns, "-o", "json"
        ]
        r = subprocess.run(cmd, capture_output=True, text=True)
        if r.returncode == 0:
            data = json.loads(r.stdout)
            containers = (
                data.get("spec", {})
                .get("template", {})
                .get("spec", {})
                .get("containers", [])
            )
            version = ""
            if containers:
                img = containers[0].get("image", "")
                version = img.split(":")[-1] if ":" in img else ""
            return {"namespace": ns, "version": version}
    return None


def _list_argocd_apps(ctx, filter_ns=None):
    """List ArgoCD Application resources."""
    cmd = [
        "kubectl", "--context", str(ctx or ""),
        "get", "applications.argoproj.io",
        "--all-namespaces", "-o", "json"
    ]
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode != 0:
        return []

    data = json.loads(r.stdout)
    apps = []
    for item in data.get("items", []):
        meta = item.get("metadata", {})
        spec = item.get("spec", {})
        status = item.get("status", {})

        dest_ns = spec.get("destination", {}).get("namespace", "")
        if filter_ns and filter_ns != "default" and dest_ns != filter_ns:
            continue

        sync = status.get("sync", {})
        health = status.get("health", {})
        source = spec.get("source", {})

        apps.append({
            "name": meta.get("name", ""),
            "namespace": dest_ns,
            "sync_status": sync.get("status", "Unknown"),
            "health": health.get("status", "Unknown"),
            "revision": sync.get("revision", "")[:8],
            "repo": source.get("repoURL", ""),
            "path": source.get("path", ""),
            "target_revision": source.get(
                "targetRevision", "HEAD"
            ),
            "last_synced": (
                status.get("operationState", {})
                .get("finishedAt", "")
            ),
            "message": health.get("message", ""),
        })

    return apps


def _list_flux_apps(ctx, filter_ns=None):
    """List Flux Kustomization resources."""
    cmd = [
        "kubectl", "--context", str(ctx or ""),
        "get", "kustomizations.kustomize.toolkit.fluxcd.io",
        "--all-namespaces", "-o", "json"
    ]
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode != 0:
        return []

    data = json.loads(r.stdout)
    apps = []
    for item in data.get("items", []):
        meta = item.get("metadata", {})
        spec = item.get("spec", {})
        status = item.get("status", {})

        ns = meta.get("namespace", "")
        if filter_ns and filter_ns != "default" and ns != filter_ns:
            continue

        conditions = status.get("conditions", [])
        ready_cond = next(
            (c for c in conditions if c["type"] == "Ready"), {}
        )

        apps.append({
            "name": meta.get("name", ""),
            "namespace": ns,
            "sync_status": (
                "Ready" if ready_cond.get("status") == "True"
                else "NotReady"
            ),
            "health": ready_cond.get("status", "Unknown"),
            "revision": (
                status.get("lastAppliedRevision", "")[:8]
            ),
            "repo": spec.get("sourceRef", {}).get("name", ""),
            "path": spec.get("path", ""),
            "target_revision": "",
            "last_synced": ready_cond.get(
                "lastTransitionTime", ""
            ),
            "message": ready_cond.get("message", ""),
        })

    return apps


def _argocd_app_detail(ctx, app_name):
    """Get detailed ArgoCD app info including resource status."""
    cmd = [
        "kubectl", "--context", str(ctx or ""),
        "get", "applications.argoproj.io", app_name,
        "--all-namespaces", "-o", "json"
    ]
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode != 0:
        # Try with namespace
        cmd = [
            "kubectl", "--context", str(ctx or ""),
            "get", "applications.argoproj.io", app_name,
            "-n", "argocd", "-o", "json"
        ]
        r = subprocess.run(cmd, capture_output=True, text=True)
        if r.returncode != 0:
            return None

    item = json.loads(r.stdout)
    status = item.get("status", {})
    spec = item.get("spec", {})
    source = spec.get("source", {})
    sync = status.get("sync", {})
    health = status.get("health", {})
    op_state = status.get("operationState", {})

    resources = []
    for res in status.get("resources", []):
        resources.append({
            "kind": res.get("kind", ""),
            "name": res.get("name", ""),
            "namespace": res.get("namespace", ""),
            "status": res.get("status", ""),
            "health": res.get("health", {}).get("status", ""),
            "message": res.get("health", {}).get("message", ""),
        })

    return {
        "name": app_name,
        "provider": "argocd",
        "sync_status": sync.get("status", "Unknown"),
        "health": health.get("status", "Unknown"),
        "revision": sync.get("revision", ""),
        "repo": source.get("repoURL", ""),
        "path": source.get("path", ""),
        "target_revision": source.get("targetRevision", "HEAD"),
        "last_synced": op_state.get("finishedAt", ""),
        "sync_result": op_state.get("message", ""),
        "resources": resources,
        "conditions": status.get("conditions", []),
    }


def _flux_app_detail(ctx, app_name):
    """Get detailed Flux kustomization info."""
    cmd = [
        "kubectl", "--context", str(ctx or ""),
        "get", "kustomizations.kustomize.toolkit.fluxcd.io",
        app_name, "--all-namespaces", "-o", "json"
    ]
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode != 0:
        cmd = [
            "kubectl", "--context", str(ctx or ""),
            "get", "kustomizations.kustomize.toolkit.fluxcd.io",
            app_name, "-n", "flux-system", "-o", "json"
        ]
        r = subprocess.run(cmd, capture_output=True, text=True)
        if r.returncode != 0:
            return None

    item = json.loads(r.stdout)
    status = item.get("status", {})
    spec = item.get("spec", {})
    conditions = status.get("conditions", [])
    ready_cond = next(
        (c for c in conditions if c["type"] == "Ready"), {}
    )

    return {
        "name": app_name,
        "provider": "flux",
        "sync_status": (
            "Ready" if ready_cond.get("status") == "True"
            else "NotReady"
        ),
        "health": ready_cond.get("status", "Unknown"),
        "revision": status.get("lastAppliedRevision", ""),
        "repo": spec.get("sourceRef", {}).get("name", ""),
        "path": spec.get("path", ""),
        "target_revision": "",
        "last_synced": ready_cond.get(
            "lastTransitionTime", ""
        ),
        "sync_result": ready_cond.get("message", ""),
        "resources": [],
        "conditions": conditions,
    }
