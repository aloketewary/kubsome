from typing import Dict, List, Set
from core.models.plan import LifecycleState, RemediationPlan

class StateMachineError(Exception):
    pass

class StateMachine:
    # Allowed transitions: {current_state: {next_state, ...}}
    TRANSITIONS: Dict[LifecycleState, Set[LifecycleState]] = {
        LifecycleState.DRAFT: {
            LifecycleState.AWAITING_APPROVAL,
            LifecycleState.CANCELLED,
            LifecycleState.EXECUTING # Direct execution for low risk
        },
        LifecycleState.AWAITING_APPROVAL: {
            LifecycleState.EXECUTING,
            LifecycleState.CANCELLED
        },
        LifecycleState.EXECUTING: {
            LifecycleState.VERIFYING,
            LifecycleState.SUCCEEDED,
            LifecycleState.FAILED
        },
        LifecycleState.VERIFYING: {
            LifecycleState.SUCCEEDED,
            LifecycleState.FAILED,
            LifecycleState.TIMED_OUT,
            LifecycleState.ROLLING_BACK
        },
        LifecycleState.ROLLING_BACK: {
            LifecycleState.ROLLED_BACK,
            LifecycleState.FAILED
        },
        # Terminal states
        LifecycleState.SUCCEEDED: set(),
        LifecycleState.FAILED: set(),
        LifecycleState.TIMED_OUT: set(),
        LifecycleState.CANCELLED: set(),
        LifecycleState.ROLLED_BACK: set(),
    }

    @classmethod
    def transition(cls, plan: RemediationPlan, next_state: LifecycleState):
        """Transition a plan to a new state if allowed."""
        current = plan.state
        allowed = cls.TRANSITIONS.get(current, set())

        if next_state not in allowed:
            raise StateMachineError(
                f"Invalid transition from {current.value} to {next_state.value}"
            )

        plan.state = next_state
        return plan
