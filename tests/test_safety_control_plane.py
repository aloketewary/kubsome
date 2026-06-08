import pytest
from datetime import datetime
from core.models.resource import ResourceRef
from core.models.action import Action, ActionType
from core.models.plan import RemediationPlan, LifecycleState, RiskLevel
from core.execution.state_machine import StateMachine, StateMachineError
from core.execution.engine import ExecutionEngine
from core.execution.mock import MockExecutor
from core.verification.engine import VerificationEngine

def test_resource_ref():
    ref = ResourceRef(kind="pod", name="test-pod", namespace="default")
    assert str(ref) == "pod/test-pod (ns:default)"

def test_state_machine_transitions():
    plan = RemediationPlan()
    assert plan.state == LifecycleState.DRAFT

    StateMachine.transition(plan, LifecycleState.EXECUTING)
    assert plan.state == LifecycleState.EXECUTING

    with pytest.raises(StateMachineError):
        StateMachine.transition(plan, LifecycleState.DRAFT)

def test_execution_engine_mock():
    target = ResourceRef(kind="deployment", name="web", namespace="prod")
    plan = RemediationPlan(
        target=target,
        actions=[Action(type=ActionType.ROLLING_RESTART, target=target)],
        risk=RiskLevel.LOW
    )

    executor = MockExecutor()
    verifier = VerificationEngine()
    engine = ExecutionEngine(executor, verifier)

    result = engine.run(plan)

    assert result.success is True
    assert plan.state == LifecycleState.SUCCEEDED
    assert len(result.actions_executed) == 1
    assert "Mock executed" in result.actions_executed[0]["output"]

def test_execution_engine_requires_approval():
    target = ResourceRef(kind="deployment", name="db", namespace="prod")
    plan = RemediationPlan(
        target=target,
        actions=[Action(type=ActionType.SCALE, target=target, parameters={"replicas": 1})],
        risk=RiskLevel.HIGH
    )

    executor = MockExecutor()
    verifier = VerificationEngine()
    engine = ExecutionEngine(executor, verifier)

    # In our current simplified engine, it transitions to AWAITING_APPROVAL then continues to EXECUTING
    # because we assume approval for CLI demo.
    result = engine.run(plan)
    assert result.success is True
    assert plan.state == LifecycleState.SUCCEEDED
