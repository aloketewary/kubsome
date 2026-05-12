"""
Job & CronJob management — list, inspect, trigger.
"""

import subprocess
import json

from core.context import context


def list_cronjobs():
    """List all cronjobs in namespace."""
    ns = context.namespace
    ctx = context.current_context

    cmd = (
        f"kubectl --context {ctx} "
        f"get cronjobs -n {ns} -o json"
    )

    r = subprocess.run(
        cmd, shell=True,
        capture_output=True, text=True
    )

    if r.returncode != 0:
        return []

    data = json.loads(r.stdout)
    cronjobs = []

    for item in data.get("items", []):
        spec = item["spec"]
        status = item.get("status", {})

        last_schedule = status.get(
            "lastScheduleTime", "Never"
        )
        active = len(status.get("active", []))
        suspended = spec.get("suspend", False)

        cronjobs.append({
            "name": item["metadata"]["name"],
            "schedule": spec.get("schedule", ""),
            "suspended": suspended,
            "active": active,
            "last_schedule": last_schedule,
        })

    return cronjobs


def list_jobs(limit=20):
    """List recent jobs."""
    ns = context.namespace
    ctx = context.current_context

    cmd = (
        f"kubectl --context {ctx} "
        f"get jobs -n {ns} -o json"
    )

    r = subprocess.run(
        cmd, shell=True,
        capture_output=True, text=True
    )

    if r.returncode != 0:
        return []

    data = json.loads(r.stdout)
    jobs = []

    for item in data.get("items", [])[-limit:]:
        status = item.get("status", {})

        succeeded = status.get("succeeded", 0)
        failed = status.get("failed", 0)
        active = status.get("active", 0)

        if succeeded > 0:
            state = "Succeeded"
        elif failed > 0:
            state = "Failed"
        elif active > 0:
            state = "Running"
        else:
            state = "Pending"

        # Extract duration
        duration = ""
        start = status.get("startTime", "")
        completion = status.get("completionTime", "")
        if start and completion:
            from datetime import datetime
            try:
                t0 = datetime.fromisoformat(
                    start.replace("Z", "+00:00")
                )
                t1 = datetime.fromisoformat(
                    completion.replace("Z", "+00:00")
                )
                secs = int((t1 - t0).total_seconds())
                if secs < 60:
                    duration = f"{secs}s"
                elif secs < 3600:
                    duration = f"{secs // 60}m{secs % 60}s"
                else:
                    duration = f"{secs // 3600}h{(secs % 3600) // 60}m"
            except Exception:
                pass

        # Extract failure reason from conditions
        reason = ""
        message = ""
        for cond in status.get("conditions", []):
            if cond.get("type") == "Failed":
                reason = cond.get("reason", "")
                message = cond.get("message", "")
                break

        jobs.append({
            "name": item["metadata"]["name"],
            "state": state,
            "succeeded": succeeded,
            "failed": failed,
            "active": active,
            "duration": duration,
            "reason": reason,
            "message": message,
        })

    return jobs


def trigger_cronjob(name):
    """Manually trigger a cronjob."""
    ns = context.namespace
    ctx = context.current_context

    job_name = f"{name}-manual-trigger"

    cmd = (
        f"kubectl --context {ctx} "
        f"create job {job_name} "
        f"--from=cronjob/{name} "
        f"-n {ns}"
    )

    r = subprocess.run(
        cmd, shell=True,
        capture_output=True, text=True
    )

    return r.returncode == 0, r.stdout or r.stderr
