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
"""

import os
import importlib.util
from pathlib import Path

from rich.console import Console

console = Console()

PLUGINS_DIR = Path.home() / ".kubsome" / "plugins"


def ensure_plugins_dir():
    PLUGINS_DIR.mkdir(parents=True, exist_ok=True)


def discover_plugins():
    """Find all plugin files and return metadata."""
    ensure_plugins_dir()
    plugins = {}

    for file in PLUGINS_DIR.glob("*.py"):
        try:
            spec = importlib.util.spec_from_file_location(
                file.stem, file
            )
            module = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(module)

            name = getattr(module, "NAME", file.stem)
            desc = getattr(
                module, "DESCRIPTION", "Custom plugin"
            )

            plugins[name] = {
                "name": name,
                "description": desc,
                "module": module,
                "path": str(file),
            }
        except Exception as e:
            console.print(
                f"[red]Plugin error ({file.name}): "
                f"{e}[/red]"
            )

    return plugins


def run_plugin(name, context):
    """Execute a plugin by name."""
    plugins = discover_plugins()

    if name not in plugins:
        return None

    plugin = plugins[name]
    module = plugin["module"]

    if hasattr(module, "run"):
        return module.run(context)

    return None


def list_plugins():
    """Return list of available plugins."""
    return discover_plugins()
