"""
Connect — integration discovery, testing, and configuration.
One-command setup for external services.
"""

import subprocess
import json

from pathlib import Path
from core.context import context
from core.config import load_config, save_config, CONFIG_PATH


INTEGRATIONS = {
    "slack": {
        "name": "Slack",
        "icon": "💬",
        "type": "webhook",
        "description": "Send alerts and incident reports to Slack",
        "config_key": "slack_webhook",
        "test_message": "🚀 Kubsome connected to Slack!",
    },
    "teams": {
        "name": "Microsoft Teams",
        "icon": "💼",
        "type": "webhook",
        "description": "Send alerts and incident reports to Teams",
        "config_key": "teams_webhook",
        "test_message": "🚀 Kubsome connected to Teams!",
    },
    "prometheus": {
        "name": "Prometheus",
        "icon": "📊",
        "type": "url",
        "description": "Query metrics for time-series graphs and alerts",
        "config_key": "prometheus_url",
        "default_port": 9090,
    },
    "argocd": {
        "name": "ArgoCD",
        "icon": "🔄",
        "type": "auto",
        "description": "GitOps sync status and drift detection",
        "config_key": "argocd",
    },
    "flux": {
        "name": "Flux",
        "icon": "🔄",
        "type": "auto",
        "description": "GitOps sync status via Flux controllers",
        "config_key": "flux",
    },
    "ollama": {
        "name": "Ollama (LLM)",
        "icon": "🧠",
        "type": "url",
        "description": "Local LLM for AI-powered analysis",
        "config_key": "llm",
        "default_port": 11434,
    },
}


def list_integrations():
    """List all integrations with connection status."""
    config = load_config()
    results = []

    for key, info in INTEGRATIONS.items():
        status = _check_status(key, config)
        results.append({
            "id": key,
            "name": info["name"],
            "icon": info["icon"],
            "description": info["description"],
            "type": info["type"],
            "status": status["status"],
            "detail": status.get("detail", ""),
        })

    return results


def connect_integration(name, url=None):
    """
    Connect an integration. Auto-discovers if possible,
    otherwise uses provided URL.
    Returns {success, message, detail}.
    """
    if name not in INTEGRATIONS:
        available = ", ".join(INTEGRATIONS.keys())
        return {
            "success": False,
            "message": f"Unknown integration: {name}",
            "detail": f"Available: {available}",
        }

    info = INTEGRATIONS[name]
    itype = info["type"]

    if itype == "webhook":
        return _connect_webhook(name, info, url)
    elif itype == "url":
        return _connect_url(name, info, url)
    elif itype == "auto":
        return _connect_auto(name, info)

    return {"success": False, "message": "Unknown type"}


def disconnect_integration(name):
    """Remove an integration from config."""
    if name not in INTEGRATIONS:
        return {
            "success": False,
            "message": f"Unknown integration: {name}",
        }

    config = load_config()
    info = INTEGRATIONS[name]
    key = info["config_key"]

    removed = False
    if key in config:
        del config[key]
        removed = True

    # Also check integrations dict
    integrations = config.get("integrations", {})
    if name in integrations:
        del integrations[name]
        config["integrations"] = integrations
        removed = True

    # Remove from webhooks list
    if info["type"] == "webhook":
        webhooks = config.get("webhooks", [])
        config["webhooks"] = [
            w for w in webhooks
            if w.get("type") != name
        ]
        removed = True

    if removed:
        save_config(config)
        return {
            "success": True,
            "message": f"Disconnected {info['name']}",
        }

    return {
        "success": False,
        "message": f"{info['name']} was not connected",
    }


def test_integration(name):
    """Test an existing integration connection."""
    config = load_config()
    status = _check_status(name, config)
    return status


def auto_discover():
    """
    Auto-discover all available integrations in the cluster.
    Returns list of discovered services.
    """
    discovered = []
    ctx = context.current_context

    # Prometheus
    prom = _discover_prometheus(ctx)
    if prom:
        discovered.append({
            "id": "prometheus",
            "name": "Prometheus",
            "url": prom,
            "source": "in-cluster",
        })

    # ArgoCD
    if _detect_argocd(ctx):
        discovered.append({
            "id": "argocd",
            "name": "ArgoCD",
            "url": "",
            "source": "namespace detected",
        })

    # Flux
    if _detect_flux(ctx):
        discovered.append({
            "id": "flux",
            "name": "Flux",
            "url": "",
            "source": "namespace detected",
        })

    # Ollama (local)
    if _check_ollama():
        discovered.append({
            "id": "ollama",
            "name": "Ollama",
            "url": "http://localhost:11434",
            "source": "localhost",
        })

    return discovered


def connect_discovered(discoveries):
    """Connect all auto-discovered integrations."""
    results = []
    for d in discoveries:
        result = connect_integration(d["id"], d.get("url"))
        results.append({
            "id": d["id"],
            "name": d["name"],
            **result,
        })
    return results


# --- Private helpers ---

def _connect_webhook(name, info, url):
    """Connect a webhook integration."""
    if not url:
        return {
            "success": False,
            "message": f"URL required for {info['name']}",
            "detail": f"Usage: connect {name} <webhook-url>",
            "needs_input": True,
            "input_label": "Webhook URL",
        }

    # Validate URL format
    if not url.startswith("http"):
        return {
            "success": False,
            "message": "Invalid URL (must start with http/https)",
        }

    # Test webhook
    test_ok = _test_webhook(name, url, info.get("test_message", ""))
    if not test_ok:
        return {
            "success": False,
            "message": f"Could not reach {info['name']} webhook",
            "detail": "Check the URL and try again",
        }

    # Save to config
    config = load_config()
    config[info["config_key"]] = url

    # Also add to webhooks list for notification system
    webhooks = config.get("webhooks", [])
    # Remove existing of same type
    webhooks = [w for w in webhooks if w.get("type") != name]
    webhooks.append({"type": name, "url": url})
    config["webhooks"] = webhooks

    # Track in integrations
    integrations = config.get("integrations", {})
    integrations[name] = {"url": url, "status": "connected"}
    config["integrations"] = integrations

    save_config(config)

    return {
        "success": True,
        "message": f"Connected to {info['name']}",
        "detail": "Test message sent successfully",
    }


def _connect_url(name, info, url):
    """Connect a URL-based integration (Prometheus, Ollama)."""
    # Auto-discover if no URL provided
    if not url:
        ctx = context.current_context
        if name == "prometheus":
            url = _discover_prometheus(ctx)
        elif name == "ollama":
            if _check_ollama():
                url = "http://localhost:11434"

    if not url:
        default_port = info.get("default_port", 8080)
        return {
            "success": False,
            "message": (
                f"Could not auto-discover {info['name']}"
            ),
            "detail": (
                f"Provide URL manually: "
                f"connect {name} http://host:{default_port}"
            ),
            "needs_input": True,
            "input_label": f"{info['name']} URL",
        }

    # Test connectivity
    reachable = _test_url(name, url)
    if not reachable:
        return {
            "success": False,
            "message": f"Cannot reach {info['name']} at {url}",
            "detail": "Check the URL and ensure the service is running",
        }

    # Save
    config = load_config()

    if name == "ollama":
        llm = config.get("llm", {})
        llm["provider"] = "ollama"
        llm["url"] = url
        config["llm"] = llm
    else:
        config[info["config_key"]] = url

    integrations = config.get("integrations", {})
    integrations[name] = {"url": url, "status": "connected"}
    config["integrations"] = integrations

    save_config(config)

    return {
        "success": True,
        "message": f"Connected to {info['name']}",
        "detail": f"URL: {url}",
    }


def _connect_auto(name, info):
    """Connect an auto-detected integration."""
    ctx = context.current_context

    if name == "argocd":
        detected = _detect_argocd(ctx)
    elif name == "flux":
        detected = _detect_flux(ctx)
    else:
        detected = False

    if not detected:
        return {
            "success": False,
            "message": f"{info['name']} not found in cluster",
            "detail": "Ensure it is installed and accessible",
        }

    config = load_config()
    integrations = config.get("integrations", {})
    integrations[name] = {"status": "connected", "auto": True}
    config["integrations"] = integrations
    save_config(config)

    return {
        "success": True,
        "message": f"{info['name']} detected and connected",
        "detail": "Auto-discovered in cluster",
    }


def _check_status(name, config):
    """Check current connection status of an integration."""
    info = INTEGRATIONS.get(name)
    if not info:
        return {"status": "unknown"}

    integrations = config.get("integrations", {})
    saved = integrations.get(name, {})

    if saved.get("status") == "connected":
        url = saved.get("url", "")
        return {
            "status": "connected",
            "detail": url if url else "auto-detected",
        }

    # Check config keys directly
    key = info["config_key"]
    if key in config and config[key]:
        if info["type"] == "webhook":
            return {
                "status": "connected",
                "detail": "webhook configured",
            }
        elif isinstance(config[key], str):
            return {
                "status": "connected",
                "detail": config[key],
            }
        elif isinstance(config[key], dict):
            url = config[key].get("url", "")
            if url:
                return {
                    "status": "connected",
                    "detail": url,
                }

    # Check webhooks list
    if info["type"] == "webhook":
        webhooks = config.get("webhooks", [])
        for w in webhooks:
            if w.get("type") == name:
                return {
                    "status": "connected",
                    "detail": "webhook configured",
                }

    return {"status": "not_connected", "detail": ""}


def _test_webhook(name, url, message):
    """Send a test message to a webhook."""
    import urllib.request
    import urllib.error

    if name == "slack":
        payload = json.dumps({"text": message})
    elif name == "teams":
        payload = json.dumps({
            "@type": "MessageCard",
            "text": message,
        })
    else:
        payload = json.dumps({"text": message})

    try:
        req = urllib.request.Request(
            url,
            data=payload.encode("utf-8"),
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        resp = urllib.request.urlopen(req, timeout=10)
        return resp.status < 400
    except Exception:
        return False


def _test_url(name, url):
    """Test if a URL is reachable."""
    import urllib.request
    import urllib.error

    test_path = ""
    if name == "prometheus":
        test_path = "/-/healthy"
    elif name == "ollama":
        test_path = "/api/tags"

    try:
        target = url.rstrip("/") + test_path
        req = urllib.request.Request(target, method="GET")
        resp = urllib.request.urlopen(req, timeout=5)
        return resp.status < 400
    except Exception:
        return False


def _discover_prometheus(ctx):
    """Try to find Prometheus in the cluster."""
    # Common service names and namespaces
    candidates = [
        ("monitoring", "prometheus-server"),
        ("monitoring", "prometheus-kube-prometheus-prometheus"),
        ("prometheus", "prometheus-server"),
        ("observability", "prometheus"),
        ("default", "prometheus"),
    ]

    for ns, svc in candidates:
        cmd = [
            "kubectl", "--context", str(ctx or ""),
            "get", "service", svc, "-n", ns,
            "-o", "jsonpath={.spec.clusterIP}:{.spec.ports[0].port}",
        ]
        r = subprocess.run(cmd, capture_output=True, text=True)
        if r.returncode == 0 and r.stdout and ":" in r.stdout:
            ip_port = r.stdout.strip()
            if ip_port and not ip_port.startswith(":"):
                return f"http://{ip_port}"

    return None


def _detect_argocd(ctx):
    """Check if ArgoCD is installed."""
    for ns in ("argocd", "argo-cd"):
        cmd = [
            "kubectl", "--context", str(ctx or ""),
            "get", "deployment", "argocd-server",
            "-n", ns, "-o", "name",
        ]
        r = subprocess.run(cmd, capture_output=True, text=True)
        if r.returncode == 0:
            return True
    return False


def _detect_flux(ctx):
    """Check if Flux is installed."""
    for ns in ("flux-system", "flux"):
        cmd = [
            "kubectl", "--context", str(ctx or ""),
            "get", "deployment", "source-controller",
            "-n", ns, "-o", "name",
        ]
        r = subprocess.run(cmd, capture_output=True, text=True)
        if r.returncode == 0:
            return True
    return False


def _check_ollama():
    """Check if Ollama is running locally."""
    import urllib.request
    try:
        req = urllib.request.Request(
            "http://localhost:11434/api/tags", method="GET"
        )
        resp = urllib.request.urlopen(req, timeout=2)
        return resp.status == 200
    except Exception:
        return False
