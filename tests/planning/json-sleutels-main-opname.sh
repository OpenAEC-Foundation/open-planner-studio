#!/usr/bin/env bash
set -euo pipefail
COMMIT="${1:?geef de commit van main}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
OUT="${2:-$ROOT/tests/fixtures/ifc-foreign/json-sleutels-main.json}"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
git -C "$ROOT" archive "$COMMIT" | tar -x -C "$WORK"
cp "$ROOT/tests/planning/ifcJsonSleutelsMain.ts" "$ROOT/tests/planning/json-sleutels-main-opname.ts" "$WORK/tests/planning/"
ln -s "$(readlink -f "$ROOT/node_modules")" "$WORK/node_modules"
TRIE="$(cd "$WORK" && node -e "
const { createRequire } = require('node:module'); const path = require('node:path');
const fontkit = createRequire(path.join(process.cwd(), 'x.js')).resolve('fontkit');
console.log(path.join(path.dirname(createRequire(fontkit).resolve('unicode-properties')), 'binaryTrie.browser.js'));
")"
"$WORK/node_modules/.bin/esbuild" "$WORK/tests/planning/json-sleutels-main-opname.ts" --alias:#binary-trie="$TRIE" --log-level=error \
  --bundle --platform=node --format=esm --alias:@="$WORK/src" --external:react-dom/server --define:import.meta.env.DEV=false \
  --define:import.meta.env.PROD=true --define:import.meta.env.MODE='"production"' --define:__OPS_DEV_INSTANCE__='"test"' \
  --outfile="$WORK/opname.mjs"
(cd "$WORK" && OPS_MAIN_COMMIT="$(git -C "$ROOT" rev-parse "$COMMIT")" node opname.mjs) > "$OUT"
