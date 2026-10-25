#!/bin/bash

# Required parameters:
# @raycast.schemaVersion 1
# @raycast.title Backlit
# @raycast.mode silent

# Optional parameters:
# @raycast.icon res/icon.png
# @raycast.packageName Backlit
# @raycast.description Start the Backlit LED strip UI (if not running) and open it in the browser

# the app lives next to this script (also when Raycast runs it through a symlink)
app=$(dirname "$(readlink -f "$0")") url=http://localhost:4321

if ! curl -s -o /dev/null "$url"; then
  # Raycast doesn't load nvm, so fall back to the newest nvm-installed node
  node=$(command -v node || ls ~/.nvm/versions/node/*/bin/node 2>/dev/null | sort -V | tail -1)
  [[ -x $node ]] || { echo "node not found"; exit 1; }
  nohup "$node" "$app/server.js" >/tmp/backlit.log 2>&1 &
  disown
  for _ in {1..50}; do curl -s -o /dev/null "$url" && break; sleep 0.1; done
fi

open "$url"
