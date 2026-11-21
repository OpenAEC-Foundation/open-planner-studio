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

# De banner: de stdio-client van de SDK (voor de bundeltest) laadt `cross-spawn`, dat `require` gebruikt.
OUT="$DIR/.run-real-app.mjs"
"$ROOT/node_modules/.bin/esbuild" "$DIR/run-real-app.ts" \
  --bundle --platform=node --format=esm --alias:@="$ROOT/src" \
  --define:import.meta.env.DEV=false \
  --define:import.meta.env.PROD=true \
  --define:import.meta.env.MODE='"production"' \
  --define:__OPS_DEV_INSTANCE__='"test"' \
  --banner:js="import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);" \
  --outfile="$OUT" --log-level=warning

# De Claude Desktop-bundel (#730): run-real-app.ts start hem tegen de echte bridge.
MCPB_OUT="$LOG_DIR/mcpb"
if ! node "$ROOT/scripts/build-mcpb.mjs" --out "$MCPB_OUT" >"$LOG_DIR/build-mcpb.log" 2>&1; then
  echo "build-mcpb faalde:" >&2
  cat "$LOG_DIR/build-mcpb.log" >&2
  exit 1
fi
export OPS_MCPB_SERVER="$MCPB_OUT/bundle/server/index.mjs"

# #804, knownbug 1762: een map buiten de thuismap die de planner eerder vrijgaf. De mapkiezer van plugin-dialog geeft een
# map vrij als `allow_directory(map, false)` (de patronen `map` en `map/*`), en persisted-scope bewaart die patronen in
# `.persisted-scope` (bincode: een lijst toegestane en een lijst verboden patronen) en zet ze bij de start terug. Dit
# schrijft dat bestand vóór de start, zoals het er na zo'n keuze uitziet; run-real-app.ts doet er Ctrl+S. Een bestaand
# bestand blijft staan (dan meldt die proef dat de map ontbreekt).
APP_DATA="$(dirname "$OPS_DIR")"
SCOPE_FILE="$APP_DATA/.persisted-scope"
if [ -e "$SCOPE_FILE" ]; then
  echo "let op: $SCOPE_FILE bestaat al; geen vrijgegeven map buiten de thuismap voor de proef van knownbug 1762" >&2
else
  GRANTED="$(mktemp -d /tmp/ops-1762-vrijgegeven-XXXXXX)"
  node -e '
    const [file, dir] = process.argv.slice(1);
    const u64 = (n) => { const b = Buffer.alloc(8); b.writeBigUInt64LE(BigInt(n)); return b; };
    const str = (s) => { const b = Buffer.from(s, "utf8"); return Buffer.concat([u64(b.length), b]); };
    const allowed = [dir, `${dir}/*`];
    require("node:fs").writeFileSync(file, Buffer.concat([u64(allowed.length), ...allowed.map(str), u64(0)]));
  ' "$SCOPE_FILE" "$GRANTED"
  export OPS_REAL_APP_GRANTED_DIR="$GRANTED"
fi

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
