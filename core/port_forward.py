"""
Port-Forward Manager — start, stop, and list active
port-forwards with background process tracking.
"""

import subprocess
import signal
import os
import json
from pathlib import Path
from datetime import datetime

from core.context import context

_active_forwards = {}
PF_STATE_FILE = Path.home() / ".kubsome" / "port_forwards.json"


def start_forward(target, local_port, remote_port=None, resource_type="pod"):
    """
    Start a port-forward in the background.
    Returns {success, pid, local_port, message}.
    """
    ctx = context.current_context
    ns = context.namespace

    if not remote_port:
        remote_port = local_port

    port_spec = f"{local_port}:{remote_port}"
    resource = f"{resource_type}/{target}"

    cmd = [
        "kubectl", "--context", str(ctx or ""),
        "port-forward", resource, port_spec,
        "-n", str(ns)
    ]

    try:
        proc = subprocess.Popen(
            cmd,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.PIPE,
            preexec_fn=os.setpgrp,
        )

        # Brief wait to check if it started OK
        import time
        time.sleep(0.5)
        if proc.poll() is not None:
            err = proc.stderr.read().decode().strip()
            return {
                "success": False,
                "message": err or "Port-forward failed to start",
            }

        key = f"{target}:{local_port}"
        entry = {
            "pid": proc.pid,
            "target": target,
            "resource_type": resource_type,
            "local_port": local_port,
            "remote_port": remote_port,
            "context": ctx,
            "namespace": ns,
            "started": datetime.now().isoformat(),
        }
        _active_forwards[key] = entry
        _save_state()

        return {
            "success": True,
            "pid": proc.pid,
            "local_port": local_port,
            "remote_port": remote_port,
            "target": target,
            "message": f"Forwarding localhost:{local_port} → {resource}:{remote_port}",
        }

    except Exception as e:
        return {"success": False, "message": str(e)}


def stop_forward(target=None, local_port=None):
    """
    Stop a port-forward by target name or local port.
    Returns {success, message}.
    """
    _load_state()

    key = None
    if target and local_port:
        key = f"{target}:{local_port}"
    elif target:
        # Find by target name
        for k, v in _active_forwards.items():
            if v["target"] == target or target in k:
                key = k
                break
    elif local_port:
        for k, v in _active_forwards.items():
            if v["local_port"] == int(local_port):
                key = k
                break

    if not key or key not in _active_forwards:
        return {"success": False, "message": "Port-forward not found"}

    entry = _active_forwards[key]
    pid = entry["pid"]

    try:
        os.kill(pid, signal.SIGTERM)
    except ProcessLookupError:
        pass  # Already dead
    except Exception as e:
        return {"success": False, "message": f"Failed to stop: {e}"}

    del _active_forwards[key]
    _save_state()

    return {
        "success": True,
        "message": f"Stopped forward to {entry['target']}:{entry['local_port']}",
    }


def stop_all():
    """Stop all active port-forwards."""
    _load_state()
    count = 0
    for key in list(_active_forwards.keys()):
        entry = _active_forwards[key]
        try:
            os.kill(entry["pid"], signal.SIGTERM)
        except Exception:
            pass
        count += 1

    _active_forwards.clear()
    _save_state()
    return {"stopped": count}


def list_forwards():
    """List all active port-forwards with health check."""
    _load_state()
    _cleanup_dead()

    forwards = []
    for key, entry in _active_forwards.items():
        alive = _is_alive(entry["pid"])
        forwards.append({
            **entry,
            "key": key,
            "alive": alive,
            "url": f"http://localhost:{entry['local_port']}",
        })

    return forwards


def _is_alive(pid):
    """Check if a process is still running."""
    try:
        os.kill(pid, 0)
        return True
    except (ProcessLookupError, PermissionError):
        return False


def _cleanup_dead():
    """Remove dead processes from state."""
    dead = [
        k for k, v in _active_forwards.items()
        if not _is_alive(v["pid"])
    ]
    for k in dead:
        del _active_forwards[k]
    if dead:
        _save_state()


def _save_state():
    """Persist state to disk."""
    PF_STATE_FILE.parent.mkdir(parents=True, exist_ok=True)
    PF_STATE_FILE.write_text(json.dumps(_active_forwards, indent=2))


def _load_state():
    """Load state from disk."""
    global _active_forwards
    if PF_STATE_FILE.exists():
        try:
            _active_forwards = json.loads(PF_STATE_FILE.read_text())
        except Exception:
            _active_forwards = {}
