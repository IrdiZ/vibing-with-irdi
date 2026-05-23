#!/usr/bin/env bash
# Render OG cards from scripts/og-*.html into public/og-*.png at 1200x630.
# Uses headless Chrome — no npm dependencies needed.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
if [ ! -x "$CHROME" ]; then
  if [ -x "/Applications/Chromium.app/Contents/MacOS/Chromium" ]; then
    CHROME="/Applications/Chromium.app/Contents/MacOS/Chromium"
  else
    echo "error: need Google Chrome or Chromium installed" >&2
    exit 1
  fi
fi

mkdir -p "$ROOT/public"

render() {
  local name="$1"
  local html="$ROOT/scripts/$name.html"
  local out="$ROOT/public/$name.png"
  echo "→ $name"
  "$CHROME" \
    --headless \
    --disable-gpu \
    --hide-scrollbars \
    --no-sandbox \
    --window-size=1200,630 \
    --screenshot="$out" \
    --virtual-time-budget=2000 \
    "file://$html" > /dev/null 2>&1
}

render og-default
render og-openpriya

echo "✓ OG images regenerated in public/"
