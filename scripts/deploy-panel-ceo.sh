#!/usr/bin/env bash
set -euo pipefail

PROJECT_ROOT="${PROJECT_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
REMOTE_HOST="${REMOTE_HOST:-root@51.68.143.29}"
REMOTE_DIR="${REMOTE_DIR:-/opt/panel.ceo/emandar}"
PUBLIC_URL="${PUBLIC_URL:-https://panel.ceo/emandar/}"
SKIP_BUILD="${SKIP_BUILD:-0}"

if [[ "${1:-}" == "--skip-build" ]]; then
  SKIP_BUILD=1
fi

if [[ "$SKIP_BUILD" != "1" ]]; then
  (
    cd "$PROJECT_ROOT"
    npm run build
  )
fi

if [[ ! -d "$PROJECT_ROOT/dist" ]]; then
  echo "Missing dist/ build output" >&2
  exit 1
fi

backup_stamp="$(date +%Y%m%d-%H%M%S)"

ssh "$REMOTE_HOST" "set -euo pipefail; cp -a '$REMOTE_DIR' '${REMOTE_DIR}-backup-${backup_stamp}'"
rsync -az --delete "$PROJECT_ROOT/dist/" "$REMOTE_HOST:$REMOTE_DIR/"

echo "Deployed to $PUBLIC_URL"
curl -fsSL "$PUBLIC_URL" | sed -n '1,12p'
