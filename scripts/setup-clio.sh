#!/bin/bash
set -euo pipefail

CLIO_HOME="${CLIO_HOME:-$HOME/clio}"
DEV_REPO="$(cd "$(dirname "$0")/.." && pwd)"
REMOTE_URL=$(cd "$DEV_REPO" && git remote get-url origin)

echo "=== Clio Runtime Setup ==="
echo "Production home: $CLIO_HOME"
echo "Dev repo: $DEV_REPO"
echo "Remote: $REMOTE_URL"
echo ""

# Step 1: Clone
if [ -d "$CLIO_HOME" ]; then
  echo "Directory $CLIO_HOME already exists. Skipping clone."
else
  echo "Cloning repository to $CLIO_HOME..."
  git clone "$REMOTE_URL" "$CLIO_HOME"
  cd "$CLIO_HOME"
  git checkout dev
fi

cd "$CLIO_HOME"

# Step 2: Copy runtime state from dev repo (if it exists there and not at destination)
for dir in store memory skills; do
  if [ -d "$DEV_REPO/$dir" ] && [ ! -d "$CLIO_HOME/$dir" ]; then
    echo "Copying $dir/ from dev repo..."
    cp -R "$DEV_REPO/$dir" "$CLIO_HOME/$dir"
  fi
done

for file in .env config.json; do
  if [ -f "$DEV_REPO/$file" ] && [ ! -f "$CLIO_HOME/$file" ]; then
    echo "Copying $file from dev repo..."
    cp "$DEV_REPO/$file" "$CLIO_HOME/$file"
  fi
done

# Step 3: Install dependencies and build
echo "Installing dependencies..."
npm install
(cd web && npm install)

echo "Building..."
npm run build

echo "Pruning dev dependencies..."
npm prune --omit=dev

# Step 4: Create logs directory
mkdir -p "$CLIO_HOME/logs"

# Step 5: Install launchd plist
NODE_PATH=$(which node)
PLIST_SRC="$DEV_REPO/scripts/com.clio.second-brain.plist"
PLIST_DST="$HOME/Library/LaunchAgents/com.clio.second-brain.plist"

if [ -f "$PLIST_SRC" ]; then
  sed -e "s|__CLIO_HOME__|$CLIO_HOME|g" \
      -e "s|/usr/local/bin/node|$NODE_PATH|g" \
      "$PLIST_SRC" > "$PLIST_DST"
  echo "Installed launchd plist to $PLIST_DST"
else
  echo "Warning: Plist template not found at $PLIST_SRC"
fi

# Step 6: Load and start (idempotent)
launchctl bootout "gui/$(id -u)/com.clio.second-brain" 2>/dev/null || true
launchctl bootstrap "gui/$(id -u)" "$PLIST_DST"

echo ""
echo "=== Setup Complete ==="
echo "Clio is running from $CLIO_HOME"
echo "To deploy updates: scripts/deploy.sh"
echo "To check status: launchctl list | grep clio"
echo "Logs: $CLIO_HOME/logs/"
