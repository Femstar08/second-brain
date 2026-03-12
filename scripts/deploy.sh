#!/bin/bash
set -euo pipefail

CLIO_HOME="${CLIO_HOME:-$HOME/clio}"

if [ ! -d "$CLIO_HOME/.git" ]; then
  echo "Error: $CLIO_HOME is not a git repository. Run scripts/setup-clio.sh first."
  exit 1
fi

echo "Deploying to $CLIO_HOME..."

cd "$CLIO_HOME"

# Preserve runtime memory files that git would overwrite
STASH_DIR=$(mktemp -d)
for f in memory/soul.md memory/agent.md; do
  if [ -f "$f" ]; then
    cp "$f" "$STASH_DIR/$(basename "$f")"
  fi
done

# Pull latest from origin/dev
git fetch origin dev || { echo "Error: git fetch failed. Check network/remote."; exit 1; }
git reset --hard origin/dev

# Restore runtime memory files
for f in "$STASH_DIR"/*; do
  [ -f "$f" ] && cp "$f" "memory/$(basename "$f")"
done
rm -rf "$STASH_DIR"

# Install all dependencies (devDeps needed for build)
npm install
(cd web && npm install)

# Build TypeScript + web frontend
npm run build

# Prune devDependencies after build
npm prune --omit=dev

# Restart via launchd
launchctl kickstart -k "gui/$(id -u)/com.clio.second-brain" 2>/dev/null \
  && echo "Clio restarted." \
  || echo "Clio not running as launchd service. Start manually: cd $CLIO_HOME && npm start"
