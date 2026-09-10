#!/usr/bin/env bash
# Refresh the vendored copy of the shared UI library from a local checkout
# of predictsim-shared (expected as a sibling directory by default).
set -euo pipefail
SHARED_REPO="${SHARED_REPO:-../predictsim-shared}"
SRC="$SHARED_REPO/shared/src"
DEST="$(cd "$(dirname "$0")/.." && pwd)/src/shared"
[ -d "$SRC" ] || { echo "not found: $SRC (set SHARED_REPO)"; exit 1; }
rm -rf "$DEST"
cp -R "$SRC" "$DEST"
echo "synced $SRC -> $DEST"
