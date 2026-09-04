"""Application context with process-local defaults and request-scoped overrides."""

import contextvars
from contextlib import contextmanager
from urllib.parse import parse_qs

from core.state import load_state


class AppContext:
    def __init__(self):
        state = load_state()

        self.namespace = state.get("namespace", "default")
        self.current_context = state.get("current_context", None)
        self.kubeconfig = "~/.kube/config"

        # Contextual memory
        self.last_target = None
        self.last_intent = None
        self.conversation_targets = []

    def clone(self):
        """Create an isolated copy suitable for one request or WebSocket."""
        cloned = object.__new__(type(self))
        cloned.namespace = self.namespace
        cloned.current_context = self.current_context
        cloned.kubeconfig = self.kubeconfig
        cloned.last_target = self.last_target
        cloned.last_intent = self.last_intent
        cloned.conversation_targets = list(self.conversation_targets)
        return cloned

    def remember_target(self, target):
        """Track discussed resources for context memory."""
        if target and target != self.last_target:
            self.last_target = target
            self.conversation_targets = (
                [target] + [
                    item for item in self.conversation_targets
                    if item != target
                ]
            )[:5]


_default_context = AppContext()
_active_context = contextvars.ContextVar(
    "kubsome_context", default=None
)


class _ContextProxy:
    """Expose the legacy ``context.attribute`` API over scoped storage."""

    @staticmethod
    def _current():
        return _active_context.get() or _default_context

    def __getattr__(self, name):
        return getattr(self._current(), name)

    def __setattr__(self, name, value):
        setattr(self._current(), name, value)


context = _ContextProxy()


@contextmanager
def context_scope(context_name=None, namespace=None):
    """Bind an isolated context, optionally overriding cluster scope."""
    base = _active_context.get() or _default_context
    scoped = base.clone()
    if context_name:
        scoped.current_context = context_name
    if namespace:
        scoped.namespace = namespace

    token = _active_context.set(scoped)
    try:
        yield scoped
    finally:
        _active_context.reset(token)


class ContextMiddleware:
    """Apply client-selected context to each HTTP or WebSocket scope."""

    async def __call__(self, scope, receive, send):
        if scope["type"] not in {"http", "websocket"}:
            await self.app(scope, receive, send)
            return

        headers = {
            key.decode("latin-1").lower(): value.decode("latin-1")
            for key, value in scope.get("headers", [])
        }
        query = parse_qs(
            scope.get("query_string", b"").decode("latin-1"),
            keep_blank_values=False,
        )
        context_name = headers.get("x-kubsome-context") or query.get("context", [None])[0]
        namespace = headers.get("x-kubsome-namespace") or query.get("namespace", [None])[0]

        with context_scope(context_name, namespace):
            await self.app(scope, receive, send)

    def __init__(self, app):
        self.app = app
