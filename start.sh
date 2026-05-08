#!/bin/bash
# KubeEasy — Production build & serve on single port

set -e

DIR="$(cd "$(dirname "$0")" && pwd)"

echo "◆ KubeEasy Production Build"
echo "───────────────────────────"

# Build UI
echo "→ Building Angular UI..."
cd "$DIR/ui"
npx ng build --configuration production 2>&1 | tail -3

# Start server
echo "→ Starting server on :8000..."
cd "$DIR"
source venv/bin/activate
echo ""
echo "  Open: http://localhost:8000"
echo "  API:  http://localhost:8000/docs"
echo ""
uvicorn api.app:app --host 0.0.0.0 --port 8000
