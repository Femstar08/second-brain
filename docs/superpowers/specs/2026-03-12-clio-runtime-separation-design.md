# Clio Runtime Separation Design

Separate Clio's production runtime from the development repository so code changes don't affect the running instance, and updates are deployed intentionally.

## Approach

Separate git clone. The production instance lives at `~/clio` (configurable via `CLIO_HOME` env var). The development repo at `~/Projects/second-brain` is purely for development. Only committed, pushed code reaches production — via an explicit deploy command.

## Current State

- Clio runs directly from the development repo (`~/Projects/second-brain`)
- Runtime state (`store/`, `.env`, `config.json`) is already gitignored
- `memory/` is partially gitignored — `user.md`, `memory.md`, `daily/*.md` are excluded but `agent.md`, `soul.md`, `knowledge/`, `preferences/` are tracked
- `skills/` is version-controlled (not gitignored) — runtime skill additions are possible but rare
- All paths resolve relative to `PROJECT_ROOT` via `import.meta.url` — no hardcoded absolute paths
- Build step exists: `npm run build` compiles TypeScript to `dist/`
- PID-based lock file prevents duplicate instances
- `npm start` runs `node dist/index.js` in production mode

## Production Layout

```
~/clio/                          ← CLIO_HOME (production clone)
  .git/                          ← tracks origin/dev
  dist/                          ← compiled JS (built locally)
  node_modules/                  ← production dependencies
  web/dist/                      ← built frontend
  store/
    second-brain.db              ← live SQLite database
    media/                       ← uploaded/generated media files
  memory/                        ← agent memory files
  skills/                        ← agent skill definitions
  logs/
    stdout.log                   ← launchd stdout
    stderr.log                   ← launchd stderr
  .env                           ← API keys and secrets
  config.json                    ← runtime configuration
```

## Deploy Script (`scripts/deploy.sh`)

Runs from anywhere. Pulls latest `dev` branch into the production clone, installs dependencies, builds, and restarts the service.

```bash
#!/bin/bash
set -euo pipefail

CLIO_HOME="${CLIO_HOME:-$HOME/clio}"

if [ ! -d "$CLIO_HOME/.git" ]; then
  echo "Error: $CLIO_HOME is not a git repository"
  exit 1
fi

echo "Deploying to $CLIO_HOME..."

cd "$CLIO_HOME"

# Preserve runtime memory files that git would overwrite
STASH_DIR=$(mktemp -d)
for f in memory/soul.md memory/agent.md; do
  if [ -f "$f" ]; then
    cp "$f" "$STASH_DIR/$(basename $f)"
  fi
done

# Pull latest from origin/dev
git fetch origin dev || { echo "Error: git fetch failed. Check network/remote."; exit 1; }
git reset --hard origin/dev

# Restore runtime memory files
for f in "$STASH_DIR"/*; do
  [ -f "$f" ] && cp "$f" "memory/$(basename $f)"
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

### Deploy behavior

- `git reset --hard origin/dev` — production clone should never have local modifications. It always matches exactly what's on `origin/dev`.
- **Stash/restore** — runtime memory files (`soul.md`, `agent.md`) that are tracked in git but modified at runtime are preserved across deploys.
- **Full install → build → prune** — devDependencies (TypeScript, Vite) are needed during build but pruned afterward. Both root and `web/` dependencies are installed.
- `launchctl kickstart -k` — restart the launchd service in one command. Falls back to manual instruction if launchd isn't configured.

## Process Management (launchd)

A macOS LaunchAgent plist at `~/Library/LaunchAgents/com.clio.second-brain.plist` so Clio:

- Starts on login (`RunAtLoad`)
- Restarts on crash (`KeepAlive`)
- Logs stdout/stderr to `~/clio/logs/`

### Plist Template (`scripts/com.clio.second-brain.plist`)

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

`__CLIO_HOME__` is replaced by the setup script with the actual path. `ThrottleInterval: 10` prevents rapid restart loops if Clio keeps crashing.

### Node path

The plist uses `/usr/local/bin/node`. The setup script detects the actual node path via `which node` and substitutes it.

## One-Time Setup Script (`scripts/setup-clio.sh`)

Interactive script for first-time migration:

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

# Step 2: Copy runtime state from dev repo (if it exists there)
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

# Step 3: Build
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

# Step 6: Load and start
# Unload first if already loaded (idempotent)
launchctl bootout "gui/$(id -u)/com.clio.second-brain" 2>/dev/null || true
launchctl bootstrap "gui/$(id -u)" "$PLIST_DST"

echo ""
echo "=== Setup Complete ==="
echo "Clio is running from $CLIO_HOME"
echo "To deploy updates: scripts/deploy.sh"
echo "To check status: launchctl list | grep clio"
echo "Logs: $CLIO_HOME/logs/"
```

### What it does

1. Clones the repo to `~/clio` from the same remote as the dev repo
2. Copies existing runtime state (`store/`, `memory/`, `skills/`, `.env`, `config.json`) from the dev repo — only if it doesn't already exist at the destination (won't overwrite)
3. Installs production dependencies and builds
4. Creates `logs/` directory
5. Installs the launchd plist with correct paths substituted
6. Loads and starts the service

### After setup

The user should clean runtime state from the dev repo if desired (optional — gitignore already excludes it).

## Files Added to Repo

| File | Purpose |
|------|---------|
| `scripts/deploy.sh` | Pull, build, restart Clio |
| `scripts/setup-clio.sh` | One-time migration from dev repo to production |
| `scripts/com.clio.second-brain.plist` | launchd template |

No application code changes required.

## Memory Files and Deploy Safety

Some `memory/` files are tracked in git (`agent.md`, `soul.md`) but also written to at runtime by the agent. The deploy script stashes these before `git reset --hard` and restores them after, so Clio's runtime memories survive deploys.

Files that are fully gitignored (`user.md`, `memory.md`, `daily/`) are untouched by `git reset --hard` and need no special handling.

`skills/` is version-controlled — skill definitions ship with the code. If a skill is added at runtime (rare), it would be overwritten on deploy. This is acceptable since skill changes should go through the dev repo.

## Update Workflow (Day-to-Day)

1. Develop in `~/Projects/second-brain` on feature branches
2. Merge to `dev` (or merge PR on GitHub)
3. Run `scripts/deploy.sh` to push the update to Clio
4. Clio restarts with the new code, existing data untouched

## Rollback

If a deploy breaks Clio:

```bash
cd ~/clio
git log --oneline -5          # find the last good commit
git reset --hard <commit>
npm install && (cd web && npm install)
npm run build
npm prune --omit=dev
launchctl kickstart -k "gui/$(id -u)/com.clio.second-brain"
```

## Testing Strategy

- Verify `setup-clio.sh` creates a working clone and starts Clio
- Verify `deploy.sh` pulls updates and restarts cleanly
- Verify launchd restarts Clio after simulated crash (`kill -9`)
- Verify runtime state (database, memories) survives a deploy
- Verify dev repo changes don't affect `~/clio` until deploy
