"""
YAML Generator — produce Kubernetes manifests
from simple descriptions.
"""

from core.ai.llm import get_llm_provider


TEMPLATES = {
    "deployment": """apiVersion: apps/v1
kind: Deployment
metadata:
  name: {name}
  namespace: {namespace}
spec:
  replicas: {replicas}
  selector:
    matchLabels:
      app: {name}
  template:
    metadata:
      labels:
        app: {name}
    spec:
      containers:
      - name: {name}
        image: {image}
        ports:
        - containerPort: {port}
        resources:
          requests:
            cpu: 100m
            memory: 128Mi
          limits:
            cpu: 500m
            memory: 256Mi
""",
    "service": """apiVersion: v1
kind: Service
metadata:
  name: {name}
  namespace: {namespace}
spec:
  selector:
    app: {name}
  ports:
  - port: {port}
    targetPort: {port}
  type: ClusterIP
""",
    "cronjob": """apiVersion: batch/v1
kind: CronJob
metadata:
  name: {name}
  namespace: {namespace}
spec:
  schedule: "{schedule}"
  jobTemplate:
    spec:
      template:
        spec:
          containers:
          - name: {name}
            image: {image}
          restartPolicy: OnFailure
""",
    "configmap": """apiVersion: v1
kind: ConfigMap
metadata:
  name: {name}
  namespace: {namespace}
data:
  key: value
""",
    "ingress": """apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: {name}
  namespace: {namespace}
spec:
  rules:
  - host: {host}
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: {name}
            port:
              number: {port}
""",
}


def generate_manifest(kind, name, namespace="default", **kwargs):
    """
    Generate a YAML manifest from a template.
    Falls back to LLM for complex requests.
    """
    kind_lower = kind.lower()

    # Defaults
    params = {
        "name": name,
        "namespace": namespace,
        "replicas": kwargs.get("replicas", 2),
        "image": kwargs.get("image", f"{name}:latest"),
        "port": kwargs.get("port", 8080),
        "schedule": kwargs.get("schedule", "0 * * * *"),
        "host": kwargs.get("host", f"{name}.example.com"),
    }

    if kind_lower in TEMPLATES:
        return TEMPLATES[kind_lower].format(**params)

    # Try LLM for unknown types
    provider = get_llm_provider()
    if provider.available():
        prompt = (
            f"Generate a Kubernetes {kind} YAML manifest "
            f"named '{name}' in namespace '{namespace}'. "
            f"Keep it minimal and production-ready."
        )
        result = provider.query(prompt)
        if result:
            return result

    return None
