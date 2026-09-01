#!/usr/bin/env bash
# Bedrijfsbibliotheek-regressietests (spec B1). Bundelt elke check met esbuild en draait 'm op Node;
# de exitcode is de poort (exit 0 = alles groen, exit 1 = minstens één afwijking). Model:
# tests/planning/run.sh. Worktree-let-op: verwijst naar $ROOT/node_modules/.bin/esbuild.
set -euo pipefail
DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$DIR/../.." && pwd)"
ESBUILD="$ROOT/node_modules/.bin/esbuild"
TSC="$ROOT/node_modules/.bin/tsc"
STATUS=0

# Compile-afdwinging (fixture-/type-volledigheid) — dedicated tsconfig, want de hoofd-tsconfig
# sluit tests/ uit.
node "$TSC" --noEmit -p "$DIR/tsconfig.check.json" || STATUS=1

run_check() {
  local name="$1"
  local out="$DIR/.$name.mjs"
  "$ESBUILD" "$DIR/$name.ts" \
    --bundle --platform=node --format=esm --alias:@="$ROOT/src" \
    --define:import.meta.env.DEV=false \
    --define:import.meta.env.PROD=true \
    --define:import.meta.env.MODE='"production"' \
    --define:__OPS_DEV_INSTANCE__='"test"' \
    --outfile="$out" >/dev/null 2>&1
  node "$out" || STATUS=1
}

run_check check-library-ops
run_check check-library-slice
run_check check-demo-library
run_check check-projectinfo-guard
run_check check-pool-ifc
run_check check-ifc-hostile
run_check check-i18n-plurals
run_check check-occupancy
run_check check-distribute
run_check check-apply-distribution

exit "$STATUS"
