#!/usr/bin/env bash
set -euo pipefail

PROJECT_ROOT="${PROJECT_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
NVM_DIR="${NVM_DIR:-$HOME/.nvm}"

if [[ -d "$NVM_DIR/versions/node" ]]; then
  node22_dir="$(find "$NVM_DIR/versions/node" -maxdepth 1 -type d -name 'v22.*' | sort -V | tail -n 1 || true)"

  if [[ -n "${node22_dir:-}" ]]; then
    export PATH="$node22_dir/bin:$PATH"
  fi
fi

export NODE_NO_WARNINGS="${NODE_NO_WARNINGS:-1}"

exec "$PROJECT_ROOT/node_modules/.bin/firebase" "$@"
