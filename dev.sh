#!/bin/bash
# Kubsome — Start both API and UI in development mode

set -e

DIR="$(cd "$(dirname "$0")" && pwd)"

echo "◆ Kubsome Dev Server"
echo "─────────────────────"

# Start API
echo "→ Starting API on :8000..."
cd "$DIR"
source venv/bin/activate
uvicorn api.app:app --reload --port 8000 &
API_PID=$!

# Start UI
echo "→ Starting UI on :3001..."
cd "$DIR/ui"
npx ng serve --port 3001 --open &
UI_PID=$!

echo ""
echo "  API: http://localhost:8000/docs"
echo "  UI:  http://localhost:3001"
echo "  ⌘K to search, H for help"
echo ""
echo "Press Ctrl+C to stop both."

trap "kill $API_PID $UI_PID 2>/dev/null; exit" INT TERM
wait
