#!/usr/bin/env bash
# Replace bundled Angular assets with one validated build artifact.

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SOURCE_DIR="${ROOT_DIR}/ui/dist/ui/browser"
TARGET_DIR="${ROOT_DIR}/api/ui_dist"
TEMP_DIR=""
BACKUP_DIR=""

fail() {
  echo "sync-ui-dist: $1" >&2
  exit 1
}

[[ -d "${ROOT_DIR}/api" ]] || fail "api directory not found"
[[ -f "${SOURCE_DIR}/index.html" ]] || fail "Angular build not found at ${SOURCE_DIR}. Run the production UI build first."

TEMP_DIR="$(mktemp -d "${ROOT_DIR}/api/.ui_dist.tmp.XXXXXX")"
cleanup() {
  if [[ -n "${TEMP_DIR}" && -e "${TEMP_DIR}" ]]; then
    rm -rf "${TEMP_DIR}"
  fi
  if [[ -n "${BACKUP_DIR}" && -e "${BACKUP_DIR}" ]]; then
    rm -rf "${BACKUP_DIR}"
  fi
}
trap cleanup EXIT

cp -R "${SOURCE_DIR}/." "${TEMP_DIR}/"
[[ -f "${TEMP_DIR}/index.html" ]] || fail "copied artifact has no index.html"
find "${TEMP_DIR}" -type f -print -quit | grep -q . || fail "copied artifact is empty"

if [[ -e "${TARGET_DIR}" ]]; then
  BACKUP_DIR="${TARGET_DIR}.previous.$$"
  mv "${TARGET_DIR}" "${BACKUP_DIR}"
fi

if ! mv "${TEMP_DIR}" "${TARGET_DIR}"; then
  if [[ -n "${BACKUP_DIR}" && ! -e "${TARGET_DIR}" ]]; then
    mv "${BACKUP_DIR}" "${TARGET_DIR}"
  fi
  fail "could not replace ${TARGET_DIR}"
fi

TEMP_DIR=""
echo "sync-ui-dist: copied ${SOURCE_DIR} -> ${TARGET_DIR}"
