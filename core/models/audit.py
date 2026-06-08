from dataclasses import dataclass
from datetime import datetime
from typing import Optional, Any
from core.models.plan import LifecycleState

@dataclass
class AuditRecord:
    id: str
    timestamp: datetime
    user: str
    action_type: str
    target: str
    plan_id: Optional[str] = None
    state: Optional[LifecycleState] = None
    details: Optional[Any] = None
    result: Optional[str] = None
