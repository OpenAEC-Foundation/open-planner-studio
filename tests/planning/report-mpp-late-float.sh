#!/usr/bin/env bash
# Rapportmodus (geen poort): late start/finish + totale/vrije speling van readMPP+solveProject tegen
# MS Projects eigen opgeslagen waarden. Bundelt `report-mpp-late-float.ts` exact zoals `run.sh`
# zijn checks bundelt en draait 'm. Corpuswortels via OPS_MPP_CORPUS / OPS_MPP_CRAWL (zelfde
# variabelen als check-mpp-fidelity.ts). Zie docs/planning-test-bevindingen-mpp-late-float.md.
set -euo pipefail
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$DIR/../.." && pwd)"
OUT="$DIR/.report-mpp-late-float.mjs"
"$ROOT/node_modules/.bin/esbuild" "$DIR/report-mpp-late-float.ts" --log-level=error \
  --bundle --platform=node --format=esm --alias:@="$ROOT/src" \
  --define:import.meta.env.DEV=false \
  --define:import.meta.env.PROD=true \
  --define:import.meta.env.MODE='"production"' \
  --define:__OPS_DEV_INSTANCE__='"test"' \
  --outfile="$OUT" >/dev/null
node "$OUT"
