import json
import os

STATE_FILE = os.path.expanduser(
    "~/.kubsome/state.json"
)


def load_state():
    if not os.path.exists(STATE_FILE):
        return {}

    with open(STATE_FILE, "r") as f:
        return json.load(f)


def save_state(current_context, namespace):
    state = {
        "current_context": current_context,
        "namespace": namespace
    }

    os.makedirs(
        os.path.dirname(STATE_FILE), exist_ok=True
    )

    with open(STATE_FILE, "w") as f:
        json.dump(state, f)
