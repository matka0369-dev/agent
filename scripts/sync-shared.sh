#!/usr/bin/env bash
# src/shared/ is a VENDORED copy of the shared UI library. Canonical source
# is the monorepo at ${SHARED_SRC:-/Users/chikki/Desktop/matka/web/packages/shared/src}.
set -euo pipefail
SRC="${SHARED_SRC:-/Users/chikki/Desktop/matka/web/packages/shared/src}"
DEST="$(cd "$(dirname "$0")/.." && pwd)/src/shared"
[ -d "$SRC" ] || { echo "not found: $SRC (set SHARED_SRC)"; exit 1; }
rm -rf "$DEST" && cp -R "$SRC" "$DEST"
echo "synced $SRC -> $DEST"
