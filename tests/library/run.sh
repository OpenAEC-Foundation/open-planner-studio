#!/usr/bin/env bash
# Bedrijfsbibliotheek-regressietests (spec B1). Bundelt elke check met esbuild en draait 'm op Node;
# de exitcode is de poort (exit 0 = alles groen, exit 1 = minstens één afwijking). Model:
# tests/planning/run.sh. Worktree-let-op: verwijst naar $ROOT/node_modules/.bin/esbuild.
#
#   bash tests/library/run.sh                       # alle check-*.ts (geglobd) + de compile-afdwinging
#   bash tests/library/run.sh check-occupancy.ts     # één check (de tsc-compile-afdwinging blijft
#                                                     #   meelopen — die dekt alle check-*.ts tegelijk)
#
# Let op: dit is dan een GERICHTE run — de overige checks draaien niet mee. Oordeel op de
# exitcode, ook bij een gerichte run.
set -euo pipefail
DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$DIR/../.." && pwd)"
ESBUILD="$ROOT/node_modules/.bin/esbuild"
TSC="$ROOT/node_modules/.bin/tsc"
STATUS=0

# Compile-afdwinging (fixture-/type-volledigheid) — dedicated tsconfig, want de hoofd-tsconfig
# sluit tests/ uit. Draait altijd mee, ook bij een gerichte run: hij typecheckt alle check-*.ts in
# één keer en is geen los te schakelen kostenpost.
node "$TSC" --noEmit -p "$DIR/tsconfig.check.json" || STATUS=1

# Bundel één check-script met esbuild (bevinding K9b, overgenomen uit tests/planning/run.sh).
# Alleen STDOUT wordt onderdrukt (esbuilds groottemelding); STDERR blijft zichtbaar zodat een
# compilefout ZICHTBAAR is. Voorheen ging `2>&1` overheen én ontbrak de `if`-vorm: een kapotte
# check-*.ts gaf hier NUL regels uitvoer en `set -e` doodde de rest van de run vóórdat "exit
# $STATUS" bereikt werd — precies de faalmodus die K9b in tests/planning/run.sh al wegnam.
# Aanroepen als: if bundle_check "$DIR/check-x.ts" "$XCHECK"; then node "$XCHECK" || STATUS=1; fi
bundle_check () {
  local src="$1" out="$2"
  if ! "$ESBUILD" "$src" --log-level=error \
      --bundle --platform=node --format=esm --alias:@="$ROOT/src" \
      --define:import.meta.env.DEV=false \
      --define:import.meta.env.PROD=true \
      --define:import.meta.env.MODE='"production"' \
      --define:__OPS_DEV_INSTANCE__='"test"' \
      --outfile="$out" >/dev/null; then
    echo "XX  bundelen mislukt: $(basename "$src") — zie de esbuild-fout hierboven"
    STATUS=1
    return 1
  fi
  return 0
}

run_check() {
  local name="$1"
  local out="$DIR/.$name.mjs"
  if bundle_check "$DIR/$name.ts" "$out"; then
    node "$out" || STATUS=1
  fi
}

# Was een handonderhouden opsomming naast de `include`-lijst in tsconfig.check.json — de twee
# liepen uit elkaar (check-distribute.ts ontbrak in de tsconfig, draaide dus wél maar werd nooit
# getypecheckt). Een glob over deze map kan per definitie niet meer afwijken van wat de tsconfig
# via zijn eigen `check-*.ts`-glob typecheckt.
ALL_CHECKS=()
for f in "$DIR"/check-*.ts; do
  ALL_CHECKS+=("$(basename "${f%.ts}")")
done

if [ "$#" -gt 0 ]; then
  RUN_CHECKS=()
  UNKNOWN_ARGS=()
  for f in "$@"; do
    name="${f%.ts}"
    case "$f" in
      check-*.ts)
        if [ -f "$DIR/$name.ts" ]; then RUN_CHECKS+=("$name"); else UNKNOWN_ARGS+=("$f"); fi
        ;;
      *)
        UNKNOWN_ARGS+=("$f")
        ;;
    esac
  done
  for u in "${UNKNOWN_ARGS[@]}"; do
    echo "XX  onbekend argument: $u (verwacht check-<naam>.ts, bestaand in $DIR)"
    STATUS=1
  done
else
  RUN_CHECKS=("${ALL_CHECKS[@]}")
fi

for c in "${RUN_CHECKS[@]}"; do
  run_check "$c"
done

exit "$STATUS"
