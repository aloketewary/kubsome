# Stage 1: Build Angular UI
FROM node:20-alpine AS ui-build
WORKDIR /app/ui
COPY ui/package*.json ./
RUN npm ci
COPY ui/ ./
RUN npx ng build --configuration production

# Stage 2: Python API
FROM python:3.11-slim
WORKDIR /app

# Install kubectl
RUN apt-get update && apt-get install -y curl && \
    curl -LO "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl" && \
    chmod +x kubectl && mv kubectl /usr/local/bin/ && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

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

# UI build output
COPY --from=ui-build /app/ui/dist/ui/browser api/ui_dist/

EXPOSE 8000

CMD ["uvicorn", "api.app:app", "--host", "0.0.0.0", "--port", "8000"]
