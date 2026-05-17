"""
Kubsome — AI-native Kubernetes Operational Workspace
"""

import time

from rich.console import Console
from rich.panel import Panel
from prompt_toolkit import prompt

from core.commands import resolve_command
from core.executor import execute
from core.context import context
from core.completer import command_completer
from core.state import save_state
from core.history import get_history
from core.health import check_kubectl
from core.config import load_config, resolve_alias
from core.dispatcher import dispatch
from core.ai.suggest import suggest_command
from core.nlp.matcher import parse_query
from core.nlp.actions import map_to_command
from core.kubeconfig import enriched_contexts
from core.context_formatter import render_contexts
from core.context_switcher import find_context, switch_context
from core.selector import choose_context
from core.safety import confirm_production
from core.workflows import create_default_workflows
from core.bookmarks import get_bookmark
from core.chaining import split_chain
from core.banner import render_banner
from core.notify import notify_if_critical
from core.version import check_update


console = Console()
history = get_history()
app_config = load_config()


def main():
    import sys
    from core.config import CONFIG_PATH, save_default_config

    args = sys.argv[1:]

    # Auto-init on first run if no config exists
    if not CONFIG_PATH.exists():
        save_default_config()
        console.print(
            f"[green]✓ First run — config created:[/green] "
            f"{CONFIG_PATH}\n"
        )
        console.print(
            "[bold]Quick Start[/bold]\n"
            "────────────────────────────────────────\n"
            "[cyan]kubsome[/cyan]              "
            "Interactive CLI\n"
            "[cyan]kubsome serve[/cyan]        "
            "API + Web UI (opens browser)\n"
            "[cyan]kubsome tui[/cyan]          "
            "Full-screen terminal dashboard\n"
            "[cyan]kubsome --exec \"pods\"[/cyan] "
            "Run single command (CI/CD)\n"
            "\n"
            "[bold]Enable Features[/bold]\n"
            "────────────────────────────────────────\n"
            "[cyan]pip install kubsome[/cyan]       "
            "CLI + API + Web UI (installed ✓)\n"
            "[cyan]pip install \"kubsome[tui]\"[/cyan] "
            "→ enables [green]kubsome tui[/green] "
            "(full-screen dashboard)\n"
            "[cyan]pip install \"kubsome[all]\"[/cyan] "
            "→ enables [green]everything[/green]\n"
            "\n"
            "[bold]Inside the CLI[/bold]\n"
            "────────────────────────────────────────\n"
            "[cyan]overview[/cyan]     "
            "Cluster health dashboard\n"
            "[cyan]pods[/cyan]         "
            "List pods with status\n"
            "[cyan]logs <pod>[/cyan]   "
            "View pod logs\n"
            "[cyan]diagnose <pod>[/cyan] "
            "Root cause analysis\n"
            "[cyan]events[/cyan]       "
            "Recent cluster events\n"
            "[cyan]top pods[/cyan]     "
            "CPU/memory usage\n"
            "[cyan]security[/cyan]     "
            "Misconfiguration scan\n"
            "[cyan]help[/cyan]         "
            "Full command list (85+)\n"
            "\n"
            "[bold]Aliases[/bold] (type less)\n"
            "────────────────────────────────────────\n"
            "[dim]p[/dim]=pods  [dim]o[/dim]=overview  "
            "[dim]l[/dim]=logs  [dim]d[/dim]=diagnose  "
            "[dim]e[/dim]=events  [dim]s[/dim]=switch\n"
            "\n"
            "[bold]Tips[/bold]\n"
            "────────────────────────────────────────\n"
            "• Fuzzy matching — type partial "
            "names, Kubsome finds it\n"
            "• Natural language — "
            "\"why is payment failing\" works\n"
            "• Chain commands — "
            "[cyan]pods && events && alerts[/cyan]\n"
            "• Edit config — "
            f"[dim]{CONFIG_PATH}[/dim]\n"
        )

    # kubsome init
    if args and args[0] == "init":
        _init_config()
        return

    # kubsome serve [port]
    if args and args[0] == "serve":
        _start_server(args)
        return

    # kubsome tui
    if args and args[0] == "tui":
        _start_tui()
        return

    # kubsome --exec "command"
    if args and args[0] == "--exec":
        _exec_mode(args[1:])
        return

    # kubsome (interactive CLI)
    _start_cli()


def _init_config():
    """Generate default config interactively."""
    from core.config import (
        CONFIG_PATH, save_default_config
    )

    if CONFIG_PATH.exists():
        console.print(
            f"[yellow]Config already exists:[/yellow] "
            f"{CONFIG_PATH}"
        )
        overwrite = input("Overwrite? [y/N]: ").strip()
        if overwrite.lower() != "y":
            console.print("[dim]Skipped.[/dim]")
            return

    save_default_config()
    console.print(
        f"[green]✓ Config created:[/green] {CONFIG_PATH}"
    )
    console.print(
        "[dim]Edit it to customize theme, aliases, "
        "and LLM settings.[/dim]"
    )


def _start_server(args):
    """Start API server (serves UI if built)."""
    import shutil
    from pathlib import Path

    port = 8000
    no_browser = False
    clear_cache = False

    for arg in args[1:]:
        if arg == "--no-browser":
            no_browser = True
        elif arg == "--clear-cache":
            clear_cache = True
        elif arg.isdigit():
            port = int(arg)

    if clear_cache:
        ui_dist = (
            Path(__file__).parent
            / "ui" / "dist" / "ui" / "browser"
        )
        ui_bundled = (
            Path(__file__).parent / "api" / "ui_dist"
        )
        cleared = False
        for p in [ui_dist, ui_bundled]:
            if p.exists():
                shutil.rmtree(p)
                cleared = True
        if cleared:
            console.print(
                "[yellow]✓ Cleared UI dist cache[/yellow]"
            )
        else:
            console.print(
                "[dim]No UI dist cache to clear[/dim]"
            )

    try:
        from api.serve import start
        start(port=port, no_browser=no_browser)
    except ImportError:
        console.print(
            "[red]API dependencies not installed.[/red]\n"
            "Run: pip install 'kubsome[api]'"
        )


def _start_tui():
    """Launch full-screen TUI."""
    try:
        from tui.app import run_tui
        run_tui()
    except ImportError:
        console.print(
            "[red]TUI dependencies not installed.[/red]\n"
            "Run: pip install 'kubsome[tui]'"
        )


def _exec_mode(args):
    """Run a single command non-interactively."""
    if not args:
        console.print(
            "Usage: kubsome --exec \"<command>\""
        )
        return

    cmd_input = " ".join(args)
    command = resolve_command(cmd_input)

    if command and isinstance(command, str):
        execute(command)
    elif command:
        dispatch(command)
    else:
        console.print(f"[red]Unknown: {cmd_input}[/red]")


def _start_cli():
    """Interactive CLI mode."""
    # Startup health check
    ok, info = check_kubectl()
    if not ok:
        console.print(
            f"[red]✗ {info}[/red]\n"
            "[dim]Ensure kubectl is installed and "
            "configured[/dim]"
        )
        return

    if not context.current_context:
        context.current_context = info

    render_banner()
    create_default_workflows()

    # Pre-warm pod cache in background
    from core.cache import prewarm
    prewarm()

    # Check for updates (non-blocking)
    update = check_update()
    if update:
        latest, current = update
        console.print(
            f"[yellow]⬆ Update available:[/yellow] "
            f"[dim]{current}[/dim] → [green]{latest}[/green]  "
            f"[dim]Run:[/dim] pip install --upgrade kubsome\n"
        )

    # Start background scheduler
    from core.scheduler import get_scheduler
    get_scheduler().start()

    last_command = ""

    while True:
        env = _detect_env()
        prompt_text = f"[{env}] {context.namespace}"

        try:
            user_input = prompt(
                f"{prompt_text} > ",
                completer=command_completer,
                history=history
            )
        except (EOFError, KeyboardInterrupt):
            break

        if not user_input.strip():
            continue

        if user_input == "exit":
            break

        # Alias expansion
        user_input = resolve_alias(user_input, app_config)

        # Repeat last command
        if user_input == "!" and last_command:
            user_input = last_command
            console.print(f"[dim]→ {user_input}[/dim]")

        last_command = user_input

        # Command chaining (&&)
        commands_to_run = split_chain(user_input)

        for chain_cmd in commands_to_run:
            _execute_single(chain_cmd, env)


def _execute_single(user_input, env):
    """Execute a single command (used by chaining)."""
    # Built-in context commands
    if user_input == "contexts":
        render_contexts(enriched_contexts())
        return

    if user_input.startswith("switch "):
        _handle_switch(user_input)
        return

    if user_input.startswith("use "):
        _handle_use(user_input)
        return

    # Resolve command
    command = resolve_command(user_input)

    # Unified NLP fallback
    if not command:
        parsed = parse_query(user_input)
        if parsed and parsed["score"] >= 65:
            action = map_to_command(parsed)
            if action:
                intent = parsed["intent"]
                target = parsed["entities"].get(
                    "target", ""
                )
                console.print(
                    f"[dim]→ intent:{intent}"
                    f"{' target:' + target if target else ''}"
                    f"[/dim]"
                )
                if isinstance(action, str):
                    command = resolve_command(action)
                else:
                    command = action

    # Suggestion fallback
    if not command:
        suggestion = suggest_command(user_input)
        if suggestion:
            console.print(
                f"[yellow]Did you mean:[/yellow] "
                f"[cyan]{suggestion}[/cyan]"
            )
        else:
            console.print(
                "[red]Unknown command.[/red] "
                "Type [cyan]help[/cyan] for options."
            )
        # Track unresolved for NLP improvement
        from core.telemetry import track_unresolved
        track_unresolved(user_input)
        return

    # Execute
    start = time.time()
    if isinstance(command, str):
        # Try to extract target from command string for memory
        _update_context_memory_from_str(command)
        execute(command)
    else:
        # Update context memory from command dict
        if "target" in command:
            context.last_target = command["target"]

        dispatch(command, env)

    elapsed = time.time() - start
    if elapsed > 3:
        console.print(f"[dim]({elapsed:.1f}s)[/dim]")


def _detect_env():
    if not context.current_context:
        return "UNKNOWN"
    if "prd" in context.current_context:
        return "PROD"
    if "dev" in context.current_context:
        return "DEV"
    if "sit" in context.current_context:
        return "SIT"
    return "UNKNOWN"


def _handle_switch(user_input):
    query = user_input.replace("switch ", "")
    matches = find_context(query)
    if not matches:
        console.print("[red]No matching context[/red]")
        return
    ctx = choose_context(matches)
    if not ctx:
        return
    if not confirm_production(ctx):
        console.print("[yellow]Cancelled[/yellow]")
        return
    switch_context(ctx)
    console.print(
        f"[green]Switched to:[/green] {ctx['name']}"
    )


def _handle_use(user_input):
    namespace = user_input.split()[1]
    context.namespace = namespace
    save_state(context.current_context, context.namespace)
    console.print(
        f"[green]Switched namespace to[/green] "
        f"[cyan]{namespace}[/cyan]"
    )


def _update_context_memory_from_str(cmd_str):
    """Try to extract a resource target from a raw command string."""
    tokens = cmd_str.split()
    if not tokens:
        return

    # Simple heuristics for common commands: <cmd> <target>
    if tokens[0] in {
        "logs", "inspect", "describe", "diagnose",
        "restart", "rollback", "scale", "exec", "shell",
        "trace", "netcheck", "delete", "edit", "port-forward",
        "forward"
    } and len(tokens) > 1:
        # Handle cases like 'describe pod <name>'
        if tokens[1] in {"pod", "pods", "po", "deployment", "deploy", "svc", "service"} and len(tokens) > 2:
            context.last_target = tokens[2]
        else:
            context.last_target = tokens[1]


if __name__ == "__main__":
    main()
