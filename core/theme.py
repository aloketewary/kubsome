"""
Theming — configurable color schemes.

Configure in ~/.kubeasy/config.yaml:
  theme: dark  # dark, light, minimal, hacker

Colors are used by renderers for consistent styling.
"""

THEMES = {
    "dark": {
        "primary": "cyan",
        "success": "green",
        "warning": "yellow",
        "error": "red",
        "info": "dim",
        "accent": "magenta",
        "border": "dim",
        "header": "bold cyan",
        "muted": "dim white",
    },
    "light": {
        "primary": "blue",
        "success": "green",
        "warning": "dark_orange",
        "error": "red",
        "info": "dim",
        "accent": "purple",
        "border": "bright_black",
        "header": "bold blue",
        "muted": "bright_black",
    },
    "minimal": {
        "primary": "white",
        "success": "green",
        "warning": "yellow",
        "error": "red",
        "info": "dim",
        "accent": "white",
        "border": "dim",
        "header": "bold white",
        "muted": "dim",
    },
    "hacker": {
        "primary": "bright_green",
        "success": "bright_green",
        "warning": "bright_yellow",
        "error": "bright_red",
        "info": "green",
        "accent": "bright_green",
        "border": "green",
        "header": "bold bright_green",
        "muted": "green",
    },
}


def get_theme(name="dark"):
    """Get theme colors by name."""
    return THEMES.get(name, THEMES["dark"])


def get_current_theme():
    """Get theme from config."""
    from core.config import load_config
    config = load_config()
    name = config.get("theme", "dark")
    return get_theme(name)
