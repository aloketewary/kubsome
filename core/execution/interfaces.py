from abc import ABC, abstractmethod
from typing import List, Dict, Any
from core.models.action import Action
from core.models.result import ExecutionResult
from core.models.plan import RemediationPlan

class ExecutorInterface(ABC):
    @abstractmethod
    def execute_action(self, action: Action) -> Dict[str, Any]:
        """Execute a single intent-based action."""
        pass

    @abstractmethod
    def execute_plan(self, plan: RemediationPlan) -> ExecutionResult:
        """Execute all actions in a plan and return result."""
        pass

class VerifierInterface(ABC):
    @abstractmethod
    def verify(self, plan: RemediationPlan) -> bool:
        """Verify the health of the target resource after execution."""
        pass
