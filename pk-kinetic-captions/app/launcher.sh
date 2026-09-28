#!/bin/bash
#
# PK Kinetic Captions — the executable inside the .app bundle.
#
# The one thing that breaks launchers like this: a double-clicked app does not
# get a login shell, so PATH is the bare system one and `node` is almost never
# on it. Homebrew, nvm, fnm, Volta and asdf all install somewhere else. So
# rather than trusting PATH, this looks in the places Node actually lives, and
# only falls back to asking a login shell.
#
# Everything is logged, because an app that fails silently from the dock is
# impossible for anyone to debug.

set -uo pipefail

PROJECT_DIR="__PROJECT_DIR__"
LOG_DIR="$HOME/Library/Logs"
LOG="$LOG_DIR/PK Kinetic Captions.log"
mkdir -p "$LOG_DIR"
exec >>"$LOG" 2>&1
echo "--- $(date '+%Y-%m-%d %H:%M:%S') launching ---"

fail() {
  echo "FAILED: $1"
  /usr/bin/osascript -e "display dialog \"$1\" with title \"PK Kinetic Captions\" buttons {\"OK\"} default button 1 with icon stop" >/dev/null 2>&1
  exit 1
}

find_node() {
  local candidate base newest p

  for candidate in \
    /opt/homebrew/bin/node \
    /usr/local/bin/node \
    /usr/bin/node \
    /opt/local/bin/node \
    "$HOME/.volta/bin/node" \
    "$HOME/.local/bin/node" \
    "$HOME/n/bin/node"
  do
    [ -x "$candidate" ] && { echo "$candidate"; return 0; }
  done

  # Version managers keep Node under a versioned directory; take the newest.
  for base in \
    "$HOME/.nvm/versions/node" \
    "$HOME/.fnm/node-versions" \
    "$HOME/Library/Application Support/fnm/node-versions" \
    "$HOME/.asdf/installs/nodejs"
  do
    [ -d "$base" ] || continue
    newest=$(ls -1 "$base" 2>/dev/null | sort -V | tail -1)
    [ -n "$newest" ] || continue
    for p in "$base/$newest/bin/node" "$base/$newest/installation/bin/node"; do
      [ -x "$p" ] && { echo "$p"; return 0; }
    done
  done

  # Last resort: a login shell does read the user's profile.
  candidate=$("${SHELL:-/bin/zsh}" -lic 'command -v node' 2>/dev/null | tail -1)
  [ -n "$candidate" ] && [ -x "$candidate" ] && { echo "$candidate"; return 0; }

  return 1
}

NODE=$(find_node) || fail "Node.js was not found on this Mac. PK Kinetic Captions needs Node 20 or newer — install it from nodejs.org, then open this app again."
echo "node: $NODE ($("$NODE" --version 2>/dev/null))"

MAJOR=$("$NODE" -p 'process.versions.node.split(".")[0]' 2>/dev/null || echo 0)
if [ "$MAJOR" -lt 20 ] 2>/dev/null; then
  fail "PK Kinetic Captions needs Node 20 or newer. This Mac has $("$NODE" --version). Update Node from nodejs.org and open the app again."
fi

[ -d "$PROJECT_DIR" ] || fail "The PK Kinetic Captions files are not where this app expects them:

$PROJECT_DIR

If you moved the folder, run 'node bin/pkkc.js app' inside it again to rebuild this launcher."

cd "$PROJECT_DIR" || fail "Could not open $PROJECT_DIR"

# Run the server in the foreground: the app stays in the dock for as long as
# the server is up, and quitting it stops the server.
echo "starting: $NODE bin/pkkc.js ui"
exec "$NODE" bin/pkkc.js ui
