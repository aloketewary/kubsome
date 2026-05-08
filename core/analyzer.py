def analyze_pods(pods):

    healthy = 0
    warning = 0
    critical = 0

    for pod in pods:

        if pod["status"] != "Running":
            critical += 1

        elif pod["restarts"] >= 5:
            critical += 1

        elif pod["restarts"] >= 2:
            warning += 1

        else:
            healthy += 1

    return {
        "healthy": healthy,
        "warning": warning,
        "critical": critical
    }


def analyze_nodes(nodes):

    healthy = len([
        n for n in nodes
        if n["ready"]
    ])

    warning = len(nodes) - healthy

    return {
        "healthy": healthy,
        "warning": warning
    }


def analyze_deployments(deployments):

    healthy = 0
    unavailable = 0

    for dep in deployments:

        if dep["available"] < dep["desired"]:
            unavailable += 1
        else:
            healthy += 1

    return {
        "healthy": healthy,
        "unavailable": unavailable
    }