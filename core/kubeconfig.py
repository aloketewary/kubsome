from pathlib import Path
import yaml


KUBECONFIG_PATH = (
    Path.home() / ".kube" / "config"
)


def load_kubeconfig():
    with open(KUBECONFIG_PATH, "r") as file:
        return yaml.safe_load(file)


def get_contexts():
    config = load_kubeconfig()

    contexts = []

    for item in config.get("contexts", []):

        ctx = item["context"]

        contexts.append({
            "name": item["name"],
            "cluster": ctx.get("cluster"),
            "namespace": ctx.get(
                "namespace",
                "default"
            ),
            "user": ctx.get("user")
        })

    return contexts

def detect_environment(name: str):
    name = name.lower()

    if "prd" in name or "prod" in name:
        return "PROD"

    if "sit" in name:
        return "SIT"

    if "dev" in name:
        return "DEV"

    if "cit" in name:
        return "CIT"

    return "UNKNOWN"

def risk_level(env: str):
    if env == "PROD":
        return "HIGH"

    if env in ["SIT", "CIT"]:
        return "MEDIUM"

    return "LOW"

def enriched_contexts():
    contexts = get_contexts()

    enriched = []

    for ctx in contexts:

        env = detect_environment(
            ctx["name"]
        )

        ctx["environment"] = env

        ctx["risk"] = risk_level(env)

        enriched.append(ctx)

    return enriched