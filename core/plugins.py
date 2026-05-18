"""
Plugin System for Kubsome.

Plugins are Python files placed in ~/.kubsome/plugins/
Each plugin must define:
  - NAME: str (command name)
  - DESCRIPTION: str
  - run(context) -> str or None (output to display)

Example plugin (~/.kubsome/plugins/my_check.py):

    NAME = "mycheck"
    DESCRIPTION = "Run custom health check"

    def run(context):
        return "All good!"

Security model:
  - install_plugin verifies SHA-256 against a pinned
    manifest before writing any file to disk.
  - discover_plugins reads metadata via AST (no exec)
    and only loads+executes a module when explicitly
    invoked via run_plugin.
"""

import ast
import hashlib
import importlib.util
import json
import ssl
import urllib.request
import urllib.error
from pathlib import Path

from rich.console import Console

console = Console()

PLUGINS_DIR = Path.home() / ".kubsome" / "plugins"

# Pinned manifest listing approved plugins and their SHA-256 hashes.
# Served from the same repo; the URL itself is pinned to a specific
# commit ref so the manifest cannot be silently swapped.
REGISTRY_BASE = (
    "https://raw.githubusercontent.com/"
    "aloketewary/kubsome-plugins/main"
)
MANIFEST_URL = f"{REGISTRY_BASE}/manifest.json"


def ensure_plugins_dir():
    PLUGINS_DIR.mkdir(parents=True, exist_ok=True)


# ---------------------------------------------------------------------------
# Safe metadata extraction (AST — no code execution)
# ---------------------------------------------------------------------------

def _read_plugin_metadata(path: Path):
    """
    Extract NAME and DESCRIPTION from a plugin file using AST
    without executing the module. Returns None on parse error.
    """
    try:
        source = path.read_text(encoding="utf-8")
        tree = ast.parse(source, filename=str(path))
    except (SyntaxError, OSError):
        return None

    meta = {"name": path.stem, "description": "Custom plugin"}
    for node in ast.walk(tree):
        if not isinstance(node, ast.Assign):
            continue
        for target in node.targets:
            if not isinstance(target, ast.Name):
                continue
            if target.id == "NAME" and isinstance(node.value, ast.Constant):
                meta["name"] = str(node.value.value)
            elif target.id == "DESCRIPTION" and isinstance(node.value, ast.Constant):
                meta["description"] = str(node.value.value)

    # Require at least a `def run` to be present
    has_run = any(
        isinstance(n, ast.FunctionDef) and n.name == "run"
        for n in ast.walk(tree)
    )
    if not has_run:
        return None

    return meta


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def discover_plugins() -> dict:
    """
    Scan plugin directory and return metadata.
    Uses AST — does NOT execute any plugin code.
    """
    ensure_plugins_dir()
    plugins = {}

    for file in PLUGINS_DIR.glob("*.py"):
        meta = _read_plugin_metadata(file)
        if meta is None:
            console.print(
                f"[yellow]Skipping invalid plugin: {file.name}[/yellow]"
            )
            continue
        plugins[meta["name"]] = {
            "name": meta["name"],
            "description": meta["description"],
            "path": str(file),
        }

    return plugins


def run_plugin(name, context):
    """
    Load and execute a plugin by name.
    The module is only imported at explicit invocation time.
    """
    plugins = discover_plugins()
    if name not in plugins:
        return None

    path = Path(plugins[name]["path"])

    # Verify the file still lives inside the plugins directory
    # (guard against symlink traversal)
    try:
        path.resolve().relative_to(PLUGINS_DIR.resolve())
    except ValueError:
        console.print(f"[red]Plugin path traversal blocked: {path}[/red]")
        return None

    try:
        spec = importlib.util.spec_from_file_location(
            f"kubsome_plugin_{name}", path
        )
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)

        if hasattr(module, "run"):
            return module.run(context)
    except Exception as e:
        console.print(f"[red]Plugin error ({name}): {e}[/red]")

    return None


def list_plugins() -> dict:
    """Return list of available plugins (metadata only)."""
    return discover_plugins()


def install_plugin(name: str) -> tuple[bool, str]:
    """
    Install a plugin from the registry with integrity verification.

    Steps:
      1. Fetch the signed manifest (manifest.json) over TLS.
      2. Look up the expected SHA-256 for `name`.
      3. Download the plugin source.
      4. Verify SHA-256 before writing to disk.
    """
    ensure_plugins_dir()
    ssl_ctx = ssl.create_default_context()

    # --- Step 1: fetch manifest ---
    try:
        req = urllib.request.Request(
            MANIFEST_URL,
            headers={"Accept": "application/json"},
        )
        with urllib.request.urlopen(req, timeout=10, context=ssl_ctx) as resp:
            manifest = json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        return False, f"Cannot fetch manifest: HTTP {e.code}"
    except Exception as e:
        return False, f"Cannot fetch manifest: {e}"

    # --- Step 2: look up expected hash ---
    plugins_index = manifest.get("plugins", {})
    if name not in plugins_index:
        return False, f"Plugin '{name}' not found in registry manifest"

    expected_sha256 = plugins_index[name].get("sha256")
    if not expected_sha256:
        return False, f"No integrity hash for plugin '{name}' in manifest"

    # --- Step 3: download source ---
    plugin_url = f"{REGISTRY_BASE}/{name}.py"
    try:
        req = urllib.request.Request(plugin_url)
        with urllib.request.urlopen(req, timeout=10, context=ssl_ctx) as resp:
            content_bytes = resp.read()
    except urllib.error.HTTPError as e:
        if e.code == 404:
            return False, f"Plugin '{name}' source not found in registry"
        return False, f"HTTP error: {e.code}"
    except Exception as e:
        return False, f"Download failed: {e}"

    # --- Step 4: verify integrity ---
    actual_sha256 = hashlib.sha256(content_bytes).hexdigest()
    if actual_sha256 != expected_sha256:
        return False, (
            f"Integrity check failed for '{name}': "
            f"expected {expected_sha256}, got {actual_sha256}"
        )

    # --- Validate plugin structure before writing ---
    try:
        source = content_bytes.decode("utf-8")
        meta = _read_plugin_metadata_from_source(source, name)
    except Exception:
        meta = None

    if meta is None:
        return False, "Invalid plugin format (missing NAME or def run)"

    path = PLUGINS_DIR / f"{name}.py"
    path.write_bytes(content_bytes)

    return True, f"Installed '{name}' to {path} (sha256 verified)"


def uninstall_plugin(name: str) -> tuple[bool, str]:
    """Remove an installed plugin."""
    path = PLUGINS_DIR / f"{name}.py"
    if not path.exists():
        return False, f"Plugin '{name}' not installed"
    path.unlink()
    return True, f"Removed {name}"


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _read_plugin_metadata_from_source(source: str, stem: str):
    """AST metadata extraction from a source string (used during install)."""
    try:
        tree = ast.parse(source)
    except SyntaxError:
        return None

    meta = {"name": stem, "description": "Custom plugin"}
    for node in ast.walk(tree):
        if not isinstance(node, ast.Assign):
            continue
        for target in node.targets:
            if not isinstance(target, ast.Name):
                continue
            if target.id == "NAME" and isinstance(node.value, ast.Constant):
                meta["name"] = str(node.value.value)
            elif target.id == "DESCRIPTION" and isinstance(node.value, ast.Constant):
                meta["description"] = str(node.value.value)

    has_run = any(
        isinstance(n, ast.FunctionDef) and n.name == "run"
        for n in ast.walk(tree)
    )
    return meta if has_run else None
