from datetime import datetime
from core.models.plan import RemediationPlan, LifecycleState, RiskLevel
from core.models.action import Action, ActionType
from core.models.resource import ResourceRef
from core.models.verification import VerificationGoal, Verifier, Condition
from core.execution.state_machine import StateMachine
from core.execution.interfaces import ExecutorInterface, VerifierInterface
from core.audit import log_plan_transition

class ExecutionEngine:
    def __init__(self, executor: ExecutorInterface, verifier: VerifierInterface):
        self.executor = executor
        self.verifier = verifier

    def run(self, plan: RemediationPlan):
        """Main entry point for executing a plan."""

        # 1. Approval Check (Simplified for now)
        if plan.risk != RiskLevel.LOW and plan.state == LifecycleState.DRAFT:
             StateMachine.transition(plan, LifecycleState.AWAITING_APPROVAL)
             # In a real app, we'd stop here and wait for a user action.
             # For CLI demo, we'll assume approval is handled by the caller.

        # 2. Execution
        StateMachine.transition(plan, LifecycleState.EXECUTING)
        log_plan_transition(plan.id, "execution_start", str(plan.target), plan.state)

        result = self.executor.execute_plan(plan)

        if not result.success:
            StateMachine.transition(plan, LifecycleState.FAILED)
            log_plan_transition(plan.id, "execution_failed", str(plan.target), plan.state, result.error)
            return result

        # 3. Verification
        if plan.verification_goal:
            success = self.verifier.verify(plan)
            if not success:
                # State handled by verifier (FAILED or TIMED_OUT)
                log_plan_transition(plan.id, "verification_failed", str(plan.target), plan.state)
                result.success = False
                result.error = "Verification failed"
                return result

        StateMachine.transition(plan, LifecycleState.SUCCEEDED)
        log_plan_transition(plan.id, "execution_success", str(plan.target), plan.state)
        result.success = True
        return result
