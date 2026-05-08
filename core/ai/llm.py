"""
LLM Provider — supports only:
- local: rule-based intelligence (default, always works)
- ollama: local LLM server (if running on localhost)

No cloud APIs. No API keys. Fully offline-capable.

Configure in ~/.kubeasy/config.yaml:
  llm:
    provider: local       # default, no server needed
    # provider: ollama    # if you have Ollama running
    # model: llama3       # model name for Ollama
    # url: http://localhost:11434
"""

import json
import urllib.request
import urllib.error

from core.config import load_config


def get_llm_provider():
    """Get configured LLM provider."""
    config = load_config()
    llm_config = config.get("llm", {})
    provider = llm_config.get("provider", "local")

    if provider == "ollama":
        return OllamaProvider(llm_config)

    return LocalProvider()


class LocalProvider:
    """Rule-based — no server needed."""

    def query(self, prompt, context_data=""):
        return None  # Signals to use rule-based engine

    def available(self):
        return True


class OllamaProvider:
    """Local Ollama server (http://localhost:11434)."""

    def __init__(self, config):
        self.model = config.get("model", "llama3")
        self.url = config.get(
            "url", "http://localhost:11434"
        )

    def available(self):
        """Check if Ollama is running."""
        try:
            req = urllib.request.Request(
                f"{self.url}/api/tags",
                method="GET"
            )
            urllib.request.urlopen(req, timeout=2)
            return True
        except Exception:
            return False

    def query(self, prompt, context_data=""):
        if not self.available():
            return None

        full_prompt = prompt
        if context_data:
            full_prompt = (
                f"Context:\n{context_data}\n\n"
                f"{prompt}"
            )

        try:
            payload = json.dumps({
                "model": self.model,
                "prompt": (
                    "You are a Kubernetes operations expert. "
                    "Be concise. Use bullet points.\n\n"
                    f"{full_prompt}"
                ),
                "stream": False,
            }).encode()

            req = urllib.request.Request(
                f"{self.url}/api/generate",
                data=payload,
                headers={"Content-Type": "application/json"},
                method="POST"
            )

            response = urllib.request.urlopen(
                req, timeout=30
            )
            result = json.loads(response.read())
            return result.get("response", "")

        except Exception:
            return None
