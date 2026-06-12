from dataclasses import dataclass
from typing import Optional

@dataclass(frozen=True)
class ResourceRef:
    kind: str
    name: str
    namespace: str
    cluster: Optional[str] = None

    def __str__(self):
        return f"{self.kind}/{self.name} (ns:{self.namespace})"
