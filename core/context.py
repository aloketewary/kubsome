from core.state import load_state


class AppContext:
    def __init__(self):
        state = load_state()

        self.namespace = state.get(
            "namespace", "default"
        )
        self.current_context = state.get(
            "current_context", None
        )
        self.kubeconfig = "~/.kube/config"

        # Contextual memory
        self.last_target = None


context = AppContext()
