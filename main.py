"""
KubeEasy — AI-native Kubernetes Operational Workspace
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
        # Environment detection
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
    import sys

    if len(sys.argv) > 1 and sys.argv[1] == "serve":
        from api.serve import start
        port = int(sys.argv[2]) if len(sys.argv) > 2 else 8000
        start(port=port)
    elif len(sys.argv) > 1 and sys.argv[1] == "--exec":
        cmd_input = " ".join(sys.argv[2:])
        command = resolve_command(cmd_input)
        if command and isinstance(command, str):
            execute(command)
        elif command:
            dispatch(command)
    else:
        main()
