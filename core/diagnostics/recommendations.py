def recommend(pod):

    status = pod["status"]["phase"]

    container_statuses = pod["status"].get(
        "containerStatuses",
        []
    )

    if container_statuses:

        waiting = (
            container_statuses[0]
            .get("state", {})
            .get("waiting")
        )

        if waiting:

            reason = waiting.get("reason")

            if reason == "CrashLoopBackOff":
                return (
                    "Container crashing repeatedly. "
                    "Check application startup logs."
                )

            if reason == "ImagePullBackOff":
                return (
                    "Container image pull failing."
                )

    if status == "Pending":
        return (
            "Pod scheduling issue."
        )

    return "Healthy"