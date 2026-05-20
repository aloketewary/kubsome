"""
Init Wizard — interactive guided setup for first-run experience.
Walks through theme, notifications, integrations, and aliases.
"""

from pathlib import Path

from rich.console import Console
from rich.panel import Panel

from core.config import CONFIG_PATH, load_config, save_config

console = Console()

THEMES = ["dark", "light", "minimal", "hacker"]

DEFAULT_ALIASES = {
    "p": "pods",
    "pw": "pods watch",
    "o": "overview",
    "e": "events",
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
}


def run_init_wizard(force=False):
    """
    Run the interactive init wizard.
    Returns the generated config dict.
    """
    if CONFIG_PATH.exists() and not force:
        console.print(
            f"[yellow]Config already exists:[/yellow] "
            f"{CONFIG_PATH}\n"
        )
        if not _ask_yn("Overwrite with new config?", False):
            console.print("[dim]Keeping existing config.[/dim]")
            return None

    console.print(
        Panel(
            "[bold]Welcome to Kubsome![/bold]\n\n"
            "This wizard will set up your configuration.\n"
            "Press Enter to accept defaults [dim](shown in brackets)[/dim].",
            title="[bold]🚀 Setup Wizard[/bold]",
            border_style="cyan",
        )
    )
    console.print()

    config = {}

    # Step 1: Theme
    config["theme"] = _step_theme()

    # Step 2: Notifications
    config["notifications"] = _step_notifications()

    # Step 3: Refresh interval
    config["refresh_interval"] = _step_refresh()

    # Step 4: Aliases
    config["aliases"] = _step_aliases()

    # Step 5: LLM
    config["llm"] = _step_llm()

    # Step 6: Safety
    config["danger_confirm"] = _step_safety()

    # Step 7: Telemetry
    config["telemetry"] = _step_telemetry()

    # Step 8: Auto-discover integrations
    _step_integrations(config)

    # Merge with defaults for any missing keys
    from core.config import DEFAULTS
    for key, val in DEFAULTS.items():
        if key not in config:
            config[key] = val

    # Save
    CONFIG_PATH.parent.mkdir(parents=True, exist_ok=True)
    save_config(config)

    console.print()
    console.print(
        Panel(
            f"[green]✓ Config saved to:[/green] {CONFIG_PATH}\n\n"
            "[bold]Next steps:[/bold]\n"
            "  [cyan]kubsome[/cyan]           "
            "Start interactive CLI\n"
            "  [cyan]kubsome serve[/cyan]     "
            "Start API + Web UI\n"
            "  [cyan]kubsome connect[/cyan]   "
            "Set up integrations\n"
            "  [cyan]kubsome doctor[/cyan]    "
            "Check cluster connectivity",
            title="[bold]✓ Setup Complete[/bold]",
            border_style="green",
        )
    )

    return config


def _step_theme():
    """Choose UI theme."""
    console.print("[bold]1/8 Theme[/bold]")
    console.print(
        "  [dim]Options: dark, light, minimal, hacker[/dim]"
    )
    choice = _ask("  Theme", "dark")
    if choice not in THEMES:
        console.print(
            f"  [dim]Unknown theme, using 'dark'[/dim]"
        )
        choice = "dark"
    console.print(f"  [green]✓[/green] {choice}\n")
    return choice


def _step_notifications():
    """Enable/disable desktop notifications."""
    console.print("[bold]2/8 Notifications[/bold]")
    console.print(
        "  [dim]Desktop alerts for watch triggers "
        "and anomalies[/dim]"
    )
    enabled = _ask_yn("  Enable notifications?", True)
    icon = "✓ enabled" if enabled else "✗ disabled"
    console.print(f"  [green]✓[/green] {icon}\n")
    return enabled


def _step_refresh():
    """Set refresh interval."""
    console.print("[bold]3/8 Refresh Interval[/bold]")
    console.print(
        "  [dim]Seconds between live updates "
        "(pods watch, events watch)[/dim]"
    )
    val = _ask("  Interval (seconds)", "2")
    try:
        interval = int(val)
        interval = max(1, min(30, interval))
    except ValueError:
        interval = 2
    console.print(f"  [green]✓[/green] {interval}s\n")
    return interval


def _step_aliases():
    """Configure command aliases."""
    console.print("[bold]4/8 Aliases[/bold]")
    console.print(
        "  [dim]Shortcuts: p=pods, o=overview, "
        "d=diagnose, l=logs, etc.[/dim]"
    )
    use_defaults = _ask_yn(
        "  Use default aliases?", True
    )
    if use_defaults:
        console.print(
            f"  [green]✓[/green] "
            f"{len(DEFAULT_ALIASES)} aliases loaded\n"
        )
        return DEFAULT_ALIASES.copy()
    else:
        console.print(
            "  [dim]You can add aliases later in "
            "~/.kubsome/config.yaml[/dim]"
        )
        console.print(f"  [green]✓[/green] No aliases\n")
        return {}


def _step_llm():
    """Configure LLM provider."""
    console.print("[bold]5/8 AI / LLM[/bold]")
    console.print(
        "  [dim]Powers natural language queries "
        "and AI analysis[/dim]\n"
        "  [dim]Options: local (built-in), "
        "ollama (local LLM)[/dim]"
    )
    provider = _ask("  Provider", "local")
    if provider not in ("local", "ollama"):
        provider = "local"

    llm = {"provider": provider}

    if provider == "ollama":
        url = _ask("  Ollama URL", "http://localhost:11434")
        model = _ask("  Model", "llama3")
        llm["url"] = url
        llm["model"] = model
    else:
        llm["url"] = "http://localhost:11434"
        llm["model"] = "llama3"

    console.print(f"  [green]✓[/green] {provider}\n")
    return llm


def _step_safety():
    """Configure production safety."""
    console.print("[bold]6/8 Production Safety[/bold]")
    console.print(
        "  [dim]Require confirmation for destructive "
        "operations (restart, rollback, delete) "
        "in production contexts[/dim]"
    )
    enabled = _ask_yn("  Enable safety confirmations?", True)
    icon = "✓ enabled" if enabled else "✗ disabled"
    console.print(f"  [green]✓[/green] {icon}\n")
    return enabled


def _step_telemetry():
    """Configure local telemetry."""
    console.print("[bold]7/8 Usage Analytics[/bold]")
    console.print(
        "  [dim]Local-only command frequency tracking.\n"
        "  Helps improve suggestions. "
        "Never sent anywhere.[/dim]"
    )
    enabled = _ask_yn("  Enable local analytics?", True)
    icon = "✓ enabled" if enabled else "✗ disabled"
    console.print(f"  [green]✓[/green] {icon}\n")
    return enabled


def _step_integrations(config):
    """Offer to auto-discover integrations."""
    console.print("[bold]8/8 Integrations[/bold]")
    console.print(
        "  [dim]Auto-discover Prometheus, ArgoCD, "
        "Flux, Ollama in your cluster[/dim]"
    )
    discover = _ask_yn("  Run auto-discovery now?", True)

    if not discover:
        console.print(
            "  [dim]Run 'kubsome connect --discover' "
            "later[/dim]\n"
        )
        return

    try:
        from core.connect import auto_discover, connect_discovered
        discoveries = auto_discover()
        if discoveries:
            console.print(
                f"  [green]Found {len(discoveries)} "
                f"integration(s):[/green]"
            )
            for d in discoveries:
                console.print(
                    f"    • {d['name']} "
                    f"[dim]({d['source']})[/dim]"
                )

            connect = _ask_yn("  Connect all?", True)
            if connect:
                results = connect_discovered(discoveries)
                for r in results:
                    if r["success"]:
                        console.print(
                            f"    [green]✓[/green] {r['name']}"
                        )
                    else:
                        console.print(
                            f"    [dim]✗ {r['name']}: "
                            f"{r['message']}[/dim]"
                        )
                # Merge integration config
                reloaded = load_config()
                if "integrations" in reloaded:
                    config["integrations"] = (
                        reloaded["integrations"]
                    )
                if "webhooks" in reloaded:
                    config["webhooks"] = reloaded["webhooks"]
        else:
            console.print(
                "  [dim]No integrations found. "
                "Use 'kubsome connect' later.[/dim]"
            )
    except Exception:
        console.print(
            "  [dim]Discovery skipped "
            "(cluster not reachable)[/dim]"
        )

    console.print()


# --- Input helpers ---

def _ask(label, default=""):
    """Prompt with a default value."""
    try:
        val = input(f"{label} [{default}]: ").strip()
        return val if val else default
    except (EOFError, KeyboardInterrupt):
        return default


def _ask_yn(label, default=True):
    """Yes/No prompt."""
    hint = "Y/n" if default else "y/N"
    try:
        val = input(f"{label} [{hint}]: ").strip().lower()
        if not val:
            return default
        return val in ("y", "yes")
    except (EOFError, KeyboardInterrupt):
        return default
