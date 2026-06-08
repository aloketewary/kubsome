import subprocess
import json
import time
from core.execution.interfaces import VerifierInterface
from core.models.plan import RemediationPlan, LifecycleState
from core.execution.state_machine import StateMachine
from core.context import context

class KubectlVerifier(VerifierInterface):
    def verify(self, plan: RemediationPlan) -> bool:
        if not plan.verification_goal:
            return True

        target = plan.target
        timeout = plan.verification_goal.timeout_seconds
        start_time = time.time()

        StateMachine.transition(plan, LifecycleState.VERIFYING)

        while time.time() - start_time < timeout:
            # For ROLLING_RESTART, we check rollout status
            if self._check_rollout_status(target):
                return True

            time.sleep(5)

        StateMachine.transition(plan, LifecycleState.TIMED_OUT)
        return False

    def _check_rollout_status(self, target):
        cmd = [
            "kubectl", "--context", str(target.cluster or context.current_context),
            "rollout", "status", f"{target.kind}/{target.name}",
            "-n", str(target.namespace), "--timeout=10s"
        ]
        result = subprocess.run(cmd, capture_output=True, text=True)
        return result.returncode == 0
