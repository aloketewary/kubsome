from dataclasses import dataclass, field
from typing import List, Optional

@dataclass
class Condition:
    type: str
    params: dict = field(default_factory=dict)

@dataclass
class Verifier:
    type: str
    conditions: List[Condition] = field(default_factory=list)

@dataclass
class VerificationGoal:
    verifiers: List[Verifier] = field(default_factory=list)
    timeout_seconds: int = 300
    success_conditions: List[Condition] = field(default_factory=list)
    failure_conditions: List[Condition] = field(default_factory=list)
