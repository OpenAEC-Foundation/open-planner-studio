#!/usr/bin/env bash
# Externe-clienttest tegen de ECHTE app (Tauri-dev-build + echte Rust-bridge), onder xvfb.
# Bedoeld voor CI (`.github/workflows/mcp-real-app.yml`); niet in `npm test`.
#
#   bash tests/mcp/realApp/run.sh
#
# Vereist: Rust stable, de Tauri-Linux-afhankelijkheden (libwebkit2gtk-4.1-dev …) en xvfb.
# De app schrijft in de echte appDataDir (`~/.local/share/org.openaec.planner/`); daarom draait dit
# script alleen met CI=true of OPS_MCP_REAL_APP=1, zodat het lokaal nooit per ongeluk de gegevens van
# een gebruiker raakt.
#
# Exit 0 = alle controles groen; anders rood. Het app-log staat in test-results/mcp-real-app/.
set -euo pipefail
DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$DIR/../../.." && pwd)"

if [ "${CI:-}" != "true" ] && [ "${OPS_MCP_REAL_APP:-}" != "1" ]; then
  echo "Weigering: zet CI=true of OPS_MCP_REAL_APP=1 (dit script start de app en schrijft in de appDataDir)." >&2
  exit 2
fi

OPS_DIR="${OPS_TEST_DIR:-$HOME/.local/share/org.openaec.planner/ops-test}"
LOG_DIR="$ROOT/test-results/mcp-real-app"
LOG="$LOG_DIR/tauri-dev.log"
BOOT_TIMEOUT="${MCP_REAL_APP_BOOT_TIMEOUT:-1800}"
mkdir -p "$OPS_DIR" "$LOG_DIR"
rm -f "$OPS_DIR/ready.json" "$OPS_DIR/cmd.json" "$OPS_DIR/res.json"

OUT="$DIR/.run-real-app.mjs"
"$ROOT/node_modules/.bin/esbuild" "$DIR/run-real-app.ts" \
  --bundle --platform=node --format=esm --alias:@="$ROOT/src" \
  --define:import.meta.env.DEV=false \
  --define:import.meta.env.PROD=true \
  --define:import.meta.env.MODE='"production"' \
  --define:__OPS_DEV_INSTANCE__='"test"' \
  --outfile="$OUT" --log-level=warning

# Eigen sessie, zodat de opruiming de hele procesboom (npm → tauri → vite + app) stopt.
cd "$ROOT"
setsid xvfb-run -a env WEBKIT_DISABLE_DMABUF_RENDERER=1 WEBKIT_DISABLE_COMPOSITING_MODE=1 \
  npm run tauri:dev >"$LOG" 2>&1 &
APP_PID=$!
cleanup() { kill -TERM -- "-$APP_PID" 2>/dev/null || true; }
trap cleanup EXIT

echo "app gestart (pid $APP_PID); wachten op $OPS_DIR/ready.json (max ${BOOT_TIMEOUT}s)"
start=$(date +%s)
until [ -f "$OPS_DIR/ready.json" ]; do
  if ! kill -0 "$APP_PID" 2>/dev/null; then
    echo "app is gestopt voordat het ops-test-kanaal klaar was; laatste logregels:" >&2
    tail -n 60 "$LOG" >&2
    exit 1
  fi
  if [ $(( $(date +%s) - start )) -ge "$BOOT_TIMEOUT" ]; then
    echo "time-out: ops-test-kanaal niet klaar na ${BOOT_TIMEOUT}s; laatste logregels:" >&2
    tail -n 60 "$LOG" >&2
    exit 1
  fi
  sleep 5
done
echo "ops-test-kanaal klaar na $(( $(date +%s) - start ))s"

set +e
node "$OUT"
STATUS=$?
set -e
if [ "$STATUS" -ne 0 ]; then
  echo "laatste logregels van de app:" >&2
  tail -n 60 "$LOG" >&2
fi
echo "EXIT:$STATUS"
exit "$STATUS"
