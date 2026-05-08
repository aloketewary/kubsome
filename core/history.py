from pathlib import Path
from prompt_toolkit.history import FileHistory

HISTORY_FILE = Path.home() / ".kubsome" / "history"


def get_history():
    """Return a FileHistory instance for prompt_toolkit."""
    HISTORY_FILE.parent.mkdir(
        parents=True, exist_ok=True
    )
    return FileHistory(str(HISTORY_FILE))
