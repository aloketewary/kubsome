import subprocess
from datetime import datetime
from typing import Dict, Any
from core.execution.interfaces import ExecutorInterface
from core.models.action import Action, ActionType
from core.models.result import ExecutionResult
from core.models.plan import RemediationPlan
from core.context import context

class KubectlExecutor(ExecutorInterface):
    def execute_action(self, action: Action) -> Dict[str, Any]:
        command = self._map_action_to_command(action)
        if not command:
            return {"success": False, "output": f"Unsupported action type: {action.type}"}

        result = subprocess.run(
            command,
            shell=False,
            capture_output=True,
            text=True,
            timeout=30
        )

        return {
            "success": result.returncode == 0,
            "output": result.stdout or result.stderr,
            "timestamp": datetime.now().isoformat(),
            "command": " ".join(command)
        }

    def execute_plan(self, plan: RemediationPlan) -> ExecutionResult:
        res = ExecutionResult(plan_id=plan.id, started_at=datetime.now())

        for action in plan.actions:
            action_res = self.execute_action(action)
            res.actions_executed.append(action_res)
            if not action_res["success"]:
                res.success = False
                res.error = action_res["output"]
                break
        else:
            res.success = True

        res.completed_at = datetime.now()
        return res

    def _map_action_to_command(self, action: Action):
        target = action.target
        ctx = target.cluster or context.current_context
        ns = target.namespace

        if action.type == ActionType.ROLLING_RESTART:
            return [
                "kubectl", "--context", str(ctx),
                "rollout", "restart", f"{target.kind}/{target.name}",
                "-n", str(ns)
            ]
        elif action.type == ActionType.ROLLBACK:
            return [
                "kubectl", "--context", str(ctx),
                "rollout", "undo", f"{target.kind}/{target.name}",
                "-n", str(ns)
            ]
        elif action.type == ActionType.SCALE:
            replicas = action.parameters.get("replicas", 1)
            return [
                "kubectl", "--context", str(ctx),
                "scale", f"{target.kind}/{target.name}",
                f"--replicas={replicas}", "-n", str(ns)
            ]
        return None
