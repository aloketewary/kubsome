"""
User configuration — loaded from ~/.kubeasy/config.yaml
Falls back to defaults if file doesn't exist.
"""

import os
from pathlib import Path

import yaml

CONFIG_PATH = Path.home() / ".kubeasy" / "config.yaml"

DEFAULTS = {
    "refresh_interval": 2,
    "restart_warning_threshold": 2,
    "restart_critical_threshold": 5,
    "show_suggestions": True,
    "log_tail_lines": 100,
    "max_events": 50,
    "notifications": True,
    "llm": {
        "provider": "local",
        "model": "llama3",
        "url": "http://localhost:11434",
    },
    "aliases": {
        "p": "pods",
        "pw": "pods watch",
        "o": "overview",
        "e": "events",
        "ew": "events watch",
        "l": "logs",
        "i": "inspect",
        "d": "diagnose",
        "t": "trace",
        "tp": "top pods",
        "tn": "top nodes",
        "h": "help",
        "f": "find",
        "s": "switch",
        "sec": "security",
        "opt": "optimize",
    },
    "danger_confirm": True,
    "theme": "default",
}


def load_config():
    """Load user config, merging with defaults."""
    config = DEFAULTS.copy()

    if CONFIG_PATH.exists():
        try:
            with open(CONFIG_PATH, "r") as f:
                user_config = yaml.safe_load(f) or {}

            # Merge (user overrides defaults)
            for key, value in user_config.items():
                if isinstance(value, dict) and key in config:
                    config[key].update(value)
                else:
                    config[key] = value
        except Exception:
            pass

    return config


def save_default_config():
    """Create default config file if it doesn't exist."""
    CONFIG_PATH.parent.mkdir(parents=True, exist_ok=True)

    if not CONFIG_PATH.exists():
        with open(CONFIG_PATH, "w") as f:
            yaml.dump(
                DEFAULTS, f,
                default_flow_style=False
            )


def resolve_alias(user_input, config):
    """Expand command aliases."""
    tokens = user_input.split()
    if not tokens:
        return user_input

    aliases = config.get("aliases", {})
    first = tokens[0]

    if first in aliases:
        expanded = aliases[first]
        remaining = " ".join(tokens[1:])
        if remaining:
            return f"{expanded} {remaining}"
        return expanded

    return user_input
