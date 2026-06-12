from enum import Enum
from dataclasses import dataclass, field
from typing import List, Optional
from datetime import datetime
import uuid

from core.models.resource import ResourceRef
from core.models.finding import Finding
from core.models.action import Action
from core.models.verification import VerificationGoal

class LifecycleState(Enum):
    DRAFT = "DRAFT"
    AWAITING_APPROVAL = "AWAITING_APPROVAL"
    CANCELLED = "CANCELLED"
    EXECUTING = "EXECUTING"
    VERIFYING = "VERIFYING"
    ROLLING_BACK = "ROLLING_BACK"
    ROLLED_BACK = "ROLLED_BACK"
    SUCCEEDED = "SUCCEEDED"
    FAILED = "FAILED"
    TIMED_OUT = "TIMED_OUT"

class RiskLevel(Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"

@dataclass
class RemediationPlan:
    id: str = field(default_factory=lambda: str(uuid.uuid4()))
    target: Optional[ResourceRef] = None
    findings: List[Finding] = field(default_factory=list)
    actions: List[Action] = field(default_factory=list)
    risk: RiskLevel = RiskLevel.LOW
    verification_goal: Optional[VerificationGoal] = None
    state: LifecycleState = LifecycleState.DRAFT
    created_at: datetime = field(default_factory=datetime.now)
    approved_at: Optional[datetime] = None
    approved_by: Optional[str] = None
    rollback_strategy: Optional[str] = None
