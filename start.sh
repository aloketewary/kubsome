#!/bin/bash
# Kubsome production build and serve on one port.

set -euo pipefail

DIR="$(cd "$(dirname "$0")" && pwd)"

printf 'Kubsome production build\n'
printf '%s\n' '───────────────────────────'

printf 'Building Angular UI...\n'
cd "$DIR/ui"
npm run build -- --configuration production

printf 'Replacing bundled UI resources...\n'
cd "$DIR"
bash "$DIR/scripts/sync-ui-dist.sh"

printf 'Starting server on :8000...\n'
source "$DIR/venv/bin/activate"
printf '\nOpen: http://localhost:8000\n'
printf 'API:  http://localhost:8000/docs\n\n'
uvicorn api.app:app --host 0.0.0.0 --port 8000
