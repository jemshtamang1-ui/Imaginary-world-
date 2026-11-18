#!/usr/bin/env bash
# Scaffold a new film from the template (baked cloud atlas and wipes included, so no bake needed).
# Usage: bash .claude/skills/motion-reel/scripts/new_project.sh reels/my-film
set -euo pipefail
DEST=${1:?usage: new_project.sh <dir>}
SKILL=$(cd "$(dirname "$0")/.." && pwd)
mkdir -p "$DEST"
tar -C "$SKILL/template" --exclude=node_modules --exclude=work --exclude='out*.mp4' -cf - . | tar -C "$DEST" -xf -
ln -sfn "$(python3 -c "import os,sys; print(os.path.relpath(sys.argv[1], sys.argv[2]))" "$SKILL/scripts" "$DEST")" "$DEST/scripts"
(cd "$DEST" && npm install --silent)
echo "ready: cd $DEST && node server.mjs 8123"
