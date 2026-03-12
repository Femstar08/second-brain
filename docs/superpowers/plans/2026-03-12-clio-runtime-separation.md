# Clio Runtime Separation Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create scripts to run Clio as a separate production instance, deployable independently from the development repo.

**Architecture:** Three shell scripts in `scripts/` — a launchd plist template, a one-time setup script, and a deploy script. No application code changes.

**Tech Stack:** Bash, macOS launchd, git

---

## File Structure

| File | Responsibility |
|------|---------------|
| `scripts/com.clio.second-brain.plist` | macOS LaunchAgent template — auto-start, auto-restart, logging |
| `scripts/setup-clio.sh` | One-time: clone repo, copy runtime state, build, install launchd service |
| `scripts/deploy.sh` | Repeatable: pull latest code, preserve runtime state, build, restart |

---

## Chunk 1: All Scripts

### Task 1: Create launchd plist template

**Files:**
- Create: `scripts/com.clio.second-brain.plist`

- [ ] **Step 1: Create the scripts directory**

```bash
mkdir -p scripts
```

- [ ] **Step 2: Create the plist file**

Create `scripts/com.clio.second-brain.plist`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>com.clio.second-brain</string>

  <key>ProgramArguments</key>
  <array>
    <string>/usr/local/bin/node</string>
    <string>dist/index.js</string>
  </array>

  <key>WorkingDirectory</key>
  <string>__CLIO_HOME__</string>

  <key>EnvironmentVariables</key>
  <dict>
    <key>NODE_ENV</key>
    <string>production</string>
    <key>PATH</key>
    <string>/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin</string>
  </dict>

  <key>RunAtLoad</key>
  <true/>

  <key>KeepAlive</key>
  <true/>

  <key>StandardOutPath</key>
  <string>__CLIO_HOME__/logs/stdout.log</string>

  <key>StandardErrorPath</key>
  <string>__CLIO_HOME__/logs/stderr.log</string>

  <key>ThrottleInterval</key>
  <integer>10</integer>
</dict>
</plist>
```

Placeholders `__CLIO_HOME__` and `/usr/local/bin/node` are substituted by the setup script.

- [ ] **Step 3: Commit**

```bash
git add scripts/com.clio.second-brain.plist
git commit -m "feat: add launchd plist template for Clio service"
```

---

### Task 2: Create setup script

**Files:**
- Create: `scripts/setup-clio.sh`

- [ ] **Step 1: Create the setup script**

Create `scripts/setup-clio.sh`:

```bash
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
```

- [ ] **Step 2: Make it executable**

```bash
chmod +x scripts/setup-clio.sh
```

- [ ] **Step 3: Commit**

```bash
git add scripts/setup-clio.sh
git commit -m "feat: add one-time Clio runtime setup script"
```

---

### Task 3: Create deploy script

**Files:**
- Create: `scripts/deploy.sh`

- [ ] **Step 1: Create the deploy script**

Create `scripts/deploy.sh`:

```bash
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
```

- [ ] **Step 2: Make it executable**

```bash
chmod +x scripts/deploy.sh
```

- [ ] **Step 3: Commit**

```bash
git add scripts/deploy.sh
git commit -m "feat: add Clio deploy script"
```

---

### Task 4: Run setup and verify

This task is manual — run by the user, not automated.

- [ ] **Step 1: Push the scripts to remote**

```bash
git push origin dev
```

- [ ] **Step 2: Run the setup script**

```bash
scripts/setup-clio.sh
```

Expected output:
- Clone to `~/clio`
- Copy `store/`, `memory/`, `.env`, `config.json`
- Install, build, prune
- Install launchd plist
- Start service

- [ ] **Step 3: Verify Clio is running**

```bash
launchctl list | grep clio
curl http://localhost:3000
```

- [ ] **Step 4: Verify deploy works**

Make a trivial change in the dev repo, push to dev, then:

```bash
scripts/deploy.sh
```

Verify Clio restarts with the change.

- [ ] **Step 5: Verify crash recovery**

```bash
# Find Clio's PID
launchctl list | grep clio
# Kill it
kill -9 <pid>
# Wait 10 seconds (ThrottleInterval), verify it restarted
launchctl list | grep clio
```

---

### Summary

| Task | Description | Files |
|------|-------------|-------|
| 1 | Launchd plist template | `scripts/com.clio.second-brain.plist` |
| 2 | One-time setup script | `scripts/setup-clio.sh` |
| 3 | Deploy script | `scripts/deploy.sh` |
| 4 | Run setup and verify (manual) | — |
