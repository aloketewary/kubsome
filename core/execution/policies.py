from dataclasses import dataclass, field
from typing import List
from core.models.plan import RiskLevel

@dataclass
class ApprovalPolicy:
    require_approval: bool = True
    environments: List[str] = field(default_factory=lambda: ["prod", "prd"])
    risk_threshold: RiskLevel = RiskLevel.MEDIUM
