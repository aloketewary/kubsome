"""
Policy Engine — define and enforce cluster guardrails.

Policies stored in ~/.kubsome/policies.yaml or
.kubsome/policies.yaml (project-level, Git-synced).

Example:
  - name: no-latest-tag
    description: Reject deployments using :latest tag
    resource: deployment
    rule: no_latest_image
    severity: high

  - name: memory-limit-required
    description: All containers must have memory limits
    resource: deployment
    rule: memory_limits_set
    severity: medium

  - name: max-replicas
    description: No deployment should exceed 10 replicas
    resource: deployment
    rule: max_replicas
    params:
      max: 10
    severity: low
"""

import yaml
from pathlib import Path

from core.context import context


POLICIES_FILE_USER = Path.home() / ".kubsome" / "policies.yaml"
POLICIES_FILE_PROJECT = Path.cwd() / ".kubsome" / "policies.yaml"


def load_policies():
    """Load policies from user and project files."""
    policies = []
    for path in [POLICIES_FILE_PROJECT, POLICIES_FILE_USER]:
        if path.exists():
            try:
                with open(path, "r") as f:
                    data = yaml.safe_load(f) or []
                if isinstance(data, list):
                    for p in data:
                        p["source"] = str(path)
                    policies.extend(data)
            except Exception:
                pass
    return policies


def check_policies(resource_type="deployment"):
    """
    Run all policies against current cluster state.
    Returns list of violations.
    """
    import subprocess
    import json

    policies = load_policies()
    if not policies:
        return {"violations": [], "passed": 0, "total": 0}

    relevant = [
        p for p in policies
        if p.get("resource", "deployment") == resource_type
    ]

    if not relevant:
        return {"violations": [], "passed": len(policies), "total": len(policies)}

    # Fetch deployments
    cmd = (
        f"kubectl --context {context.current_context} "
        f"get deployments -n {context.namespace} -o json"
    )
    result = subprocess.run(
        cmd, shell=True, capture_output=True, text=True, timeout=15
    )
    if result.returncode != 0:
        return {"violations": [], "passed": 0, "total": len(relevant), "error": "Cannot fetch resources"}

    data = json.loads(result.stdout)
    items = data.get("items", [])

    violations = []
    passed = 0

    for policy in relevant:
        rule = policy.get("rule", "")
        params = policy.get("params", {})
        policy_violations = _run_rule(rule, items, params)

        if policy_violations:
            for v in policy_violations:
                violations.append({
                    "policy": policy["name"],
                    "description": policy.get("description", ""),
                    "severity": policy.get("severity", "medium"),
                    "resource": v["resource"],
                    "detail": v["detail"],
                })
        else:
            passed += 1

    return {
        "violations": violations,
        "passed": passed,
        "failed": len(relevant) - passed,
        "total": len(relevant),
    }


def _run_rule(rule, items, params):
    """Execute a policy rule against resources."""
    runners = {
        "no_latest_image": _rule_no_latest,
        "memory_limits_set": _rule_memory_limits,
        "cpu_limits_set": _rule_cpu_limits,
        "max_replicas": _rule_max_replicas,
        "no_privileged": _rule_no_privileged,
        "run_as_non_root": _rule_non_root,
        "read_only_root": _rule_read_only_root,
    }

    runner = runners.get(rule)
    if not runner:
        return []
    return runner(items, params)


def _rule_no_latest(items, params):
    violations = []
    for item in items:
        name = item["metadata"]["name"]
        containers = (
            item["spec"].get("template", {})
            .get("spec", {}).get("containers", [])
        )
        for c in containers:
            image = c.get("image", "")
            if image.endswith(":latest") or ":" not in image:
                violations.append({
                    "resource": name,
                    "detail": f"Container '{c['name']}' uses image '{image}' (no pinned tag)",
                })
    return violations


def _rule_memory_limits(items, params):
    violations = []
    for item in items:
        name = item["metadata"]["name"]
        containers = (
            item["spec"].get("template", {})
            .get("spec", {}).get("containers", [])
        )
        for c in containers:
            limits = c.get("resources", {}).get("limits", {})
            if "memory" not in limits:
                violations.append({
                    "resource": name,
                    "detail": f"Container '{c['name']}' has no memory limit",
                })
    return violations


def _rule_cpu_limits(items, params):
    violations = []
    for item in items:
        name = item["metadata"]["name"]
        containers = (
            item["spec"].get("template", {})
            .get("spec", {}).get("containers", [])
        )
        for c in containers:
            limits = c.get("resources", {}).get("limits", {})
            if "cpu" not in limits:
                violations.append({
                    "resource": name,
                    "detail": f"Container '{c['name']}' has no CPU limit",
                })
    return violations


def _rule_max_replicas(items, params):
    max_val = params.get("max", 10)
    violations = []
    for item in items:
        name = item["metadata"]["name"]
        replicas = item["spec"].get("replicas", 1)
        if replicas > max_val:
            violations.append({
                "resource": name,
                "detail": f"{replicas} replicas (max allowed: {max_val})",
            })
    return violations


def _rule_no_privileged(items, params):
    violations = []
    for item in items:
        name = item["metadata"]["name"]
        containers = (
            item["spec"].get("template", {})
            .get("spec", {}).get("containers", [])
        )
        for c in containers:
            sc = c.get("securityContext", {})
            if sc.get("privileged"):
                violations.append({
                    "resource": name,
                    "detail": f"Container '{c['name']}' runs privileged",
                })
    return violations


def _rule_non_root(items, params):
    violations = []
    for item in items:
        name = item["metadata"]["name"]
        pod_sc = (
            item["spec"].get("template", {})
            .get("spec", {}).get("securityContext", {})
        )
        if not pod_sc.get("runAsNonRoot"):
            violations.append({
                "resource": name,
                "detail": "Pod does not set runAsNonRoot: true",
            })
    return violations


def _rule_read_only_root(items, params):
    violations = []
    for item in items:
        name = item["metadata"]["name"]
        containers = (
            item["spec"].get("template", {})
            .get("spec", {}).get("containers", [])
        )
        for c in containers:
            sc = c.get("securityContext", {})
            if not sc.get("readOnlyRootFilesystem"):
                violations.append({
                    "resource": name,
                    "detail": f"Container '{c['name']}' does not use readOnlyRootFilesystem",
                })
    return violations
