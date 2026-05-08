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
from core.ai.nlp import parse_natural_language
from core.ai.suggest import suggest_command
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


console = Console()
history = get_history()
app_config = load_config()


def main():
    import sys

    args = sys.argv[1:]

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


def _start_server(args):
    """Start API server (serves UI if built)."""
    port = int(args[1]) if len(args) > 1 else 8000

    console.print(
        Panel.fit(
            f"[bold green]Kubsome Server[/bold green]\n"
            f"[dim]API:[/dim]  http://localhost:{port}/api\n"
            f"[dim]UI:[/dim]   http://localhost:{port}\n"
            f"[dim]Docs:[/dim] http://localhost:{port}/docs",
            border_style="green"
        )
    )

    try:
        from api.serve import start
        start(port=port)
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

    # NLP fallback
    if not command:
        nlp_cmd = parse_natural_language(user_input)
        if nlp_cmd:
            console.print(f"[dim]→ {nlp_cmd}[/dim]")
            command = resolve_command(nlp_cmd)

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
        return

    # Execute
    if isinstance(command, str):
        execute(command)
    else:
        start = time.time()
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


if __name__ == "__main__":
    main()
