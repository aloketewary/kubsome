from dataclasses import dataclass, field
from typing import List, Any

@dataclass
class Evidence:
    type: str  # log, event, metric, etc.
    content: Any
    timestamp: str

@dataclass
class Finding:
    reason: str
    confidence: float
    evidence: List[Evidence] = field(default_factory=list)
    title: str = ""
    detail: str = ""
