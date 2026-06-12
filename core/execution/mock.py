from datetime import datetime
from typing import Dict, Any
from core.execution.interfaces import ExecutorInterface
from core.models.action import Action
from core.models.result import ExecutionResult
from core.models.plan import RemediationPlan, LifecycleState

class MockExecutor(ExecutorInterface):
    def execute_action(self, action: Action) -> Dict[str, Any]:
        return {
            "success": True,
            "output": f"Mock executed {action.type.value} on {action.target}",
            "timestamp": datetime.now().isoformat()
        }

    def execute_plan(self, plan: RemediationPlan) -> ExecutionResult:
        result = ExecutionResult(
            plan_id=plan.id,
            started_at=datetime.now()
        )

        for action in plan.actions:
            action_res = self.execute_action(action)
            result.actions_executed.append(action_res)
            if not action_res["success"]:
                result.success = False
                result.error = action_res.get("output")
                break
        else:
            result.success = True

        result.completed_at = datetime.now()
        return result
