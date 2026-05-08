import questionary


def confirm_production(ctx):
    env = ctx.get("environment", "")
    risk = ctx.get("risk", "LOW")
    name = ctx.get("name", "")

    if env == "PROD" or risk == "HIGH":
        return questionary.confirm(
            f"⚠ PRODUCTION ACTION"
            f"{' (' + name + ')' if name else ''}"
            f" — Continue?"
        ).ask()

    return True
