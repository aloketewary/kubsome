# Stage 1: Build Angular UI
FROM node:22-alpine AS ui-build
WORKDIR /app/ui
COPY ui/package*.json ./
RUN npm ci --legacy-peer-deps
COPY ui/ ./
RUN npm run build

# Stage 2: Python API
FROM python:3.11-slim
WORKDIR /app

ARG TARGETARCH=amd64
ARG KUBECTL_VERSION=v1.31.4

# Install a reproducible, checksum-verified kubectl for the target architecture.
RUN apt-get update && apt-get install -y --no-install-recommends curl ca-certificates && \
    curl -fsSLo /tmp/kubectl \
      "https://dl.k8s.io/release/${KUBECTL_VERSION}/bin/linux/${TARGETARCH}/kubectl" && \
    curl -fsSLo /tmp/kubectl.sha512 \
      "https://dl.k8s.io/release/${KUBECTL_VERSION}/bin/linux/${TARGETARCH}/kubectl.sha512" && \
    echo "$(cat /tmp/kubectl.sha512)  /tmp/kubectl" | sha512sum --check - && \
    install -m 0755 /tmp/kubectl /usr/local/bin/kubectl && \
    rm -f /tmp/kubectl /tmp/kubectl.sha512 && \
    apt-get purge -y --auto-remove curl && \
    rm -rf /var/lib/apt/lists/*

# Python deps
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# App code
COPY core/ core/
COPY api/ api/
COPY config/ config/
COPY plugins/ plugins/
COPY tui/ tui/
COPY main.py .
COPY pyproject.toml .
COPY README.md .

# Install local metadata so importlib.metadata reports the packaged version.
RUN pip install --no-cache-dir --no-deps .

# UI build output
COPY --from=ui-build /app/ui/dist/ui/browser api/ui_dist/

# Run without root privileges. HOME remains writable for token/config state.
RUN groupadd --system --gid 1000 kubsome && \
    useradd --system --uid 1000 --gid 1000 --home-dir /home/kubsome --create-home kubsome && \
    chown -R 1000:1000 /app /home/kubsome
ENV HOME=/home/kubsome
USER kubsome

EXPOSE 8000

CMD ["uvicorn", "api.app:app", "--host", "0.0.0.0", "--port", "8000"]
