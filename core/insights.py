def pod_suggestion(pod):
    status = pod["status"]
    restarts = pod["restarts"]

    if status == "CrashLoopBackOff":
        return "Check logs"

    if restarts >= 5:
        return "Restart spike"

    if status == "Pending":
        return "Scheduling issue"

    return "Healthy"