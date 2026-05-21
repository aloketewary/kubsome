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


def is_safe_url(url, allow_loopback=False, allow_private=False):
    """
    Check if a URL is safe for outbound requests (prevent SSRF).
    Blocks non-HTTP(S) schemes and restricted IP ranges by default.
    """
    from urllib.parse import urlparse
    import socket
    import ipaddress

    try:
        parsed = urlparse(url)
        if parsed.scheme not in ("http", "https"):
            return False

        hostname = parsed.hostname
        if not hostname:
            return False

        # Resolve hostname to IP
        # We use getaddrinfo to handle both IPv4 and IPv6
        addr_info = socket.getaddrinfo(
            hostname,
            parsed.port or (80 if parsed.scheme == "http" else 443)
        )
        for _, _, _, _, sockaddr in addr_info:
            ip_str = sockaddr[0]
            ip = ipaddress.ip_address(ip_str)

            if ip.is_loopback and not allow_loopback:
                return False

            if ip.is_private and not allow_private:
                return False

            if ip.is_reserved or ip.is_multicast or ip.is_link_local:
                return False

            # Block cloud metadata services (e.g. 169.254.169.254)
            if ip_str == "169.254.169.254":
                return False

        return True
    except Exception:
        return False
