#!/usr/bin/env bash
# Launch the GURPS VTT: rebuild the client if stale, start the Express server
# (which serves dist/ statically — the only mode where same-origin sockets work),
# then open a Chrome app window.
#
# Run by gurps-vtt.desktop with Terminal=false, so failures surface via notify-send
# and logs land in ~/.local/state/gurps-vtt/.
set -euo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO"

# .desktop launches (Terminal=false) get a minimal PATH without the user-local
# node install, so npm/node are missing exactly when a rebuild is needed.
[ -d "$HOME/.local/node/bin" ] && PATH="$HOME/.local/node/bin:$PATH"

LOG_DIR="$HOME/.local/state/gurps-vtt"
mkdir -p "$LOG_DIR"

URL="http://localhost:3001"

fail() {
  notify-send -u critical "GURPS VTT" "$1" 2>/dev/null || true
  echo "[launch-app] $1" >&2
  exit 1
}

# Rebuild dist/ when missing or older than any client source.
needs_build() {
  [ -f dist/index.html ] || return 0
  [ -n "$(find src shared public index.html vite.config.js package.json \
      -newer dist/index.html -print -quit 2>/dev/null)" ]
}

if needs_build; then
  notify-send "GURPS VTT" "Rebuilding client…" 2>/dev/null || true
  npm run build >>"$LOG_DIR/build.log" 2>&1 \
    || fail "vite build failed — see $LOG_DIR/build.log"
fi

# Start the server only if :3001 isn't already answering.
# It stays running after the window closes and is reused on the next launch.
if ! curl -sf -o /dev/null --max-time 2 "$URL/"; then
  PORT=3001 nohup node server/node_modules/tsx/dist/cli.mjs server/src/index.ts \
    >>"$LOG_DIR/server.log" 2>&1 &
  up=""
  for _ in $(seq 1 40); do
    if curl -sf -o /dev/null --max-time 2 "$URL/"; then up=1; break; fi
    sleep 0.5
  done
  [ -n "$up" ] || fail "server did not come up on :3001 — see $LOG_DIR/server.log"
fi

exec google-chrome --app="$URL" >/dev/null 2>&1
