"""
Environment Auto-Switch — detect environment from context name
and auto-apply safety rules, profiles, and visual indicators.
"""

from core.config import load_config
from core.context import context

# Default environment detection patterns
DEFAULT_ENV_RULES = {
    "prod": {
        "patterns": ["prod", "prd", "production", "live"],
        "color": "red",
        "icon": "🔴",
        "confirm_destructive": True,
        "blocked_commands": [],
        "profile": "prod",
        "prompt_style": "bold red",
    },
    "staging": {
        "patterns": ["stg", "staging", "stage", "preprod", "pre-prod"],
        "color": "yellow",
        "icon": "🟡",
        "confirm_destructive": True,
        "blocked_commands": [],
        "profile": None,
        "prompt_style": "yellow",
    },
    "dev": {
        "patterns": ["dev", "develop", "development", "sandbox"],
        "color": "green",
        "icon": "🟢",
        "confirm_destructive": False,
        "blocked_commands": [],
        "profile": "dev",
        "prompt_style": "green",
    },
    "sit": {
        "patterns": ["sit", "test", "testing", "qa", "uat"],
        "color": "cyan",
        "icon": "🔵",
        "confirm_destructive": False,
        "blocked_commands": [],
        "profile": None,
        "prompt_style": "cyan",
    },
    "local": {
        "patterns": [
            "local", "minikube", "kind", "docker-desktop",
            "k3d", "colima", "rancher-desktop",
        ],
        "color": "dim",
        "icon": "⚪",
        "confirm_destructive": False,
        "blocked_commands": [],
        "profile": "dev",
        "prompt_style": "dim",
    },
}

DESTRUCTIVE_COMMANDS = {
    "rollback", "restart", "scale", "delete",
    "apply", "remediate", "trigger",
}


def detect_environment(context_name=None):
    """
    Detect environment from context name.
    Returns env dict with name, color, icon, rules.
    """
    ctx = context_name or context.current_context or ""
    ctx_lower = ctx.lower()

    config = load_config()
    env_rules = config.get("environments", DEFAULT_ENV_RULES)

    for env_name, rules in env_rules.items():
        patterns = rules.get("patterns", [])
        for pattern in patterns:
            if pattern in ctx_lower:
                return {
                    "name": env_name.upper(),
                    "key": env_name,
                    "color": rules.get("color", "dim"),
                    "icon": rules.get("icon", "●"),
                    "confirm_destructive": rules.get(
                        "confirm_destructive", False
                    ),
                    "blocked_commands": rules.get(
                        "blocked_commands", []
                    ),
                    "profile": rules.get("profile"),
                    "prompt_style": rules.get(
                        "prompt_style", "dim"
                    ),
                    "context": ctx,
                }

    return {
        "name": "UNKNOWN",
        "key": "unknown",
        "color": "dim",
        "icon": "●",
        "confirm_destructive": False,
        "blocked_commands": [],
        "profile": None,
        "prompt_style": "dim",
        "context": ctx,
    }


def check_command_allowed(cmd_type, env=None):
    """
    Check if a command is allowed in the current environment.
    Returns {allowed, reason} dict.
    """
    if env is None:
        env = detect_environment()

    blocked = env.get("blocked_commands", [])
    if cmd_type in blocked:
        return {
            "allowed": False,
            "reason": (
                f"Command '{cmd_type}' is blocked in "
                f"{env['name']} environment"
            ),
        }

    return {"allowed": True, "reason": ""}


def is_destructive(cmd_type):
    """Check if a command type is destructive."""
    return cmd_type in DESTRUCTIVE_COMMANDS


def needs_confirmation(cmd_type, env=None):
    """
    Check if a command needs confirmation in current env.
    Returns True if destructive + env requires confirmation.
    """
    if env is None:
        env = detect_environment()

    if not is_destructive(cmd_type):
        return False

    return env.get("confirm_destructive", False)


def format_prompt(env=None):
    """
    Format the CLI prompt with environment indicator.
    Returns (prompt_text, style) tuple.
    """
    if env is None:
        env = detect_environment()

    ns = context.namespace or "default"
    name = env["name"]
    color = env["color"]
    icon = env["icon"]

    return f"{icon} [{color}]{name}[/{color}] {ns}"


def get_env_banner(env=None):
    """
    Get a warning banner for dangerous environments.
    Returns string or None.
    """
    if env is None:
        env = detect_environment()

    if env["key"] == "prod":
        return (
            "[bold red]⚠ PRODUCTION ENVIRONMENT[/bold red] "
            f"[dim]({env['context']})[/dim]"
        )
    if env["key"] == "staging":
        return (
            "[yellow]● STAGING[/yellow] "
            f"[dim]({env['context']})[/dim]"
        )

    return None


def on_context_switch(new_context):
    """
    Called when context switches. Auto-applies environment
    profile if configured.
    """
    env = detect_environment(new_context)

    profile = env.get("profile")
    if profile:
        from core.profiles import activate_profile, get_active_profile
        current = get_active_profile()
        # Only auto-switch if no manual profile is active
        # or if the current profile matches an env profile
        env_profiles = {
            r.get("profile")
            for r in DEFAULT_ENV_RULES.values()
            if r.get("profile")
        }
        if current is None or current in env_profiles:
            activate_profile(profile)

    return env
