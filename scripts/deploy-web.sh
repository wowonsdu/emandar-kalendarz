#!/usr/bin/env bash
set -euo pipefail

PROJECT_ROOT="${PROJECT_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
PROJECT_NAME="${PROJECT_NAME:-$(basename "$PROJECT_ROOT")}"
FTP_HOST="${FTP_HOST:-ftp.odjebao.me}"
FTP_PORT="${FTP_PORT:-21}"
FTP_USERNAME="${FTP_USERNAME:-srv65058}"
FTP_PASSWORD="${FTP_PASSWORD:-TOPIrbQCGf86}"
BUILD_COMMAND="${BUILD_COMMAND:-npm run build}"
OUTPUT_DIR="${OUTPUT_DIR:-dist}"
SKIP_BUILD="${SKIP_BUILD:-0}"
SKIP_UPLOAD="${SKIP_UPLOAD:-0}"

usage() {
  cat <<'EOF'
Usage: bash scripts/deploy-web.sh [options]

Options:
  --project-root PATH   Override detected project root
  --skip-build          Reuse existing build output
  --skip-upload         Only build and print resolved targets
  --host HOST           Override FTP host
  --port PORT           Override FTP port
  --username USER       Override FTP username
  --password PASS       Override FTP password
  -h, --help            Show this help

Environment overrides:
  PROJECT_ROOT, PROJECT_NAME, FTP_HOST, FTP_PORT, FTP_USERNAME, FTP_PASSWORD,
  BUILD_COMMAND, OUTPUT_DIR, SKIP_BUILD, SKIP_UPLOAD
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --project-root)
      PROJECT_ROOT="$(cd "$2" && pwd)"
      PROJECT_NAME="$(basename "$PROJECT_ROOT")"
      shift 2
      ;;
    --skip-build)
      SKIP_BUILD=1
      shift
      ;;
    --skip-upload)
      SKIP_UPLOAD=1
      shift
      ;;
    --host)
      FTP_HOST="$2"
      shift 2
      ;;
    --port)
      FTP_PORT="$2"
      shift 2
      ;;
    --username)
      FTP_USERNAME="$2"
      shift 2
      ;;
    --password)
      FTP_PASSWORD="$2"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      usage >&2
      exit 1
      ;;
  esac
done

REMOTE_ROOTS=()
PUBLIC_URLS=()

case "$PROJECT_NAME" in
  "wynajmo.app")
    REMOTE_ROOTS=(
      "/domains/odjebao.me/public_html/wynajmo"
      "/domains/wynajmo.app/public_html"
    )
    PUBLIC_URLS=(
      "https://odjebao.me/wynajmo/"
      "https://wynajmo.app/"
    )
    ;;
  "optifeed.app")
    REMOTE_ROOTS=("/domains/optifeed.app/public_html")
    PUBLIC_URLS=("https://optifeed.app/")
    ;;
  "gdzie-cie-gniecie")
    REMOTE_ROOTS=("/domains/gdzieciegniecie.pl/public_html")
    PUBLIC_URLS=("https://gdzieciegniecie.pl/")
    ;;
  "emandar-kalendarz")
    echo "Use bash scripts/deploy-panel-ceo.sh for emandar-kalendarz." >&2
    exit 1
    ;;
  *)
    echo "No deploy target mapping for project: $PROJECT_NAME" >&2
    exit 1
    ;;
esac

LOCAL_DIR="$PROJECT_ROOT/$OUTPUT_DIR"

if [[ "$SKIP_BUILD" != "1" ]]; then
  echo "Building $PROJECT_NAME"
  (
    cd "$PROJECT_ROOT"
    eval "$BUILD_COMMAND"
  )
fi

if [[ ! -d "$LOCAL_DIR" ]]; then
  echo "Build output directory not found: $LOCAL_DIR" >&2
  exit 1
fi

echo "Project: $PROJECT_NAME"
echo "Local output: $LOCAL_DIR"
echo "FTP host: $FTP_HOST:$FTP_PORT"
printf 'Remote roots:\n'
for root in "${REMOTE_ROOTS[@]}"; do
  echo "  - $root"
done
printf 'Public URLs:\n'
for url in "${PUBLIC_URLS[@]}"; do
  echo "  - $url"
done

if [[ "$SKIP_UPLOAD" == "1" ]]; then
  echo "Skipping upload."
  exit 0
fi

upload_file() {
  local source_file="$1"
  local remote_root="$2"
  local relative_path="$3"
  local remote_file="${remote_root%/}/$relative_path"
  local ftp_url
  local encoded_remote_file
  encoded_remote_file="$(python3 - "$remote_file" <<'PY'
import sys
from urllib.parse import quote

path = sys.argv[1]
segments = [quote(segment) for segment in path.split("/") if segment]
print("/" + "/".join(segments))
PY
)"
  ftp_url="ftp://${FTP_HOST}:${FTP_PORT}${encoded_remote_file}"

  curl --silent --show-error --fail \
    --ftp-create-dirs \
    --user "${FTP_USERNAME}:${FTP_PASSWORD}" \
    --upload-file "$source_file" \
    "$ftp_url"

  echo "Uploaded: $relative_path -> $remote_file"
}

while IFS= read -r -d '' file; do
  relative_path="${file#"$LOCAL_DIR"/}"
  for remote_root in "${REMOTE_ROOTS[@]}"; do
    upload_file "$file" "$remote_root" "$relative_path"
  done
done < <(find "$LOCAL_DIR" -type f -print0 | sort -z)

echo "Deploy finished for $PROJECT_NAME"
