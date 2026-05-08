import json
import os

STATE_FILE = os.path.expanduser(
    "~/.kubeasy_state.json"
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

    with open(STATE_FILE, "w") as f:
        json.dump(state, f)
