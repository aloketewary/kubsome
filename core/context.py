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
        self.last_intent = None
        self.conversation_targets = []  # Last 5 discussed resources

    def remember_target(self, target):
        """Track discussed resources for context memory."""
        if target and target != self.last_target:
            self.last_target = target
            self.conversation_targets = (
                [target] + [
                    t for t in self.conversation_targets
                    if t != target
                ]
            )[:5]


context = AppContext()
