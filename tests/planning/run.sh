#!/usr/bin/env bash
# Planning-CPM-regressietests — draait alle testbatterijen tegen de ECHTE Zustand-store +
# CPM-rekenmotor (headless, via esbuild-bundel). Geen testrunner-dependency nodig; gebruikt
# de esbuild die al met Vite meekomt.
#
#   bash tests/planning/run.sh            # alle batterijen
#   bash tests/planning/run.sh cases-relations.json   # één batterij
#
# Exit 0 = alles groen, exit 1 = minstens één afwijking.
set -euo pipefail
DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$DIR/../.." && pwd)"
OUT="$DIR/.harness.mjs"

"$ROOT/node_modules/.bin/esbuild" "$DIR/harness.ts" \
  --bundle --platform=node --format=esm --alias:@="$ROOT/src" \
  --define:import.meta.env.DEV=false \
  --define:import.meta.env.PROD=true \
  --define:import.meta.env.MODE='"production"' \
  --define:__OPS_DEV_INSTANCE__='"test"' \
  --outfile="$OUT" >/dev/null 2>&1

if [ "$#" -gt 0 ]; then
  FILES=()
  for f in "$@"; do FILES+=("$DIR/$f"); done
  RUN_HOLIDAYS=0
else
  FILES=("$DIR"/cases-*.json)
  RUN_HOLIDAYS=1   # volledige run: ook de holiday-generator-checks (fase 2.8a, §10.2)
fi

STATUS=0

# Holiday-generator-checks (feestdagen-engine, los van de CPM-cases).
if [ "$RUN_HOLIDAYS" -eq 1 ]; then
  CHECK="$DIR/.holidays-check.mjs"
  "$ROOT/node_modules/.bin/esbuild" "$DIR/check-holidays.ts" \
    --bundle --platform=node --format=esm --alias:@="$ROOT/src" \
    --define:import.meta.env.DEV=false \
    --define:import.meta.env.PROD=true \
    --define:import.meta.env.MODE='"production"' \
    --define:__OPS_DEV_INSTANCE__='"test"' \
    --outfile="$CHECK" >/dev/null 2>&1
  node "$CHECK" || STATUS=1

  # Datetime-substraat + duur-parser-checks (fase 2.8b golf 0, §8 — los van de CPM-cases).
  DTCHECK="$DIR/.datetime-check.mjs"
  "$ROOT/node_modules/.bin/esbuild" "$DIR/check-datetime.ts" \
    --bundle --platform=node --format=esm --alias:@="$ROOT/src" \
    --define:import.meta.env.DEV=false \
    --define:import.meta.env.PROD=true \
    --define:import.meta.env.MODE='"production"' \
    --define:__OPS_DEV_INSTANCE__='"test"' \
    --outfile="$DTCHECK" >/dev/null 2>&1
  node "$DTCHECK" || STATUS=1

  # "Je bent net geüpdatet"-vergelijklogica (releaseInfo.ts — pure functies, los van de CPM-cases).
  JUCHECK="$DIR/.just-updated-check.mjs"
  "$ROOT/node_modules/.bin/esbuild" "$DIR/check-just-updated.ts" \
    --bundle --platform=node --format=esm --alias:@="$ROOT/src" \
    --define:import.meta.env.DEV=false \
    --define:import.meta.env.PROD=true \
    --define:import.meta.env.MODE='"production"' \
    --define:__OPS_DEV_INSTANCE__='"test"' \
    --outfile="$JUCHECK" >/dev/null 2>&1
  node "$JUCHECK" || STATUS=1

  # CalendarEngine uur-modus-checks (fase 2.8b golf 1, §4/§9 — engine-primitieven, los van de CPM-cases).
  CHCHECK="$DIR/.calendar-hours-check.mjs"
  "$ROOT/node_modules/.bin/esbuild" "$DIR/check-calendar-hours.ts" \
    --bundle --platform=node --format=esm --alias:@="$ROOT/src" \
    --define:import.meta.env.DEV=false \
    --define:import.meta.env.PROD=true \
    --define:import.meta.env.MODE='"production"' \
    --define:__OPS_DEV_INSTANCE__='"test"' \
    --outfile="$CHCHECK" >/dev/null 2>&1
  node "$CHCHECK" || STATUS=1

  # Adapter-uur-precisie-checks (fase 2.8b golf 4, §7 — IFC/P6/MSPDI uur-round-trip + dag-discriminator).
  ADCHECK="$DIR/.adapters-hours-check.mjs"
  "$ROOT/node_modules/.bin/esbuild" "$DIR/check-adapters-hours.ts" \
    --bundle --platform=node --format=esm --alias:@="$ROOT/src" \
    --define:import.meta.env.DEV=false \
    --define:import.meta.env.PROD=true \
    --define:import.meta.env.MODE='"production"' \
    --define:__OPS_DEV_INSTANCE__='"test"' \
    --outfile="$ADCHECK" >/dev/null 2>&1
  node "$ADCHECK" || STATUS=1

  # Geavanceerde-CPM golf-0-checks (fase 2.9 — datamodel + plumbing default-inert, los van de CPM-cases).
  ACPMCHECK="$DIR/.advanced-cpm-check.mjs"
  "$ROOT/node_modules/.bin/esbuild" "$DIR/check-advanced-cpm.ts" \
    --bundle --platform=node --format=esm --alias:@="$ROOT/src" \
    --define:import.meta.env.DEV=false \
    --define:import.meta.env.PROD=true \
    --define:import.meta.env.MODE='"production"' \
    --define:__OPS_DEV_INSTANCE__='"test"' \
    --outfile="$ACPMCHECK" >/dev/null 2>&1
  node "$ACPMCHECK" || STATUS=1

  # moveAssignment-checks (fase 2.10, golf D, item 4 — headless tegen de echte store, guards +
  # resourceIds-boekhouding, los van de CPM-cases).
  MACHECK="$DIR/.move-assignment-check.mjs"
  "$ROOT/node_modules/.bin/esbuild" "$DIR/check-move-assignment.ts" \
    --bundle --platform=node --format=esm --alias:@="$ROOT/src" \
    --define:import.meta.env.DEV=false \
    --define:import.meta.env.PROD=true \
    --define:import.meta.env.MODE='"production"' \
    --define:__OPS_DEV_INSTANCE__='"test"' \
    --outfile="$MACHECK" >/dev/null 2>&1
  node "$MACHECK" || STATUS=1

  # "Project verplaatsen"-checks (pakket D1 — veld-voor-veld shift-verdicten, R7-feestdagendekking,
  # preview-zuiverheid en de R8/R9-guards; headless tegen de echte store + pure engine-helpers,
  # los van de CPM-cases in cases-move-project.json).
  MPCHECK="$DIR/.move-project-check.mjs"
  "$ROOT/node_modules/.bin/esbuild" "$DIR/check-move-project.ts" \
    --bundle --platform=node --format=esm --alias:@="$ROOT/src" \
    --define:import.meta.env.DEV=false \
    --define:import.meta.env.PROD=true \
    --define:import.meta.env.MODE='"production"' \
    --define:__OPS_DEV_INSTANCE__='"test"' \
    --outfile="$MPCHECK" >/dev/null 2>&1
  node "$MPCHECK" || STATUS=1

  # moveTask-cykelguard + addTask.notes-checks (fase 2.10 onderdeel 2, QA-fixes P1/4 — headless
  # tegen de echte store, los van de CPM-cases).
  MTCHECK="$DIR/.move-task-check.mjs"
  "$ROOT/node_modules/.bin/esbuild" "$DIR/check-move-task.ts" \
    --bundle --platform=node --format=esm --alias:@="$ROOT/src" \
    --define:import.meta.env.DEV=false \
    --define:import.meta.env.PROD=true \
    --define:import.meta.env.MODE='"production"' \
    --define:__OPS_DEV_INSTANCE__='"test"' \
    --outfile="$MTCHECK" >/dev/null 2>&1
  node "$MTCHECK" || STATUS=1

  # Documentcontract-checks (audit P10, F1/F3 — key-gedreven capture/hydrate/reset, Snapshot-subset,
  # B3-regressie, recovery-round-trip; headless tegen de echte store, los van de CPM-cases).
  DCCHECK="$DIR/.document-contract-check.mjs"
  "$ROOT/node_modules/.bin/esbuild" "$DIR/check-document-contract.ts" \
    --bundle --platform=node --format=esm --alias:@="$ROOT/src" \
    --define:import.meta.env.DEV=false \
    --define:import.meta.env.PROD=true \
    --define:import.meta.env.MODE='"production"' \
    --define:__OPS_DEV_INSTANCE__='"test"' \
    --outfile="$DCCHECK" >/dev/null 2>&1
  node "$DCCHECK" || STATUS=1

  # Gantt-cull-regressie: de speling-band mag niet verdwijnen zolang hij zichtbaar is. De cull in
  # drawTaskBar keek alleen naar de BALK-extent, terwijl de band ná de balk doorloopt — een band die
  # nog honderden pixels in beeld stond verdween daardoor mee. Draait de echte renderer met een
  # opnemende 2D-context-stub (aantoonbaar rood tegen de oude cull).
  GFCHECK="$DIR/.gantt-float-cull.mjs"
  "$ROOT/node_modules/.bin/esbuild" "$DIR/check-gantt-float-cull.ts" \
    --bundle --platform=node --format=esm --alias:@="$ROOT/src" \
    --define:import.meta.env.DEV=false \
    --define:import.meta.env.PROD=true \
    --define:import.meta.env.MODE='"production"' \
    --define:__OPS_DEV_INSTANCE__='"test"' \
    --outfile="$GFCHECK" >/dev/null 2>&1
  node "$GFCHECK" || STATUS=1

  # i18n-pluralisatie-contract voor de telsleutels van "Project verplaatsen…". Een ontbrekende
  # plural-categorie valt bij i18next NIET terug op de _other van dezelfde taal maar op fallbackLng,
  # en zet er dus Engels neer (in het Pools al zichtbaar bij twee items). Deze check eist per taal
  # exact de categorieën die Intl.PluralRules opgeeft, en vuurt ze daarna nog echt af.
  I18NCHECK="$DIR/.i18n-plurals.mjs"
  "$ROOT/node_modules/.bin/esbuild" "$DIR/check-i18n-plurals.ts" \
    --bundle --platform=node --format=esm --alias:@="$ROOT/src" \
    --define:import.meta.env.DEV=false \
    --define:import.meta.env.PROD=true \
    --define:import.meta.env.MODE='"production"' \
    --define:__OPS_DEV_INSTANCE__='"test"' \
    --outfile="$I18NCHECK" >/dev/null 2>&1
  node "$I18NCHECK" || STATUS=1

  # IFC-round-trip-contract (fase 3, P11, bevinding A2/F2). Twee stappen:
  #  (1) COMPILE-AFDWINGING van de fixture-volledigheid — de hoofd-tsconfig sluit tests/ uit, dus een
  #      eigen tsconfig die alleen check-ifc-roundtrip.ts typecheckt (`satisfies Required<...>`); een
  #      nieuw domeinveld → compile-fout → fixture MOET bijgewerkt (zelf-uitbreidende batterij).
  #  (2) De round-trip zelf: writeIFC→readIFC veld-voor-veld + idempotentie + KNOWN_GAPS.
  node "$ROOT/node_modules/.bin/tsc" --noEmit -p "$DIR/tsconfig.roundtrip.json" || STATUS=1

  RTCHECK="$DIR/.ifc-roundtrip-check.mjs"
  "$ROOT/node_modules/.bin/esbuild" "$DIR/check-ifc-roundtrip.ts" \
    --bundle --platform=node --format=esm --alias:@="$ROOT/src" \
    --define:import.meta.env.DEV=false \
    --define:import.meta.env.PROD=true \
    --define:import.meta.env.MODE='"production"' \
    --define:__OPS_DEV_INSTANCE__='"test"' \
    --outfile="$RTCHECK" >/dev/null 2>&1
  node "$RTCHECK" || STATUS=1
fi

node "$OUT" "${FILES[@]}" || STATUS=1
exit "$STATUS"
