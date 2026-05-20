"""
Profiles — named configuration presets that override
base config. Switch between oncall, dev, prod modes.
"""

import yaml
from pathlib import Path

from core.config import load_config, save_config, CONFIG_PATH

PROFILES_DIR = Path.home() / ".kubsome" / "profiles"

BUILTIN_PROFILES = {
    "dev": {
        "description": "Fast mode for development clusters",
        "overrides": {
            "danger_confirm": False,
            "refresh_interval": 1,
            "show_suggestions": True,
            "notifications": False,
        },
    },
    "oncall": {
        "description": "Alert-focused for incident response",
        "overrides": {
            "danger_confirm": True,
            "refresh_interval": 2,
            "notifications": True,
            "show_suggestions": True,
            "log_tail_lines": 200,
        },
    },
    "prod": {
        "description": "Maximum safety for production",
        "overrides": {
            "danger_confirm": True,
            "refresh_interval": 3,
            "notifications": True,
            "show_suggestions": True,
        },
    },
    "ci": {
        "description": "Non-interactive for CI/CD pipelines",
        "overrides": {
            "danger_confirm": False,
            "notifications": False,
            "show_suggestions": False,
            "telemetry": False,
        },
    },
}


def list_profiles():
    """List all available profiles (built-in + custom)."""
    profiles = []

    # Built-in
    for name, info in BUILTIN_PROFILES.items():
        profiles.append({
            "name": name,
            "description": info["description"],
            "source": "built-in",
            "active": _is_active(name),
        })

    # Custom profiles from disk
    if PROFILES_DIR.exists():
        for f in sorted(PROFILES_DIR.glob("*.yaml")):
            name = f.stem
            if name in BUILTIN_PROFILES:
                continue
            try:
                data = yaml.safe_load(f.read_text()) or {}
                profiles.append({
                    "name": name,
                    "description": data.get(
                        "description", ""
                    ),
                    "source": "custom",
                    "active": _is_active(name),
                })
            except Exception:
                continue

    return profiles


def get_profile(name):
    """Get a profile's overrides."""
    # Check built-in
    if name in BUILTIN_PROFILES:
        return BUILTIN_PROFILES[name]["overrides"]

    # Check custom
    path = PROFILES_DIR / f"{name}.yaml"
    if path.exists():
        try:
            data = yaml.safe_load(path.read_text()) or {}
            return data.get("overrides", data)
        except Exception:
            return None

    return None


def activate_profile(name):
    """
    Activate a profile — merges overrides into active config.
    Saves the active profile name for reference.
    """
    overrides = get_profile(name)
    if overrides is None:
        return {
            "success": False,
            "message": f"Profile '{name}' not found",
            "available": list(BUILTIN_PROFILES.keys()),
        }

    config = load_config()

    # Store which profile is active
    config["active_profile"] = name

    # Apply overrides
    for key, value in overrides.items():
        if isinstance(value, dict) and key in config:
            if isinstance(config[key], dict):
                config[key].update(value)
            else:
                config[key] = value
        else:
            config[key] = value

    save_config(config)

    return {
        "success": True,
        "message": f"Profile '{name}' activated",
        "overrides": overrides,
    }


def deactivate_profile():
    """Remove active profile marker."""
    config = load_config()
    if "active_profile" in config:
        del config["active_profile"]
        save_config(config)
        return {
            "success": True,
            "message": "Profile deactivated (using base config)",
        }
    return {
        "success": True,
        "message": "No active profile",
    }


def create_profile(name, description="", overrides=None):
    """Create a custom profile."""
    PROFILES_DIR.mkdir(parents=True, exist_ok=True)

    path = PROFILES_DIR / f"{name}.yaml"
    data = {
        "description": description or f"Custom profile: {name}",
        "overrides": overrides or {},
    }

    path.write_text(yaml.dump(data, default_flow_style=False))

    return {
        "success": True,
        "message": f"Profile '{name}' created",
        "path": str(path),
    }


def delete_profile(name):
    """Delete a custom profile."""
    if name in BUILTIN_PROFILES:
        return {
            "success": False,
            "message": f"Cannot delete built-in profile '{name}'",
        }

    path = PROFILES_DIR / f"{name}.yaml"
    if path.exists():
        path.unlink()
        return {
            "success": True,
            "message": f"Profile '{name}' deleted",
        }

    return {
        "success": False,
        "message": f"Profile '{name}' not found",
    }


def get_active_profile():
    """Get the currently active profile name."""
    config = load_config()
    return config.get("active_profile")


def _is_active(name):
    """Check if a profile is currently active."""
    config = load_config()
    return config.get("active_profile") == name
