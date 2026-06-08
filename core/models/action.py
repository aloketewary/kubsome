from enum import Enum
from dataclasses import dataclass, field
from typing import Dict, Any
from core.models.resource import ResourceRef

class ActionType(Enum):
    ROLLING_RESTART = "ROLLING_RESTART"
    ROLLBACK = "ROLLBACK"
    SCALE = "SCALE"
    PATCH = "PATCH"
    DELETE = "DELETE"
    ANNOTATE = "ANNOTATE"
    SET_IMAGE = "SET_IMAGE"

@dataclass
class Action:
    type: ActionType
    target: ResourceRef
    description: str = ""
    parameters: Dict[str, Any] = field(default_factory=dict)
