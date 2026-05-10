import subprocess
import json

from core.context import context


def trace_resource(name):
    """
    Trace relationships for a given resource name.
    Searches: deployment, service, ingress, pods.
    Returns a relationship map.
    """
    ns = context.namespace
    ctx = context.current_context

    result = {
        "name": name,
        "deployment": None,
        "replicasets": [],
        "pods": [],
        "service": None,
        "ingress": None,
        "configmaps": [],
        "secrets": [],
    }

    # Find deployment
    dep = _get_resource(
        "deployment", name, ns, ctx
    )
    if dep:
        result["deployment"] = {
            "name": dep["metadata"]["name"],
            "replicas": dep["spec"].get("replicas", 0),
            "image": _get_image(dep),
            "labels": dep["spec"].get(
                "selector", {}
            ).get("matchLabels", {}),
        }

        # Find replicasets owned by this deployment
        result["replicasets"] = _find_replicasets(
            dep["metadata"]["name"], ns, ctx
        )

        # Find pods by selector
        labels = dep["spec"].get(
            "selector", {}
        ).get("matchLabels", {})
        result["pods"] = _find_pods_by_labels(
            labels, ns, ctx
        )

        # Find volumes (configmaps/secrets)
        volumes = dep["spec"].get(
            "template", {}
        ).get("spec", {}).get("volumes", [])
        for v in volumes:
            if "configMap" in v:
                result["configmaps"].append(
                    v["configMap"]["name"]
                )
            if "secret" in v:
                result["secrets"].append(
                    v["secret"]["secretName"]
                )

    # Find service
    result["service"] = _find_service(name, ns, ctx)

    # Find ingress
    result["ingress"] = _find_ingress(name, ns, ctx)

    return result


def _get_resource(kind, name, ns, ctx):
    cmd = (
        f"kubectl --context {ctx} "
        f"get {kind} {name} "
        f"-n {ns} -o json"
    )
    r = subprocess.run(
        cmd, shell=True,
        capture_output=True, text=True
    )
    if r.returncode != 0:
        return None
    return json.loads(r.stdout)


def _find_replicasets(dep_name, ns, ctx):
    cmd = (
        f"kubectl --context {ctx} "
        f"get replicasets -n {ns} -o json"
    )
    r = subprocess.run(
        cmd, shell=True,
        capture_output=True, text=True
    )
    if r.returncode != 0:
        return []

    data = json.loads(r.stdout)
    results = []
    for item in data.get("items", []):
        owners = item["metadata"].get(
            "ownerReferences", []
        )
        for owner in owners:
            if (
                owner.get("kind") == "Deployment"
                and owner.get("name") == dep_name
            ):
                results.append({
                    "uid": item["metadata"].get("uid"),
                    "name": item["metadata"]["name"],
                    "replicas": item["status"].get(
                        "replicas", 0
                    ),
                    "ready": item["status"].get(
                        "readyReplicas", 0
                    ),
                })
    return results


def _find_pods_by_labels(labels, ns, ctx):
    if not labels:
        return []

    selector = ",".join(
        f"{k}={v}" for k, v in labels.items()
    )
    cmd = (
        f"kubectl --context {ctx} "
        f"get pods -n {ns} "
        f"-l {selector} -o json"
    )
    r = subprocess.run(
        cmd, shell=True,
        capture_output=True, text=True
    )
    if r.returncode != 0:
        return []

    data = json.loads(r.stdout)
    pods = []
    for item in data.get("items", []):
        owners = item["metadata"].get("ownerReferences", [])
        owner_uid = owners[0].get("uid") if owners else None
        pods.append({
            "name": item["metadata"]["name"],
            "status": item["status"].get(
                "phase", "Unknown"
            ),
            "ip": item["status"].get("podIP", ""),
            "owner_uid": owner_uid
        })
    return pods


def _find_service(name, ns, ctx):
    cmd = (
        f"kubectl --context {ctx} "
        f"get services -n {ns} -o json"
    )
    r = subprocess.run(
        cmd, shell=True,
        capture_output=True, text=True
    )
    if r.returncode != 0:
        return None

    data = json.loads(r.stdout)
    for item in data.get("items", []):
        svc_name = item["metadata"]["name"]
        if name in svc_name:
            ports = [
                f"{p.get('port')}/{p.get('protocol', 'TCP')}"
                for p in item["spec"].get("ports", [])
            ]
            return {
                "name": svc_name,
                "type": item["spec"].get(
                    "type", "ClusterIP"
                ),
                "cluster_ip": item["spec"].get(
                    "clusterIP", ""
                ),
                "ports": ports,
            }
    return None


def _find_ingress(name, ns, ctx):
    cmd = (
        f"kubectl --context {ctx} "
        f"get ingress -n {ns} -o json"
    )
    r = subprocess.run(
        cmd, shell=True,
        capture_output=True, text=True
    )
    if r.returncode != 0:
        return None

    data = json.loads(r.stdout)
    for item in data.get("items", []):
        rules = item["spec"].get("rules", [])
        for rule in rules:
            paths = rule.get(
                "http", {}
            ).get("paths", [])
            for path in paths:
                backend = path.get(
                    "backend", {}
                ).get("service", {})
                if name in backend.get("name", ""):
                    return {
                        "name": item["metadata"]["name"],
                        "host": rule.get("host", ""),
                        "path": path.get("path", "/"),
                        "service": backend.get("name", ""),
                    }
    return None


def _get_image(dep):
    containers = dep["spec"].get(
        "template", {}
    ).get("spec", {}).get("containers", [])
    if containers:
        return containers[0].get("image", "")
    return ""
