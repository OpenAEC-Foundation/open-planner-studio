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

# Elke gebouwde bundel wordt hier bijgehouden voor de tijdzone-matrix onderaan. Expliciet
# bijhouden i.p.v. een glob op "$DIR"/.*.mjs, want zo'n glob pakt ook verouderde artefacten
# van inmiddels verwijderde checks op (die daarna eeuwig blijven meedraaien).
BUNDLES=()

# STATUS staat bewust HIER al (en niet pas na de argumentafhandeling): `bundle_check`
# hieronder zet hem, en die wordt al aangeroepen vóór dat punt.
STATUS=0

# Bundel één check-script met esbuild.
#
# Twee dingen die hier bewust anders zijn dan voorheen (bevinding K9b):
#  1. Alleen STDOUT wordt onderdrukt — dat is enkel esbuilds groottemelding. STDERR NIET:
#     een compilefout moet zichtbaar zijn. Voorheen ging er `2>&1` overheen, waardoor een
#     syntaxfout in één check-script een run opleverde met exitcode 1 en NUL regels uitvoer.
#     In CI (deze suite is sinds kort een blokkerende poort in release.yml en live.yml) was
#     dat een rode job met een lege log: je zag niet eens wélke check stuk was.
#  2. Mislukt het bundelen, dan breekt de suite NIET af maar loopt hij door met STATUS=1.
#     Onder `set -e` sneuvelde voorheen alles ná de kapotte check — inclusief de resterende
#     batterijen en alle 431 cases — zodat één fout de rest van het beeld verborg.
#
# Aanroepen als:  if bundle_check "$DIR/check-x.ts" "$XCHECK"; then node "$XCHECK" || STATUS=1; fi
# De `if`-vorm is nodig: een functie die 1 teruggeeft binnen een `if`-conditie triggert `set -e` niet.
bundle_check () {
  local src="$1" out="$2"
  # --log-level=error: esbuild schrijft zijn groottemelding naar STDERR (niet stdout), dus die
  # lekte mee zodra we stderr doorlieten. Dit dempt de samenvatting maar laat fouten staan.
  if ! "$ROOT/node_modules/.bin/esbuild" "$src" --log-level=error \
      --bundle --platform=node --format=esm --alias:@="$ROOT/src" \
      --external:react-dom/server \
      --define:import.meta.env.DEV=false \
      --define:import.meta.env.PROD=true \
      --define:import.meta.env.MODE='"production"' \
      --define:__OPS_DEV_INSTANCE__='"test"' \
      --outfile="$out" >/dev/null; then
    echo "XX  bundelen mislukt: $(basename "$src") — zie de esbuild-fout hierboven"
    STATUS=1
    return 1
  fi
  BUNDLES+=("$out")
  return 0
}

# De hoofd-harness draagt alle CPM-cases. Mislukt dit bundelen, dan kunnen de cases niet
# draaien; de checks hieronder wél, dus we breken niet af maar slaan alleen de case-run over.
HARNESS_OK=1
bundle_check "$DIR/harness.ts" "$OUT" || HARNESS_OK=0
# $OUT hoort niet in BUNDLES: de tijdzone-matrix draait hem apart, mét "${FILES[@]}".
if [ "$HARNESS_OK" -eq 1 ]; then unset 'BUNDLES[-1]'; fi

# ── Batterij-inventaris (bevinding K10b) ───────────────────────────────────────────────────────
# De casus-bestanden worden geglobd. Een batterij die bij een rebase/merge/verkeerde `git checkout`
# verdwijnt, verdwijnt daarmee STIL: de run blijft groen, alleen met een lager totaal — en niemand
# kent het totaal uit zijn hoofd. Daarom een EXPLICIETE lijst, in beide richtingen gecontroleerd:
# een ontbrekend bestand is rood, en een nieuw bestand dat hier niet staat óók (anders loopt de
# lijst stil achter en bewaakt hij niets meer). Nieuwe batterij ⇒ naam hieronder bijzetten.
EXPECTED_BATTERIES=(
  advanced-cpm baselines boundary calendar calibration constraints driving edge float
  hours hours-relations kalenders lag-advanced milestone-kinds milestones move-project
  msp-pariteit probes progress relations resource-leveling resource-load view
)

# JSON-meetlatdata met de verplichte `cases-*.json`-naam, maar NIET het CPM-harnessschema. Elk
# bestand hier heeft een eigen check-script verderop; zonder deze expliciete grens zou de glob het
# als een gewone batterij proberen te valideren en uitvoeren.
is_auxiliary_case_data () {
  [ "$(basename "$1")" = "cases-p6-verified.json" ]
}

check_batteries () {
  local f base b missing=() unexpected=()
  local -A want=() have=()
  for b in "${EXPECTED_BATTERIES[@]}"; do want[$b]=1; done
  for f in "$DIR"/cases-*.json; do
    if is_auxiliary_case_data "$f"; then continue; fi
    base="$(basename "$f")"; base="${base#cases-}"; base="${base%.json}"
    have[$base]=1
    if [ -z "${want[$base]:-}" ]; then unexpected+=("$base"); fi
  done
  for b in "${EXPECTED_BATTERIES[@]}"; do
    if [ -z "${have[$b]:-}" ]; then missing+=("$b"); fi
  done
  if [ "${#missing[@]}" -gt 0 ]; then
    echo "XX  batterij-inventaris: ONTBREEKT ${#missing[@]} bestand(en): ${missing[*]}"
    echo "    (verwacht tests/planning/cases-<naam>.json — verdwenen bij een rebase/checkout?)"
    STATUS=1
  fi
  if [ "${#unexpected[@]}" -gt 0 ]; then
    echo "XX  batterij-inventaris: ${#unexpected[@]} batterij(en) niet in EXPECTED_BATTERIES: ${unexpected[*]}"
    echo "    (nieuwe batterij? zet de naam bij in EXPECTED_BATTERIES bovenin dit script)"
    STATUS=1
  fi
  if [ "${#missing[@]}" -eq 0 ] && [ "${#unexpected[@]}" -eq 0 ]; then
    echo "OK  batterij-inventaris: ${#EXPECTED_BATTERIES[@]}/${#EXPECTED_BATTERIES[@]} casusbestanden aanwezig"
  fi
}
check_batteries

# ── Check-scriptinventaris ──────────────────────────────────────────────────────────────────
# Een `check-*.ts`-bestand dat op schijf staat maar door GEEN ENKELE `if bundle_check
# "$DIR/check-..."`-regel wordt aangeroepen, draait in een volledige run stilzwijgend niet mee —
# geen foutmelding, gewoon een lager totaal (zo werd `check-tauri-refresh-evidence.ts` wees:
# bestond, typechecte mee via tsconfig.check.json, maar was door geen `bundle_check`-regel
# aangesloten — gevonden 2026-09, inmiddels bedraad). Iedere `check-*.ts` moet daarom OFWEL
# aangeroepen worden, OFWEL expliciet met reden op CHECK_SCRIPT_ALLOWLIST staan — naar het model
# van EXPECTED_BATTERIES/check_batteries hierboven, maar dan voor de losse check-scripts i.p.v.
# de cases-*.json-batterijen.
CHECK_SCRIPT_ALLOWLIST=(
  # (Een bewust handmatige/rode check hoort hier met een regel die uitlegt waarom, plus een
  # verwijzing naar de bijbehorende docs/TODO.md-notitie.)
  #
  # De twee X8-cataloguscontracten hieronder zijn PUUR compile-time: nul runtime-asserties, ze
  # bestaan alleen uit `@ts-expect-error`-regels die vastleggen dat de gedeelde XER-catalogus diep
  # readonly blijft terwijl de per-projectmaterialisatie mutabel blijft. Bundelen en draaien zou
  # niets meten (een lege module). De afdwinging zit in `tsc`: `tsconfig.tests.json` heeft
  # `include: ["scripts", "tests", ...]`, en onder die config is een ONGEBRUIKTE
  # `@ts-expect-error` zelf een fout — verdwijnt het readonly, dan valt `npm run typecheck` om.
  check-xer-metadata-catalog-types.ts
  check-xer-resource-catalog-types.ts
)

check_check_scripts () {
  local f base missing=() allow
  local -A wired=() allowed=()
  for base in $(grep -E '^[[:space:]]*if bundle_check "\$DIR/check-' "${BASH_SOURCE[0]}" \
      | grep -oE 'check-[A-Za-z0-9_-]+\.ts' | sort -u || true); do
    wired[$base]=1
  done
  for allow in "${CHECK_SCRIPT_ALLOWLIST[@]:-}"; do
    [ -n "$allow" ] && allowed[$allow]=1
  done
  for f in "$DIR"/check-*.ts; do
    base="$(basename "$f")"
    if [ -z "${wired[$base]:-}" ] && [ -z "${allowed[$base]:-}" ]; then
      missing+=("$base")
    fi
  done
  if [ "${#missing[@]}" -gt 0 ]; then
    echo "XX  check-scriptinventaris: ${#missing[@]} bestand(en) niet aangeroepen en niet op de allowlist: ${missing[*]}"
    echo "    (nieuwe/vergeten check-*.ts? bedraad 'm met 'if bundle_check ...; then ...; fi', of zet 'm"
    echo "    met een reden op CHECK_SCRIPT_ALLOWLIST bovenin dit script — nooit stilzwijgend een rode check bedraden)"
    STATUS=1
  else
    echo "OK  check-scriptinventaris: alle check-*.ts-bestanden aangesloten of op de allowlist"
  fi
}
check_check_scripts

# ── Argumentafhandeling (gerichte run) ─────────────────────────────────────────────────────
# Twee argumentvormen, door elkaar toegestaan: `cases-<naam>.json` (één CPM-batterij, gaat naar
# de harness zoals voorheen) en `check-<naam>.ts` (één losse check-batterij — voorheen alleen via
# een volledige run bereikbaar). Onbekende namen worden verzameld en maken de run rood, maar
# blokkeren de rest niet: zelfde STATUS-accumulatie-filosofie als `bundle_check` hierboven — je
# ziet zo in één keer het hele beeld i.p.v. bij de eerste typefout af te breken.
# Beide vormen worden gededupliceerd: hetzelfde argument twee keer meegeven bundelt/draait het
# niet twee keer, en telt bij de "GERICHTE RUN"-samenvatting onderaan ook maar één keer mee als
# "wél gedraaid" (voorheen liet `check-x.ts check-x.ts` de skip-teller er één te veel uitzien).
CHECK_NAMES=()
if [ "$#" -gt 0 ]; then
  CASE_FILES=()
  UNKNOWN_ARGS=()
  declare -A SEEN_CASE_FILES=() SEEN_CHECK_NAMES=()
  for f in "$@"; do
    case "$f" in
      cases-*.json)
        if [ ! -f "$DIR/$f" ]; then
          UNKNOWN_ARGS+=("$f")
        elif [ -z "${SEEN_CASE_FILES[$f]:-}" ]; then
          CASE_FILES+=("$DIR/$f")
          SEEN_CASE_FILES[$f]=1
        fi
        ;;
      check-*.ts)
        if [ ! -f "$DIR/$f" ]; then
          UNKNOWN_ARGS+=("$f")
        elif [ -z "${SEEN_CHECK_NAMES[$f]:-}" ]; then
          CHECK_NAMES+=("$f")
          SEEN_CHECK_NAMES[$f]=1
        fi
        ;;
      *)
        UNKNOWN_ARGS+=("$f")
        ;;
    esac
  done
  for u in "${UNKNOWN_ARGS[@]}"; do
    echo "XX  onbekend argument: $u (verwacht cases-<naam>.json of check-<naam>.ts, bestaand in $DIR)"
    STATUS=1
  done
  FILES=("${CASE_FILES[@]}")
  RUN_HOLIDAYS=0
else
  FILES=()
  for f in "$DIR"/cases-*.json; do
    if ! is_auxiliary_case_data "$f"; then FILES+=("$f"); fi
  done
  RUN_HOLIDAYS=1   # volledige run: ook de holiday-generator-checks (fase 2.8a, §10.2)
fi

# Holiday-generator-checks (feestdagen-engine, los van de CPM-cases).
if [ "$RUN_HOLIDAYS" -eq 1 ]; then
  CHECK="$DIR/.holidays-check.mjs"
  if bundle_check "$DIR/check-holidays.ts" "$CHECK"; then node "$CHECK" || STATUS=1; fi

  # Web-opslaan-terugval: kiest de web-backend de download-route zodra de omgeving schrijven via
  # de File System Access API weigert? De embedded webview van de Claude-app heeft de complete API
  # maar geeft picker-handles nooit een readwrite-grant, dus feature-detectie kiest daar een route
  # die bij gebruik `NotAllowedError` gooit. Bewaakt óók de tegenkant: annuleren blijft geen fout
  # en een echte schrijffout (schijf vol) wordt niet stil in een download omgezet.
  WSFCHECK="$DIR/.web-save-fallback.mjs"
  if bundle_check "$DIR/check-web-save-fallback.ts" "$WSFCHECK"; then node "$WSFCHECK" || STATUS=1; fi

  # Datetime-substraat + duur-parser-checks (fase 2.8b golf 0, §8 — los van de CPM-cases).
  DTCHECK="$DIR/.datetime-check.mjs"
  if bundle_check "$DIR/check-datetime.ts" "$DTCHECK"; then node "$DTCHECK" || STATUS=1; fi

  # Commitmodus van het gedeelde datumveld (DateTextInput — pure reducers): één ingetypte datum mag
  # in de standaard 'blur'-modus precies EEN commit (en dus een undo-stap) opleveren.
  DICHECK="$DIR/.date-input-commit-check.mjs"
  if bundle_check "$DIR/check-date-input-commit.ts" "$DICHECK"; then node "$DICHECK" || STATUS=1; fi

  # "Je bent net geüpdatet"-vergelijklogica (releaseInfo.ts — pure functies, los van de CPM-cases).
  JUCHECK="$DIR/.just-updated-check.mjs"
  if bundle_check "$DIR/check-just-updated.ts" "$JUCHECK"; then node "$JUCHECK" || STATUS=1; fi

  # "Bestaat dit tekst-asset echt?"-poort van de in-app help (textAsset.ts — pure functies +
  # injecteerbare fetch). Zet de desktopbug vast waarbij een content-type-check ALLE help-artikelen
  # verwierp: de Tauri-webview labelt elke onbekende extensie (.md) als text/html.
  TACHECK="$DIR/.text-asset-check.mjs"
  if bundle_check "$DIR/check-text-asset.ts" "$TACHECK"; then node "$TACHECK" || STATUS=1; fi

  # Pre-paint-themaspiegel (issue #61): de handkopie van de themamap in index.html mag niet
  # ongemerkt afwijken van THEME_MIGRATION (settingsStore.ts) — dezelfde duplicatieklasse die dit
  # project elders wél mechanisch dichtzet.
  TPCHECK="$DIR/.theme-premirror-check.mjs"
  if bundle_check "$DIR/check-theme-premirror.ts" "$TPCHECK"; then node "$TPCHECK" || STATUS=1; fi

  # CalendarEngine uur-modus-checks (fase 2.8b golf 1, §4/§9 — engine-primitieven, los van de CPM-cases).
  CHCHECK="$DIR/.calendar-hours-check.mjs"
  if bundle_check "$DIR/check-calendar-hours.ts" "$CHCHECK"; then node "$CHCHECK" || STATUS=1; fi

  # Adapter-uur-precisie-checks (fase 2.8b golf 4, §7 — IFC/P6/MSPDI uur-round-trip + dag-discriminator).
  ADCHECK="$DIR/.adapters-hours-check.mjs"
  if bundle_check "$DIR/check-adapters-hours.ts" "$ADCHECK"; then node "$ADCHECK" || STATUS=1; fi

  # Lag-notatie + ploeg-preset-checks (gebruikstest-bevindingen F1/F2, 2026-08-15): uren-syntax in
  # parseLagInput/formatLagShort (round-trip + afgewezen invoer), updateSequence die lagMinutes nu
  # via de ECHTE store-actie zet/wist (voorheen alleen via een rauwe setState), en de "3 ploegen"-
  # preset (bandenstructuur, middernacht-wrap, CALENDAR_PRESETS-aanwezigheid).
  LFCHECK="$DIR/.lag-format-check.mjs"
  if bundle_check "$DIR/check-lag-format.ts" "$LFCHECK"; then node "$LFCHECK" || STATUS=1; fi

  # MPP-import (fase 3.8 e1): CFB/OLE2 + MPP14-lezer tegen het lokale corpus (echte bedrijfs-
  # bestanden, NIET in de repo). Zonder corpus (CI) slaat de check netjes over met een OK-regel.
  MPPCHECK="$DIR/.mpp-import.mjs"
  if bundle_check "$DIR/check-mpp-import.ts" "$MPPCHECK"; then node "$MPPCHECK" || STATUS=1; fi

  # MPP-kalenders (fase 3.8 e1, T6 — T6-kwaliteitsreview M7): gesplitst uit check-mpp-import.ts.
  # TBkndCal-lezer (mppCalendars.ts) — synthetische end-to-end/hostile-fixtures + corpus-/crawl-
  # secties (OPS_MPP_CORPUS/OPS_MPP_CRAWL, zelfde nette-skip-conventie als hierboven).
  MPPCALCHECK="$DIR/.mpp-calendars.mjs"
  if bundle_check "$DIR/check-mpp-calendars.ts" "$MPPCALCHECK"; then node "$MPPCALCHECK" || STATUS=1; fi

  # MPP-relaties/resources/assignments (fase 3.8 e1, T7): TBkndCons/TBkndRsc/TBkndAssn-lezers
  # (mppReader.ts's readRelations/readResources/readAssignments) — synthetische end-to-end/hostile-
  # fixtures + corpus-/crawl-secties (OPS_MPP_CORPUS/OPS_MPP_CRAWL, zelfde nette-skip-conventie).
  MPPRELCHECK="$DIR/.mpp-relations.mjs"
  if bundle_check "$DIR/check-mpp-relations.ts" "$MPPRELCHECK"; then node "$MPPRELCHECK" || STATUS=1; fi

  # T8-rooktest: 870d339f60603f71 (hash-only, §8) end-to-end (readMPP -> leaf-only CPMSolver,
  # exact het runCPM-pad) — bevat relaties op WBS-samenvattingstaken (in MS Project legaal) die
  # vóór de fix de forward pass lieten crashen. Zelfde nette-skip-conventie zonder corpus.
  MPPSUMCHECK="$DIR/.mpp-summary-relations.mjs"
  if bundle_check "$DIR/check-mpp-summary-relations.ts" "$MPPSUMCHECK"; then node "$MPPSUMCHECK" || STATUS=1; fi

  # MPP-datumgetrouwheid (fase 3.8, etappe "MSP-pariteit", plandocument T1 — baan M, het gedeelde
  # meetscript §5): `readMPP` + `solveProject` (de ECHTE runCPM-keten) tegen de ONAFHANKELIJKE
  # TBkndTask-grondwaarheid (mppGroundTruth.ts) — per-bestand-per-veld-pins tegen
  # mpp-fidelity-baseline.json (SHA-256-sleutels, geen bestandsnamen), plus een pad-pariteitscase
  # tegen de echte store. Corpus/crawl-afwezig ⇒ nette OK-skip, zelfde conventie als hierboven.
  MPPFIDCHECK="$DIR/.mpp-fidelity.mjs"
  if bundle_check "$DIR/check-mpp-fidelity.ts" "$MPPFIDCHECK"; then node "$MPPFIDCHECK" || STATUS=1; fi

  # Formaat-agnostische fidelitykern: rijvorm, minuutclassificatie en delta-administratie die de
  # MPP- en XER-meetlat delen zonder hun grondwaarheidparsers te koppelen.
  FIDCORECHECK="$DIR/.fidelity-core.mjs"
  if bundle_check "$DIR/check-fidelity-core.ts" "$FIDCORECHECK"; then node "$FIDCORECHECK" || STATUS=1; fi

  # XER-veldlijsten-poort (X0, XER-etappeplan §4.1/§6): whitelist/verboden/genegeerd als getypeerde
  # constanten (`check-xer-field-whitelist.ts`), getoetst tegen de union van alle TASK-%F-kolommen
  # over `OPS_XER_CORPUS` — het "gatenkaas"-mechanisme: een corpuskolom die in géén van de drie
  # bakken zit is ROOD. Corpus is publiek (§4.3): namen mogen in de uitvoer, geen hash-only-regime
  # zoals bij OPS_MPP_CORPUS. Corpus-afwezig ⇒ nette OK-skip, zelfde conventie als hierboven — dit
  # is dus GEEN CI-poort.
  XERWHITELISTCHECK="$DIR/.xer-field-whitelist.mjs"
  if bundle_check "$DIR/check-xer-field-whitelist.ts" "$XERWHITELISTCHECK"; then node "$XERWHITELISTCHECK" || STATUS=1; fi

  # XER-fidelity-baselinevorm (X0, XER-etappeplan §3/§6): het harness-skelet — er is nog geen lezer
  # (X1+), dus dit bewaakt alleen de VORM van `xer-fidelity-baseline.json` (`xerFidelityTypes.ts`)
  # via een compile-locked sleutellijst + een runtime-structuurvalidator. Corpusloos, draait altijd.
  XERBASELINESCHEMACHECK="$DIR/.xer-fidelity-baseline-schema.mjs"
  if bundle_check "$DIR/check-xer-fidelity-baseline-schema.ts" "$XERBASELINESCHEMACHECK"; then node "$XERBASELINESCHEMACHECK" || STATUS=1; fi

  # X12: corpusloze eindvangrail. Deze bewaakt uitsluitend de gereviewde openbare 93-entry
  # inventaris, onafhankelijke 34-entry-orakelselectie en task-replay-kruiscontract. Hij importeert
  # nooit reader/scanner/solver en draait daarom precies één keer vóór corpuschecks, niet in de
  # tijdzonematrix. De product-v2-eindbaseline bestaat nog niet; de oude v1-tweepinsbaseline blijft
  # expliciet een overgangsdossier en wordt hier niet als groen eindcontract voorgesteld.
  XERCORPUSLESSFIDELITYGATE="$DIR/.xer-corpusless-fidelity-gate.mjs"
  if bundle_check "$DIR/check-xer-corpusless-fidelity-gate.ts" "$XERCORPUSLESSFIDELITYGATE"; then
    node "$XERCORPUSLESSFIDELITYGATE" || STATUS=1
    unset 'BUNDLES[-1]'
  fi

  # Onafhankelijke XER-fidelitymeetlat (X1): eigen TASK-%T/%F/%R-scan, per-projectmeting,
  # zes poortassen + driving-path-rapportage en byte-/schema-dedup. Zonder publiek corpus draait
  # de synthetische kerncheck en slaat alleen de corpuspin expliciet over.
  XERFIDCHECK="$DIR/.xer-fidelity.mjs"
  if bundle_check "$DIR/check-xer-fidelity.ts" "$XERFIDCHECK"; then node "$XERFIDCHECK" || STATUS=1; fi

  # XER-formaatlaag (X2): corpusloze grammatica-/encoding-/CURRTYPE-fixtures. De productparser
  # blijft bewust onafhankelijk van X1's xerGroundTruth/xerFidelity-orakelpad.
  XERTABLESCHECK="$DIR/.xer-tables.mjs"
  if bundle_check "$DIR/check-xer-tables.ts" "$XERTABLESCHECK"; then node "$XERTABLESCHECK" || STATUS=1; fi

  # X3-kalenderdecoder: snelle grammatica-/semantiek-/TZ-fixtures, CALENDAR-hiërarchie,
  # uren-per-periode, P6XML-pariteit en de XER-eigen uurmodusregel.
  XERCALENDARCHECK="$DIR/.xer-calendar-data.mjs"
  if bundle_check "$DIR/check-xer-calendar-data.ts" "$XERCALENDARCHECK"; then node "$XERCALENDARCHECK" || STATUS=1; fi

  # X4a-project/taakmapping: corpusloze PROJECT/PROJWBS/TASK/TASKPRED-fixtures, enumterugval,
  # constraints, WBS-samenvattingen en externe-relatie-isolatie.
  XERREADERCHECK="$DIR/.xer-reader.mjs"
  if bundle_check "$DIR/check-xer-reader.ts" "$XERREADERCHECK"; then node "$XERREADERCHECK" || STATUS=1; fi

  # PROJECT-statusdatum: last_recalc_date blijft de exclusieve bestaande route; uitsluitend een
  # data_date-only-%F-dialect mag de fail-closed fallback openen.
  XERPROJECTDATACHECK="$DIR/.xer-project-data-date.mjs"
  if bundle_check "$DIR/check-xer-project-data-date.ts" "$XERPROJECTDATACHECK"; then node "$XERPROJECTDATACHECK" || STATUS=1; fi

  # X7: P6-actuals/voortgang, suspend/resume-firewall en projectspecifiek verwacht einde.
  XERPROGRESSCHECK="$DIR/.xer-progress.mjs"
  if bundle_check "$DIR/check-xer-progress.ts" "$XERPROGRESSCHECK"; then node "$XERPROGRESSCHECK" || STATUS=1; fi

  # X7 reviewfix 2: percentages worden uitsluitend uit hun expliciete P6-familie gelezen;
  # ontbrekend type houdt de legacy fysieke fallback zonder bronremaining te herschrijven.
  XERPROGRESSFAMILIESCHECK="$DIR/.xer-progress-families.mjs"
  if bundle_check "$DIR/check-xer-progress-families.ts" "$XERPROGRESSFAMILIESCHECK"; then node "$XERPROGRESSFAMILIESCHECK" || STATUS=1; fi

  # X7 reviewfix 2: de P6 suspend/resume-route is een blijvende invariant door edit, IFC,
  # recovery en solver heen; stale true mag na een los/omgekeerd paar niet herleven.
  XERSUSPENDINVARIANTCHECK="$DIR/.xer-suspend-invariant.mjs"
  if bundle_check "$DIR/check-xer-suspend-invariant.ts" "$XERSUSPENDINVARIANTCHECK"; then node "$XERSUSPENDINVARIANTCHECK" || STATUS=1; fi

  # X7 smalle solverfix: een geldige P6 suspend/resume-complete taak mag de bestaande
  # completed-windowroute gebruiken; alle andere vormen blijven fail-closed.
  XERCOMPLETEDSUSPENDCHECK="$DIR/.xer-completed-suspend-resume-window.mjs"
  if bundle_check "$DIR/check-xer-completed-suspend-resume-window.ts" "$XERCOMPLETEDSUSPENDCHECK"; then node "$XERCOMPLETEDSUSPENDCHECK" || STATUS=1; fi

  # X7 CP_Phys-grens: brondata blijft behouden, maar zonder bron-alleen discriminator opent
  # CP_Phys géén completed-windowroute; de fixture bewaakt de fail-closed- en inversegrens.
  XERCOMPLETEDCPPHYSCHECK="$DIR/.xer-completed-cp-phys-window.mjs"
  if bundle_check "$DIR/check-xer-completed-cp-phys-window.ts" "$XERCOMPLETEDCPPHYSCHECK"; then node "$XERCOMPLETEDCPPHYSCHECK" || STATUS=1; fi

  # X7 smalle solverfix: uitsluitend de bewezen completed XER-LOE-vorm mag de hammock-forwardtak
  # passeren en haar geregistreerde actualFinish als bestaande completed-route gebruiken.
  XERCOMPLETEDLOECHECK="$DIR/.xer-completed-loe-actual-finish.mjs"
  if bundle_check "$DIR/check-xer-completed-loe-actual-finish.ts" "$XERCOMPLETEDLOECHECK"; then node "$XERCOMPLETEDLOECHECK" || STATUS=1; fi

  # X12-residu Ashspace: uitsluitend de bewezen open XER TT_LOE-span met SS-in- en FF-uittopologie
  # mag het expliciete targetvenster gebruiken; de corpusloze mutatiematrix houdt alle andere vormen dicht.
  XEROPENLOETARGETSPANCHECK="$DIR/.xer-open-loe-target-span.mjs"
  if bundle_check "$DIR/check-xer-open-loe-target-span.ts" "$XEROPENLOETARGETSPANCHECK"; then node "$XEROPENLOETARGETSPANCHECK" || STATUS=1; fi

  # X7 reviewfix 2: suspend/resume/expected-finish kunnen zélf de XER-uurmodus activeren.
  XERX7HOURMODECHECK="$DIR/.xer-x7-hour-mode.mjs"
  if bundle_check "$DIR/check-xer-x7-hour-mode.ts" "$XERX7HOURMODECHECK"; then node "$XERX7HOURMODECHECK" || STATUS=1; fi

  # X7: zelfstandig bronorakel voor P6 voortgang/suspend-resume, zonder productiereader.
  XERPROGRESSCORPUSCHECK="$DIR/.xer-progress-corpus.mjs"
  if bundle_check "$DIR/check-xer-progress-corpus.ts" "$XERPROGRESSCORPUSCHECK"; then
    node "$XERPROGRESSCORPUSCHECK" || STATUS=1
    unset 'BUNDLES[-1]'
  fi

  XERPROJECTINDEXCHECK="$DIR/.xer-project-index.mjs"
  if bundle_check "$DIR/check-xer-project-index.ts" "$XERPROJECTINDEXCHECK"; then node "$XERPROJECTINDEXCHECK" || STATUS=1; fi

  # X4b-multi-projectkern: documentselectie, aanwezige P6-baselines, volledige terugval bij
  # zelfverwijzing/cycli, solverloze cross-projectlinks en geïsoleerde documentpayloads. De twee
  # openbare acceptatiepins draaien uitsluitend wanneer OPS_XER_CORPUS beschikbaar is.
  XERMULTIPROJECTCHECK="$DIR/.xer-multi-project.mjs"
  if bundle_check "$DIR/check-xer-multi-project.ts" "$XERMULTIPROJECTCHECK"; then node "$XERMULTIPROJECTCHECK" || STATUS=1; fi

  # X4b-wiring: de echte registry→fileSlice→documentroute opent één XER-bestand als losse,
  # geïsoleerde documenten met clean save-/recoverytoestand en een deterministische actieve tab.
  XEROPENWIRINGCHECK="$DIR/.xer-open-wiring.mjs"
  if bundle_check "$DIR/check-xer-open-wiring.ts" "$XEROPENWIRINGCHECK"; then node "$XEROPENWIRINGCHECK" || STATUS=1; fi

  # X5 SCHEDOPTIONS: pure mapping/defaults plus brongebonden solvervlaggen; de end-to-end-wiring
  # bouwt voort op X4b's per-projectdocumenten zonder diens open-fan-out te omzeilen.
  XERSCHEDOPTIONSCHECK="$DIR/.xer-schedule-options.mjs"
  if bundle_check "$DIR/check-xer-schedule-options.ts" "$XERSCHEDOPTIONSCHECK"; then node "$XERSCHEDOPTIONSCHECK" || STATUS=1; fi

  # X5 seriële wiring: per-project-SCHEDOPTIONS door X4b's echte meerdocumentreader, inclusief
  # defaults, bronmetadata, documentwissel/undo/recovery en de bestaande IFC-projectvelden.
  XERSCHEDOPTIONSWIRINGCHECK="$DIR/.xer-schedule-options-wiring.mjs"
  if bundle_check "$DIR/check-xer-schedule-options-wiring.ts" "$XERSCHEDOPTIONSWIRINGCHECK"; then node "$XERSCHEDOPTIONSWIRINGCHECK" || STATUS=1; fi

  # X5 zware openbare corpuspin: 27-kolommenunion en de 36 actuele bestanden zonder SCHEDOPTIONS,
  # per default/per as en tegen de onafhankelijke X1-meetlat. Eén keer draaien, niet per tijdzone.
  XERSCHEDOPTIONSCORPUSCHECK="$DIR/.xer-schedule-options-corpus.mjs"
  if bundle_check "$DIR/check-xer-schedule-options-corpus.ts" "$XERSCHEDOPTIONSCORPUSCHECK"; then
    node "$XERSCHEDOPTIONSCORPUSCHECK" || STATUS=1
    unset 'BUNDLES[-1]'
  fi

  # X4a-registercontract: .xer is lazy en binair, behoudt CP1252/UTF-16-BOM-bytes en wordt nooit
  # een opslagdoel.
  XERREGISTRYCHECK="$DIR/.xer-registry.mjs"
  if bundle_check "$DIR/check-xer-registry.ts" "$XERREGISTRYCHECK"; then node "$XERREGISTRYCHECK" || STATUS=1; fi

  XERCHUNKCHECK="$DIR/.xer-chunk-boundary.mjs"
  if bundle_check "$DIR/check-xer-chunk-boundary.ts" "$XERCHUNKCHECK"; then node "$XERCHUNKCHECK" || STATUS=1; fi

  XERARCHIVELIFECYCLECHECK="$DIR/.xer-source-archive-lifecycle.mjs"
  if bundle_check "$DIR/check-xer-source-archive-lifecycle.ts" "$XERARCHIVELIFECYCLECHECK"; then node "$XERARCHIVELIFECYCLECHECK" || STATUS=1; fi

  XERARCHIVEREADMODELCHECK="$DIR/.xer-archive-readmodel.mjs"
  if bundle_check "$DIR/check-xer-archive-readmodel.ts" "$XERARCHIVEREADMODELCHECK"; then node "$XERARCHIVEREADMODELCHECK" || STATUS=1; fi

  XERARCHIVECHAINCHECK="$DIR/.xer-source-archive-chain.mjs"
  if bundle_check "$DIR/check-xer-source-archive-chain.ts" "$XERARCHIVECHAINCHECK"; then node "$XERARCHIVECHAINCHECK" || STATUS=1; fi

  XERP6PRESENCECHECK="$DIR/.xer-p6-presence.mjs"
  if bundle_check "$DIR/check-xer-p6-presence.ts" "$XERP6PRESENCECHECK"; then node "$XERP6PRESENCECHECK" || STATUS=1; fi

  XERARCHIVESCALECHECK="$DIR/.xer-archive-scale.mjs"
  if bundle_check "$DIR/check-xer-archive-scale.ts" "$XERARCHIVESCALECHECK"; then node "$XERARCHIVESCALECHECK" || STATUS=1; fi

  XERP6XMLPARITYCHECK="$DIR/.xer-p6xml-parity.mjs"
  if bundle_check "$DIR/check-xer-p6xml-parity.ts" "$XERP6XMLPARITYCHECK"; then node "$XERP6XMLPARITYCHECK" || STATUS=1; fi

  XERX9VERDICTSCHECK="$DIR/.xer-x9-verdicts.mjs"
  if bundle_check "$DIR/check-xer-x9-verdicts.ts" "$XERX9VERDICTSCHECK"; then node "$XERX9VERDICTSCHECK" || STATUS=1; fi

  XEREXPORTLOSSCHECK="$DIR/.xer-export-loss.mjs"
  if bundle_check "$DIR/check-xer-export-loss.ts" "$XEREXPORTLOSSCHECK"; then node "$XEREXPORTLOSSCHECK" || STATUS=1; fi

  # X4a eerste echte productmeting: readXER + de gedeelde solveProject-keten tegen precies de twee
  # onafhankelijke acht-taaks P6-orakels uit het brief.
  XERPRODUCTFIDCHECK="$DIR/.xer-product-fidelity.mjs"
  if bundle_check "$DIR/check-xer-product-fidelity.ts" "$XERPRODUCTFIDCHECK"; then node "$XERPRODUCTFIDCHECK" || STATUS=1; fi

  # X12: de oude twee-pinmeting blijft tijdelijk als regressiedossier bestaan, maar deze adapter
  # meet de echte productketen over iedere door X1 geselecteerde entry en elk geïmporteerd project.
  X12PRODUCTFIDCHECK="$DIR/.xer-product-fidelity-x12.mjs"
  if bundle_check "$DIR/check-xer-product-fidelity-x12.ts" "$X12PRODUCTFIDCHECK"; then
    node "$X12PRODUCTFIDCHECK" || STATUS=1
  fi

  # XER task-level counterfactual replay: corpusloze I/R/U-, oracle-firewall- en identityfixtures;
  # met OPS_XER_CORPUS daarnaast de canonieke X12-selectie entry/project-voor-entry/project.
  XERTASKREPLAYCHECK="$DIR/.xer-task-replay.mjs"
  if bundle_check "$DIR/check-xer-task-replay.ts" "$XERTASKREPLAYCHECK"; then
    node "$XERTASKREPLAYCHECK" || STATUS=1
    unset 'BUNDLES[-1]'
  fi

  # XER completed-backward/float-trace: corpusloze beslisbroninstrumentatie. Deze check
  # leest geen oracle of classificatie en bewaakt uitsluitend de optionele CPMResult-trace.
  XERBACKWARDFLOATTRACECHECK="$DIR/.xer-backward-float-trace.mjs"
  if bundle_check "$DIR/check-xer-backward-float-trace.ts" "$XERBACKWARDFLOATTRACECHECK"; then
    node "$XERBACKWARDFLOATTRACECHECK" || STATUS=1
  fi

  # X4a oorspronkelijke bytes: CP1252 + beide UTF-16-BOM-vormen door web, Tauri, recents en de
  # dev-bridge; de MCP-route heeft dezelfde drie fixtures in tests/mcp/cases-doc-file.ts.
  XERBYTEPATHCHECK="$DIR/.xer-byte-paths.mjs"
  if bundle_check "$DIR/check-xer-byte-paths.ts" "$XERBYTEPATHCHECK"; then node "$XERBYTEPATHCHECK" || STATUS=1; fi

  # X9 — exact bronarchief en de self-contained IFC-manifest/chunkcontainer.
  XERSOURCEARCHIVECHECK="$DIR/.xer-source-archive.mjs"
  if bundle_check "$DIR/check-xer-source-archive.ts" "$XERSOURCEARCHIVECHECK"; then node "$XERSOURCEARCHIVECHECK" || STATUS=1; fi

  IFCXERARCHIVECHECK="$DIR/.ifc-xer-archive-container.mjs"
  if bundle_check "$DIR/check-ifc-xer-archive-container.ts" "$IFCXERARCHIVECHECK"; then node "$IFCXERARCHIVECHECK" || STATUS=1; fi

  # P0: corpusloze, onafhankelijke bronretentiepoort over import, edit/CPM, undo/redo,
  # documentwissel/-kopie, recovery en IFC. De STEP-envelope wordt zonder product-reader gecheckt.
  XERSOURCERETENTIONCHECK="$DIR/.xer-source-retention.mjs"
  if bundle_check "$DIR/check-xer-source-retention.ts" "$XERSOURCERETENTIONCHECK"; then node "$XERSOURCERETENTIONCHECK" || STATUS=1; fi

  # X9-compactopslag: schema-2 bewaart alleen de gehashte bronbytes; diagnostics/readmodel
  # worden bij lezen opnieuw uit die zelfstandige bron afgeleid. Schema-1 blijft invoerbaar.
  XERARCHIVECOMPACTCHECK="$DIR/.xer-archive-compact.mjs"
  if bundle_check "$DIR/check-xer-archive-compact.ts" "$XERARCHIVECOMPACTCHECK"; then node "$XERARCHIVECOMPACTCHECK" || STATUS=1; fi

  # X9 reviewfix 1: schema-2 XER-bronarchieven moeten in een nieuw Node-proces via de ENIGE
  # officiële asynchrone IFC-ingang zelfstandig herleven; de lage sync-lezer moet veilig verwijzen.
  XERARCHIVECOLDREADCHECK="$DIR/.xer-archive-cold-read.mjs"
  if bundle_check "$DIR/check-xer-archive-cold-read.ts" "$XERARCHIVECOLDREADCHECK"; then node "$XERARCHIVECOLDREADCHECK" || STATUS=1; fi

  # X9: drie verse corpusprocessen. maxRSS is de OS-gemeten piek van de hele IFC- of
  # recoveryketen, niet een misleidende netto heapdelta.
  XERARCHIVERECOVERYCORPUSCHECK="$DIR/.xer-archive-recovery-corpus.mjs"
  if bundle_check "$DIR/check-xer-archive-recovery-corpus.ts" "$XERARCHIVERECOVERYCORPUSCHECK"; then
    node "$XERARCHIVERECOVERYCORPUSCHECK" || STATUS=1
    unset 'BUNDLES[-1]'
  fi

  # X6: RSRC/RSRCRATE/TASKRSRC, immutable retained bronrijen en het X4b-aliasingcontract.
  # De check is datumvrij en draait daarom slechts eenmaal buiten de tijdzonematrix.
  XERRESOURCESCHECK="$DIR/.xer-resources.mjs"
  if bundle_check "$DIR/check-xer-resources.ts" "$XERRESOURCESCHECK"; then
    node "$XERRESOURCESCHECK" || STATUS=1
    unset 'BUNDLES[-1]'
  fi

  # X6: echte storeduplicatie met een rehab-grote retained catalogus. Ook deze check is datumvrij.
  XERRESOURCEDUPLICATECHECK="$DIR/.xer-resource-duplicate.mjs"
  if bundle_check "$DIR/check-xer-resource-duplicate.ts" "$XERRESOURCEDUPLICATECHECK"; then
    node "$XERRESOURCEDUPLICATECHECK" || STATUS=1
    unset 'BUNDLES[-1]'
  fi

  # X8: metadata wordt éénmaal file-wide gemapt; de wiringfixture bewaakt projectisolatie,
  # FT_STATICTYPE, DEL-DEL en de verplichte TASKACTV-mutatietelling.
  XERMETADATAWIRINGCHECK="$DIR/.xer-metadata-wiring.mjs"
  if bundle_check "$DIR/check-xer-metadata-wiring.ts" "$XERMETADATAWIRINGCHECK"; then node "$XERMETADATAWIRINGCHECK" || STATUS=1; fi

  XERMETADATAINDEXCHECK="$DIR/.xer-metadata-index.mjs"
  if bundle_check "$DIR/check-xer-metadata-index.ts" "$XERMETADATAINDEXCHECK"; then node "$XERMETADATAINDEXCHECK" || STATUS=1; fi

  XERMETADATAREVIEWCHECK="$DIR/.xer-metadata-review.mjs"
  if bundle_check "$DIR/check-xer-metadata-review.ts" "$XERMETADATAREVIEWCHECK"; then node "$XERMETADATAREVIEWCHECK" || STATUS=1; fi

  # X8: onafhankelijke ruwe tellingen plus de twee zware openbare performanceprofielen.
  XERMETADATACORPUSCHECK="$DIR/.xer-metadata-corpus.mjs"
  if bundle_check "$DIR/check-xer-metadata-corpus.ts" "$XERMETADATACORPUSCHECK"; then
    node "$XERMETADATACORPUSCHECK" || STATUS=1
    unset 'BUNDLES[-1]'
  fi

  # X6: onafhankelijke, hashgepinde corpusmeting. Deze draait eenmaal met expliciete GC, zodat
  # parser- en kernheapdelta's vergelijkbaar blijven en nooit in de tijdzonematrix vallen.
  XERRESOURCECORPUSCHECK="$DIR/.xer-resource-corpus.mjs"
  if bundle_check "$DIR/check-xer-resource-corpus.ts" "$XERRESOURCECORPUSCHECK"; then
    node --expose-gc "$XERRESOURCECORPUSCHECK" || STATUS=1
    unset 'BUNDLES[-1]'
  fi

  # X3-openbare corpuspin: de echte productie-ingang zonder rijvoorfilter, vier concrete
  # herstel-/weigerhashes, basegraafpin en de statische 124-kalenderdigest. Deze zware scan draait
  # bewust één keer en wordt daarom na het bundelen uit de tijdzonematrix verwijderd.
  XERCALENDARCORPUSCHECK="$DIR/.xer-calendar-corpus.mjs"
  if bundle_check "$DIR/check-xer-calendar-corpus.ts" "$XERCALENDARCORPUSCHECK"; then
    node "$XERCALENDARCORPUSCHECK" || STATUS=1
    unset 'BUNDLES[-1]'
  fi

  # X2-corpuspoort: alle kedular-parserfixtures en publieke p6xer-robuustheidsgevallen zijn op
  # concrete rapportinhoud of typed foutcode gepind. Zonder corpus een expliciete groene skip.
  XERCORPUSCHECK="$DIR/.xer-corpus.mjs"
  if bundle_check "$DIR/check-xer-corpus.ts" "$XERCORPUSCHECK"; then node "$XERCORPUSCHECK" || STATUS=1; fi

  # P6 23.12-capture: uitsluitend de ruwe *_p6-kolommen met tijden; enginekolommen en de
  # genormaliseerde PASS-oordelen zijn expliciet geen meetlat. Met OPS_P6_COMPARISON wordt ook de
  # generator byte-identiek tegen de publieke bron gedraaid.
  P6VERIFIEDCHECK="$DIR/.p6-verified-cases.mjs"
  if bundle_check "$DIR/check-p6-verified-cases.ts" "$P6VERIFIEDCHECK"; then node "$P6VERIFIEDCHECK" || STATUS=1; fi

  # Opslagdoel-guard voor binaire bronformaten (fase 3.8 e1, T8-stap 5a): `fileSlice.openFile`
  # via de echte `<input type=file>`-terugval — .mpp krijgt GEEN opslagdoel, .ifc (contrast) wel.
  # Corpusdeel volgt dezelfde skip-OK-conventie als hierboven.
  MPPGUARDCHECK="$DIR/.mpp-open-guard.mjs"
  if bundle_check "$DIR/check-mpp-open-guard.ts" "$MPPGUARDCHECK"; then node "$MPPGUARDCHECK" || STATUS=1; fi

  # Chunk-poort (fase 3.8 e1, T11 — T8-review-agenda stap 0-ter d): '@/services/mpp' mag NERGENS
  # onder src/ statisch geïmporteerd worden, alleen als `await import(` in formatRegistry.ts —
  # anders trekt Rollup de mpp-parser (CFB/fieldmaps) alsnog in de main chunk. Geen corpus nodig,
  # draait altijd (pure node:fs-grep, geen store/DOM).
  MPPCHUNKCHECK="$DIR/.mpp-chunk-boundary.mjs"
  if bundle_check "$DIR/check-mpp-chunk-boundary.ts" "$MPPCHUNKCHECK"; then node "$MPPCHUNKCHECK" || STATUS=1; fi

  # MSPDI-baseline-export-regressie: `fileSlice.exportAs('mspdi')` gaf `writeMSPDI` maar zeven van
  # de negen argumenten mee, waardoor `baselines`/`activeBaselineId` op hun defaults ([]/null)
  # vielen en de baseline stil uit de MS-Project-export verdween (de reader leest hem wél).
  # Draait de ECHTE store-exportactie (niet writeMSPDI direct) en leest het resultaat terug.
  MBCHECK="$DIR/.mspdi-baseline-export.mjs"
  if bundle_check "$DIR/check-mspdi-baseline-export.ts" "$MBCHECK"; then node "$MBCHECK" || STATUS=1; fi
  # Contour-engine (2026-09): engine-kern, lastlezer-integratie, herschaling bij bewerken en de
  # native MSPDI-/P6-/IFC-round-trip van contouren en 21-punts-curves.
  CECHECK="$DIR/.check-contour-engine.mjs"
  if bundle_check "$DIR/check-contour-engine.ts" "$CECHECK"; then node "$CECHECK" || STATUS=1; fi

  # Geavanceerde-CPM golf-0-checks (fase 2.9 — datamodel + plumbing default-inert, los van de CPM-cases).
  ACPMCHECK="$DIR/.advanced-cpm-check.mjs"
  if bundle_check "$DIR/check-advanced-cpm.ts" "$ACPMCHECK"; then node "$ACPMCHECK" || STATUS=1; fi

  # Samenvattingsrelatie-propagatie (vervolg op 489a9ef2): unit-/hostile-checks voor de PURE
  # `expandSummaryRelations`-functie (boomtopologie, cyclusvastheid, de MAX_EXPANDED_RELATIONS-klem)
  # — los van de vier end-to-end-vormen die via de echte store lopen (cases-edge.json,
  # "wbs-summary-relation-*") en los van de corpus-check hierboven.
  SUMEXPCHECK="$DIR/.summary-relation-expansion.mjs"
  if bundle_check "$DIR/check-summary-relation-expansion.ts" "$SUMEXPCHECK"; then node "$SUMEXPCHECK" || STATUS=1; fi

  # moveAssignment-checks (fase 2.10, golf D, item 4 — headless tegen de echte store, guards +
  # resourceIds-boekhouding, los van de CPM-cases).
  MACHECK="$DIR/.move-assignment-check.mjs"
  if bundle_check "$DIR/check-move-assignment.ts" "$MACHECK"; then node "$MACHECK" || STATUS=1; fi

  # assignResource-guard-checks (M6-conventie: onbekend/null resourceId stil weigeren; plus
  # defensieve writeIFC tegen reeds vergiftigde toewijzingen — de auto-save-crash-regressie).
  ARGCHECK="$DIR/.assign-resource-guard-check.mjs"
  if bundle_check "$DIR/check-assign-resource-guard.ts" "$ARGCHECK"; then node "$ARGCHECK" || STATUS=1; fi

  # "Project verplaatsen"-checks (pakket D1 — veld-voor-veld shift-verdicten, R7-feestdagendekking,
  # preview-zuiverheid en de R8/R9-guards; headless tegen de echte store + pure engine-helpers,
  # los van de CPM-cases in cases-move-project.json).
  MPCHECK="$DIR/.move-project-check.mjs"
  if bundle_check "$DIR/check-move-project.ts" "$MPCHECK"; then node "$MPCHECK" || STATUS=1; fi

  # T7b (plan-§9/O2-vervolg, orkestratorbesluit 2026-08-15 — optie B): projectstart-
  # bewerkbescherming — een LATERE `setProject({ startDate })` klemt wortel-ankers zonder
  # voorganger/constraint vooruit, met melding; geïmporteerde bestanden (loadState/
  # applyLoadedProject) raken dit pad niet. Headless tegen de echte store; registratie hier is de
  # eerste sinds T1 (baan M is klaar, `run.sh` was daarna weer vrij voor een nieuwe check).
  PSACHECK="$DIR/.project-start-anchor-check.mjs"
  if bundle_check "$DIR/check-project-start-anchor.ts" "$PSACHECK"; then node "$PSACHECK" || STATUS=1; fi

  # moveTask-cykelguard + addTask.notes-checks (fase 2.10 onderdeel 2, QA-fixes P1/4 — headless
  # tegen de echte store, los van de CPM-cases).
  MTCHECK="$DIR/.move-task-check.mjs"
  if bundle_check "$DIR/check-move-task.ts" "$MTCHECK"; then node "$MTCHECK" || STATUS=1; fi

  # H1 (Opus-review T15-fixronde, B1-BLOKKER): store-niveau-bewijs dat `applyProgressInvariants`
  # (taskSlice.ts) een 100%-taak zonder statusdatum op haar EIGEN geplande finish pint, niet op
  # "vandaag" — en dat scheduleStale altijd gezet wordt, ook zonder statusdatum.
  TSCHECK="$DIR/.task-slice-check.mjs"
  if bundle_check "$DIR/check-task-slice.ts" "$TSCHECK"; then node "$TSCHECK" || STATUS=1; fi
  EXTEDITCHECK="$DIR/.external-link-edit.mjs"
  if bundle_check "$DIR/check-external-link-edit.ts" "$EXTEDITCHECK"; then node "$EXTEDITCHECK" || STATUS=1; fi

  # Tauri-verversing van externe relaties (tabel-overhaul, eindreview-bewijs): gehashte before/
  # after/source-IFC's uit de ECHTE desktop-app (docs/superpowers/evidence/tabel-overhaul-*.md)
  # tonen dat de lintactie "Alle externe relaties vernieuwen" het verouderde anker/sourceMissing/
  # identiteit herstelt via OPS_TaskIdentity/InternalProjectId/GlobalId-terugvallen. Was tot 2026-09
  # een wees (bestond, typechecte mee via tsconfig.check.json, maar door geen `bundle_check`-regel
  # aangeroepen — zie de check-scriptinventaris bovenin dit script); groen in isolatie bevonden,
  # dus hier alsnog aangesloten in plaats van op de allowlist gezet.
  TAURIREFRESHCHECK="$DIR/.tauri-refresh-evidence.mjs"
  if bundle_check "$DIR/check-tauri-refresh-evidence.ts" "$TAURIREFRESHCHECK"; then node "$TAURIREFRESHCHECK" || STATUS=1; fi

  # Documentcontract-checks (audit P10, F1/F3 — key-gedreven capture/hydrate/reset, Snapshot-subset,
  # B3-regressie, recovery-round-trip; headless tegen de echte store, los van de CPM-cases).
  DCCHECK="$DIR/.document-contract-check.mjs"
  if bundle_check "$DIR/check-document-contract.ts" "$DCCHECK"; then node "$DCCHECK" || STATUS=1; fi

  CTTCHECK="$DIR/.custom-task-types-check.mjs"
  if bundle_check "$DIR/check-custom-task-types.ts" "$CTTCHECK"; then node "$CTTCHECK" || STATUS=1; fi

  # Band-collapse (issue #35): "alle groepen in-/uitklappen" via de echte store-acties. De valkuil
  # is de sleutelbron: een ingeklapte band emit zijn subbanden niet, dus een route via `viewRows`
  # slaat precies de al-dichtgeklapte takken over. Aantoonbaar rood tegen die naïeve route.
  BCCHECK="$DIR/.band-collapse.mjs"
  if bundle_check "$DIR/check-band-collapse.ts" "$BCCHECK"; then node "$BCCHECK" || STATUS=1; fi

  # Contextmenu-reikwijdte (issue #45): de muterende taakitems werkten op de AANGEKLIKTE taak in
  # plaats van op de selectie. Draait exact de functies die GanttCanvas aan het contextmenu hangt en
  # bewaakt naast de reikwijdte ook de undo-KOSTEN — één menuklik = één Ctrl+Z. Die tweede helft
  # kan stil afdrijven: een naïeve lus over de per-taak-mutators geeft dezelfde zichtbare uitkomst
  # maar N undo-stappen.
  CMSCHECK="$DIR/.context-menu-scope.mjs"
  if bundle_check "$DIR/check-context-menu-scope.ts" "$CMSCHECK"; then node "$CMSCHECK" || STATUS=1; fi

  # Rasternavigatie (issue #48): de gedeelde kern onder de takentabel én de resourcetabel. Bewaakt
  # het RANDgedrag (buur aan de rand = null, niet klemmen — daar hangt "Enter op de laatste rij maakt
  # een nieuwe rij" aan) en het TOETSbeleid in een live raster: ↑/↓ mogen alleen in een tekstveld
  # navigeren, want in een <select> of een number-spinner zou dat de optiekeuze resp. het stappen
  # opeten. Dat laatste is precies het soort regressie dat een "werkt de navigatie?"-test mist.
  GRIDCHECK="$DIR/.grid-nav.mjs"
  if bundle_check "$DIR/check-grid-nav.ts" "$GRIDCHECK"; then node "$GRIDCHECK" || STATUS=1; fi
  RDICHECK="$DIR/.row-drag-intent.mjs"
  if bundle_check "$DIR/check-row-drag-intent.ts" "$RDICHECK"; then node "$RDICHECK" || STATUS=1; fi
  TGSELCHECK="$DIR/.task-grid-selection.mjs"
  if bundle_check "$DIR/check-task-grid-selection.ts" "$TGSELCHECK"; then node "$TGSELCHECK" || STATUS=1; fi
  TGVIRTCHECK="$DIR/.task-grid-virtualization.mjs"
  if bundle_check "$DIR/check-task-grid-virtualization.ts" "$TGVIRTCHECK"; then node "$TGVIRTCHECK" || STATUS=1; fi
  TGCLIPCHECK="$DIR/.task-grid-clipboard.mjs"
  if bundle_check "$DIR/check-task-grid-clipboard.ts" "$TGCLIPCHECK"; then node "$TGCLIPCHECK" || STATUS=1; fi
  EXTRELFORMATCHECK="$DIR/.external-relation-format.mjs"
  if bundle_check "$DIR/check-external-relation-format.ts" "$EXTRELFORMATCHECK"; then node "$EXTRELFORMATCHECK" || STATUS=1; fi
  RELSETPLANCHECK="$DIR/.relation-set-plan.mjs"
  if bundle_check "$DIR/check-relation-set-plan.ts" "$RELSETPLANCHECK"; then node "$RELSETPLANCHECK" || STATUS=1; fi
  RELCELLCHECK="$DIR/.relation-cell.mjs"
  if bundle_check "$DIR/check-relation-cell.ts" "$RELCELLCHECK"; then node "$RELCELLCHECK" || STATUS=1; fi
  RELCELLEDITORCHECK="$DIR/.relation-cell-editor.mjs"
  if bundle_check "$DIR/check-relation-cell-editor.ts" "$RELCELLEDITORCHECK"; then node "$RELCELLEDITORCHECK" || STATUS=1; fi
  RELRIBBONTRACECHECK="$DIR/.relation-ribbon-trace.mjs"
  if bundle_check "$DIR/check-relation-ribbon-trace.ts" "$RELRIBBONTRACECHECK"; then node "$RELRIBBONTRACECHECK" || STATUS=1; fi
  RELPANELPARITYCHECK="$DIR/.relations-panel-parity.mjs"
  if bundle_check "$DIR/check-relations-panel-parity.ts" "$RELPANELPARITYCHECK"; then node "$RELPANELPARITYCHECK" || STATUS=1; fi
  TGI18NCHECK="$DIR/.task-grid-i18n.mjs"
  if bundle_check "$DIR/check-task-grid-i18n.ts" "$TGI18NCHECK"; then node "$TGI18NCHECK" || STATUS=1; fi
  TGPERFCHECK="$DIR/.task-grid-performance.mjs"
  if bundle_check "$DIR/check-task-grid-performance.ts" "$TGPERFCHECK"; then
    # Deze poort is tijdzone-onafhankelijk en zwaar. Dwing hier normale CI-poorten af, ook als een
    # aanroepende shell OPS_RELAX_PERF=1 heeft, en neem hem niet vijf keer extra mee in de TZ-matrix.
    OPS_RELAX_PERF=0 node "$TGPERFCHECK" || STATUS=1
    unset 'BUNDLES[-1]'
  fi
  # Bulk-plak-performance (FIX 5 uit de eindreview): eigen zware, tijdzone-onafhankelijke poort,
  # zelfde reden als hierboven om hem niet vijf keer extra in de TZ-matrix mee te nemen. Aanbeveling
  # 3 (onafhankelijke eindreview): OPS_RELAX_PERF hier net zo hard afdwingen als bij TGPERFCHECK.
  TGPASTEPERFCHECK="$DIR/.task-grid-paste-performance.mjs"
  if bundle_check "$DIR/check-task-grid-paste-performance.ts" "$TGPASTEPERFCHECK"; then
    OPS_RELAX_PERF=0 node "$TGPASTEPERFCHECK" || STATUS=1
    unset 'BUNDLES[-1]'
  fi
  TGARIACHECK="$DIR/.task-grid-aria.mjs"
  if bundle_check "$DIR/check-task-grid-aria.ts" "$TGARIACHECK"; then node "$TGARIACHECK" || STATUS=1; fi
  TGDOMCHECK="$DIR/.task-grid-dom-budget.mjs"
  if bundle_check "$DIR/check-task-grid-dom-budget.ts" "$TGDOMCHECK"; then node "$TGDOMCHECK" || STATUS=1; fi
  TGCOLUMNSCHECK="$DIR/.task-grid-columns.mjs"
  if bundle_check "$DIR/check-task-grid-columns.ts" "$TGCOLUMNSCHECK"; then node "$TGCOLUMNSCHECK" || STATUS=1; fi
  TGADAPTERCHECK="$DIR/.task-grid-adapter.mjs"
  if bundle_check "$DIR/check-task-grid-adapter.ts" "$TGADAPTERCHECK"; then node "$TGADAPTERCHECK" || STATUS=1; fi
  TGCELLEDITORCHECK="$DIR/.task-cell-editor.mjs"
  if bundle_check "$DIR/check-task-cell-editor.ts" "$TGCELLEDITORCHECK"; then node "$TGCELLEDITORCHECK" || STATUS=1; fi
  TGEDITORSCHECK="$DIR/.task-grid-editors.mjs"
  if bundle_check "$DIR/check-task-grid-editors.ts" "$TGEDITORSCHECK"; then node "$TGEDITORSCHECK" || STATUS=1; fi
  TGASSIGNMENTSCHECK="$DIR/.task-grid-assignments.mjs"
  if bundle_check "$DIR/check-task-grid-assignments.ts" "$TGASSIGNMENTSCHECK"; then node "$TGASSIGNMENTSCHECK" || STATUS=1; fi
  TGFULLSURFACECHECK="$DIR/.full-task-grid-surface.mjs"
  if bundle_check "$DIR/check-full-task-grid-surface.ts" "$TGFULLSURFACECHECK"; then node "$TGFULLSURFACECHECK" || STATUS=1; fi
  # Issue #89: naaminspringing, één tooltip per cel, plusknop met lucht, naameditor op volle breedte.
  TGPRESENTATIONCHECK="$DIR/.task-grid-presentation.mjs"
  if bundle_check "$DIR/check-task-grid-presentation.ts" "$TGPRESENTATIONCHECK"; then node "$TGPRESENTATIONCHECK" || STATUS=1; fi
  TGKEYROUTECHECK="$DIR/.task-grid-keyboard-event-routing.mjs"
  if bundle_check "$DIR/check-keyboard-event-routing.ts" "$TGKEYROUTECHECK"; then node "$TGKEYROUTECHECK" || STATUS=1; fi
  EXTLDIALOGCHECK="$DIR/.external-link-dialog.mjs"
  if bundle_check "$DIR/check-external-link-dialog.ts" "$EXTLDIALOGCHECK"; then node "$EXTLDIALOGCHECK" || STATUS=1; fi
  GANTTWORKSPACECHECK="$DIR/.gantt-workspace.mjs"
  if bundle_check "$DIR/check-gantt-workspace.ts" "$GANTTWORKSPACECHECK"; then node "$GANTTWORKSPACECHECK" || STATUS=1; fi

  # X11: documenttabstrip is ook bij 12+ open projecten volledig bereikbaar. De pure
  # toetsenbord-/zichtbaarheidskern voorkomt dat tab 10–12 buiten Ctrl/Cmd-1..9 een dead-end
  # worden; de browserproef controleert daarnaast de echte DOM en scrollcontainer.
  DTNCHECK="$DIR/.document-tab-navigation.mjs"
  if bundle_check "$DIR/check-document-tab-navigation.ts" "$DTNCHECK"; then node "$DTNCHECK" || STATUS=1; fi

  # Gantt-cull-regressie: de speling-band mag niet verdwijnen zolang hij zichtbaar is. De cull in
  # drawTaskBar keek alleen naar de BALK-extent, terwijl de band ná de balk doorloopt — een band die
  # nog honderden pixels in beeld stond verdween daardoor mee. Draait de echte renderer met een
  # opnemende 2D-context-stub (aantoonbaar rood tegen de oude cull).
  GFCHECK="$DIR/.gantt-float-cull.mjs"
  if bundle_check "$DIR/check-gantt-float-cull.ts" "$GFCHECK"; then node "$GFCHECK" || STATUS=1; fi

  # Gantt-renderopties (K-item 33): de pure afleidingen die BEPALEN wat er in `GanttRenderOptions`
  # komt (tijdas-oorsprong, contentspan, baseline-overlay, trace, histogramreeks). De andere
  # renderer-batterijen bouwen die opties met de hand op en staan dus stroomafwaarts van dit
  # rekenwerk — een fout hierin gaf geen rode suite maar een scheve Gantt. Bevat een
  # karakteriseringsdeel: verbatim kopieën van de pre-extractie-code als orakel.
  GROCHECK="$DIR/.gantt-render-options.mjs"
  if bundle_check "$DIR/check-gantt-render-options.ts" "$GROCHECK"; then node "$GROCHECK" || STATUS=1; fi

  # Tabel-overhaul Task 16: timelinecanvassen hebben oorsprong 0; het full-width histogram houdt
  # uitsluitend pickerWidth als semantische linkerzone en begint zijn primaire datumplot daar.
  GCCHECK="$DIR/.gantt-coordinate-contracts.mjs"
  if bundle_check "$DIR/check-gantt-coordinate-contracts.ts" "$GCCHECK"; then node "$GCCHECK" || STATUS=1; fi

  # Issue #73: de gedeelde scope voor taakcontextuele resources houdt zijpaneel, histogram en
  # histogramtooltip bij dezelfde geselecteerde taak/taken, zonder de ongescoped weergave te breken.
  TRSCHECK="$DIR/.task-resource-scope.mjs"
  if bundle_check "$DIR/check-task-resource-scope.ts" "$TRSCHECK"; then node "$TRSCHECK" || STATUS=1; fi

  # Gantt-coördinatorgrenzen (onderhoudbaarheidsprogramma plan 3): de rendererhost, viewport- en
  # pointercoördinator krijgen expliciete input/outputcontracten zonder AppState-megaobject of
  # singletonselector. De browserbatterij bewaakt gedrag; deze headless poort bewaakt eigenaarschap.
  GCCHECK="$DIR/.gantt-coordinator-contracts.mjs"
  if bundle_check "$DIR/check-gantt-coordinator-contracts.ts" "$GCCHECK"; then node "$GCCHECK" || STATUS=1; fi

  # Mechanische Gantt-grenspoort (onderhoudbaarheidsprogramma plan 3): draait dezelfde AST-check
  # als npm run verify en bewijst met tijdelijke bronfixtures dat echte grenslekken rood worden,
  # terwijl woorden in commentaar en strings geen vals alarm geven.
  GBCHECK="$DIR/.gantt-boundaries.mjs"
  if bundle_check "$DIR/check-gantt-boundaries.ts" "$GBCHECK"; then node "$GBCHECK" || STATUS=1; fi

  # Zoomstap-regressie (K-item 34, voorbereidend): de in-/uitzoomstap stond op drie plekken los en
  # twee ervan zoomden in met 10 maar uit met 5 — heen en weer klikken bracht je niet terug waar je
  # begon. Toetst het gedrag én dat er nergens in src/ nog een kale zoomwaarde naast setZoom staat.
  ZOOMCHECK="$DIR/.zoom-steps.mjs"
  if bundle_check "$DIR/check-zoom-steps.ts" "$ZOOMCHECK"; then node "$ZOOMCHECK" || STATUS=1; fi

  # "Spring naar taak"-geometrie (issue #65, WBS-sprongknop bij afhankelijkheden): het zoomniveau
  # en de verticale/horizontale scroll klemmen op de juiste boven-/ondergrenzen i.p.v. een taak van
  # jaren tot een streepje te laten verschrompelen of een milestone tot in het oneindige in te
  # zoomen.
  FOCUSCHECK="$DIR/.focus-task.mjs"
  if bundle_check "$DIR/check-focus-task.ts" "$FOCUSCHECK"; then node "$FOCUSCHECK" || STATUS=1; fi

  # Issue #53 (Waarschuwingenpaneel): de pure verzamelaar over cpmResult/resourceLoadResult, de
  # solver-uitbreiding `cycleTaskIds`, de navigatie naar taak/relatie/resource/cyclus op een echte
  # store, en de setUI-invarianten voor het derde railpaneel.
  WARNCHECK="$DIR/.schedule-warnings.mjs"
  if bundle_check "$DIR/check-schedule-warnings.ts" "$WARNCHECK"; then node "$WARNCHECK" || STATUS=1; fi

  # Tabel-overhaul Task 1: stabiele rowKeys voor boom-, groeps- en dubbele resource-occurrences,
  # occurrence-range met unieke domeinselectie en cursorherstel als filter/collapse een rij wist.
  VRKCHECK="$DIR/.view-row-key.mjs"
  if bundle_check "$DIR/check-view-row-key.ts" "$VRKCHECK"; then node "$VRKCHECK" || STATUS=1; fi

  # Gantt-eventeigenaars (tabel-overhaul task 0): iedere actie heeft precies één actuele
  # eigenaar, zodat de DOM-gridmigratie geen dubbele canvas-/DOM-listeners achterlaat.
  GEO_CHECK="$DIR/.gantt-event-ownership.mjs"
  if bundle_check "$DIR/check-gantt-event-ownership.ts" "$GEO_CHECK"; then node "$GEO_CHECK" || STATUS=1; fi

  # Dependencyrij-presentatie (issue #65, polishronde): één vast gridschema met gereserveerde
  # driving-kolom, rolkleuren uit hetzelfde palet als Gantt path tracing, afkapping van lange WBS-
  # codes en uitsluitend de rijke taaktooltip (geen tweede kleine native title-tooltip).
  DEPPRESENTCHECK="$DIR/.dependency-presentation.mjs"
  if bundle_check "$DIR/check-dependency-presentation.ts" "$DEPPRESENTCHECK"; then node "$DEPPRESENTCHECK" || STATUS=1; fi

  # Commandoregister (K-item 34): de elf acties die het lint en het toetsenbord delen, stonden twee
  # keer los gedefinieerd. Toetst het gedrag van elk commando tegen de echte store, het contract dat
  # `run` niet stil niets doet als `isEnabled` false is (issue #26), en dat geen van beide registers
  # nog een eigen implementatie heeft.
  CMDCHECK="$DIR/.commands.mjs"
  if bundle_check "$DIR/check-commands.ts" "$CMDCHECK"; then node "$CMDCHECK" || STATUS=1; fi

  # Boomprimitieven (K-item 35): detach/attach/cyklusguard/deelboom stonden als overgetypte regels
  # midden in Immer-producers, verspreid over taskSlice en mcpTransaction. Nu pure functies, dus
  # rechtstreeks toetsbaar — inclusief de randgevallen die de handkopieën niet aankonden (een al
  # bestaande cyclus in de data, verplaatsen binnen dezelfde ouder, index buiten bereik).
  TTCHECK="$DIR/.task-tree.mjs"
  if bundle_check "$DIR/check-task-tree.ts" "$TTCHECK"; then node "$TTCHECK" || STATUS=1; fi

  # Resource-join-index (K-item 36): `resourceNames` deed twee volledige scans per taak op het pad
  # dat na iedere mutatie opnieuw loopt. De index die dat oplost introduceert een CACHE, en die
  # nieuwe faalmodus (verouderde index) is hier het eigenlijke onderwerp.
  VICHECK="$DIR/.view-index.mjs"
  if bundle_check "$DIR/check-view-index.ts" "$VICHECK"; then node "$VICHECK" || STATUS=1; fi

  # "Actief tussen"-filterveld (issue-discussie #32): interval-overlaptest op start+finish
  # tegelijk, i.p.v. de generieke één-veld-één-waarde resolver. Bewijst de overlaplogica zelf én
  # dat hij hetzelfde uitkomt als de handmatige AND-groep die de discussie als workaround kreeg.
  ADFCHECK="$DIR/.active-during-filter.mjs"
  if bundle_check "$DIR/check-active-during-filter.ts" "$ADFCHECK"; then node "$ADFCHECK" || STATUS=1; fi

  # Opgeslagen filters (issue #85): app-brede presetopslag is los van layouts, valideert corrupte
  # localStorage en houdt meerdere filterbomen in dezelfde volgorde beschikbaar.
  SFLCHECK="$DIR/.saved-filters.mjs"
  if bundle_check "$DIR/check-saved-filters.ts" "$SFLCHECK"; then node "$SFLCHECK" || STATUS=1; fi

  # Rapportoptie voor de werkdagen-as (#21): staat bewust in ops-reportSettings, zodat de
  # rapportlay-out niet met de algemene scherminstelling meeschakelt.
  RWDSETTINGSCHECK="$DIR/.report-working-days-setting.mjs"
  if bundle_check "$DIR/check-report-working-days-setting.ts" "$RWDSETTINGSCHECK"; then node "$RWDSETTINGSCHECK" || STATUS=1; fi

  # Naamkolom van de rapporttabel: afkappen aan/uit + sliderbreedte, defaults en klemmen.
  RNCSETTINGSCHECK="$DIR/.report-name-column-setting.mjs"
  if bundle_check "$DIR/check-report-name-column-setting.ts" "$RNCSETTINGSCHECK"; then node "$RNCSETTINGSCHECK" || STATUS=1; fi

  # Renderer-datumloos-regressie (TODO-item 2026-07-28): `barGeometry` (en `drawMilestone`) gooide
  # per frame een TypeError op een taak zonder start-/finishdatums (`undefined.includes('T')`) en
  # liet de hele Gantt zwart. Draait de echte renderer over datumloze leaf-/summary-/mijlpaal-rijen:
  # geen crash, gezonde taken tekenen door, de datumloze leaf krijgt de terugval-stub op de
  # viewstart, en getTaskBarBounds weigert de stub (geen drag met undefined originalStart).
  RDCHECK="$DIR/.renderer-dateless.mjs"
  if bundle_check "$DIR/check-renderer-dateless.ts" "$RDCHECK"; then node "$RDCHECK" || STATUS=1; fi

  # Dev-only Gantt-testdriver: reverse locator gebruikt exact de renderer-eigen balkgeometrie en
  # behoudt het bestaande hit-testbeleid voor datumloze taken, mijlpalen en verzameltaken.
  GTDCHECK="$DIR/.gantt-test-driver.mjs"
  if bundle_check "$DIR/check-gantt-test-driver.ts" "$GTDCHECK"; then node "$GTDCHECK" || STATUS=1; fi

  # M3 (Opus-review T15-iteratie-2, "UI-rimpel"): een mijlpaal-met-duur (T15) moet als gewone balk
  # tekenen (drawTaskBar/roundRect, niet drawMilestone/ruit), haar eigen duurtekst tonen (niet "0d")
  # en sleep-/resize-baar zijn — dezelfde discriminator als de solver (isZeroDurationMilestone).
  MDCHECK="$DIR/.milestone-duration-render.mjs"
  if bundle_check "$DIR/check-milestone-duration-render.ts" "$MDCHECK"; then node "$MDCHECK" || STATUS=1; fi

  # Z15 (etappe "nul afwijkingen", baan D): onderbroken balken (Task.splitGaps) in de Gantt-canvas
  # ÉN print/PDF — gatentelling ⇒ segmentaantal + necking-connector, O5 (splitGaps ALTIJD gesplitst,
  # ongeacht barSplitMode), globale voortgangsvulling over de segmenten heen, dag-/uur-modus.
  SPLITBARCHECK="$DIR/.split-bar-render.mjs"
  if bundle_check "$DIR/check-split-bar-render.ts" "$SPLITBARCHECK"; then node "$SPLITBARCHECK" || STATUS=1; fi

  # B1c-W0.4/W0.1: `splitWalk.ts` — de ENE gedeelde H1-as-wandeling en dag-enumeratie voor
  # gesplitste taken (later geconsumeerd door splitBarGeometry/ResourceLoad/ResourceLeveler).
  SPLITWALKCHECK="$DIR/.split-walk.mjs"
  if bundle_check "$DIR/check-split-walk.ts" "$SPLITWALKCHECK"; then node "$SPLITWALKCHECK" || STATUS=1; fi

  # B1c-W0.1: `computeResourceLoad`/`computeHistogramReport` volgen nu de ECHTE werkdagen van een
  # taak — splitGaps-pauzedagen overgeslagen, mapping op de TAAKkalender i.p.v. onvoorwaardelijk de
  # projectkalender (via `enumerateTaskWorkDays`/`splitWalk.ts`).
  RESLOADSPLITSCHECK="$DIR/.resource-load-splits.mjs"
  if bundle_check "$DIR/check-resource-load-splits.ts" "$RESLOADSPLITSCHECK"; then node "$RESLOADSPLITSCHECK" || STATUS=1; fi

  # B1c-W0.2/W0.3: `ResourceLeveler.ts` boekt (`bookDemandAt`) en meet de delay-eenheid nu ook op de
  # TAAKkalender, split-bewust — het derde (en laatste) gat naast de renderer (W0.4/W0.1) en
  # `computeResourceLoad` (W0.1).
  LEVELERSPLITSCHECK="$DIR/.leveler-splits.mjs"
  if bundle_check "$DIR/check-leveler-splits.ts" "$LEVELERSPLITSCHECK"; then node "$LEVELERSPLITSCHECK" || STATUS=1; fi

  # B1c-plan-2 taak 1 (M10): `levelingDelayMinutes` had in CPMSolver.shiftByLevelingDelay al
  # voorrang op `levelingDelay`, maar applyLeveling/clearLeveling en de leveler-baseline kenden
  # alleen `levelingDelay` — een stille no-op-familie op elk .mpp-geïmporteerd project. Plus de
  # eenmalige K8a-waarschuwing die het overschrijven van de sub-dag-precisie meldt.
  LEVELDELAYUNITSCHECK="$DIR/.leveling-delay-units.mjs"
  if bundle_check "$DIR/check-leveling-delay-units.ts" "$LEVELDELAYUNITSCHECK"; then node "$LEVELDELAYUNITSCHECK" || STATUS=1; fi

  # B1c-plan-2 taak 3: `scopeTaskIds` begrenst WAT er genivelleerd wordt — taken buiten de scope
  # behouden hun bestaande levelingDelay en tellen als vaste last, incl. de computePF-validatieplicht.
  LEVELERSCOPECHECK="$DIR/.leveler-scope.mjs"
  if bundle_check "$DIR/check-leveler-scope.ts" "$LEVELERSCOPECHECK"; then node "$LEVELERSCOPECHECK" || STATUS=1; fi

  # B1c-plan-2 taak 4: het uitloop-plafond (`overrunCeilingDays`) als per-taak-venster, met eigen
  # redenen (CEILING_TOO_TIGHT/CEILING_UNREACHABLE) i.p.v. een generiek capaciteitstekort.
  LEVELERCEILINGCHECK="$DIR/.leveler-ceiling.mjs"
  if bundle_check "$DIR/check-leveler-ceiling.ts" "$LEVELERCEILINGCHECK"; then node "$LEVELERCEILINGCHECK" || STATUS=1; fi

  # B1c-plan-2 taak 5: naad-hygiëne — kalender-haalbaarheid los van capaciteit, de nul-guard in de
  # conflictverzamelaar (spiegelt `fits`), en een eerlijke NO_WINDOW_IN_HORIZON-reden i.p.v. een
  # verzonnen "onvoldoende capaciteit" wanneer de scan simpelweg leegloopt.
  LEVELERSEAMCHECK="$DIR/.leveler-seam.mjs"
  if bundle_check "$DIR/check-leveler-seam.ts" "$LEVELERSEAMCHECK"; then node "$LEVELERSEAMCHECK" || STATUS=1; fi

  # B1c-plan-2 taak 6: het injecteerbare poolitem-grootboek (`LevelingPoolLedger`) als TWEEDE
  # capaciteitstoets naast de bestaande per-resource-toets — beide moeten slagen, boeken gebeurt
  # alleen bij een daadwerkelijk geplaatste taak (geen cascade), reden RESIDUAL_FULL.
  LEVELERPOOLLEDGERCHECK="$DIR/.leveler-pool-ledger.mjs"
  if bundle_check "$DIR/check-leveler-pool-ledger.ts" "$LEVELERPOOLLEDGERCHECK"; then node "$LEVELERPOOLLEDGERCHECK" || STATUS=1; fi

  # B1c-plan-2 taak 9: de onderbreek-modus (`allowSplits`) — dag-voor-dag-plaatsing als fallback ná
  # een mislukte aaneengesloten scan, met leveling-gaten (`LevelingResult.gaps`) op WORKTIME+
  # completion-0-taken (dag- én uur-modus, eigenaarsbesluit 2026-08-31), nooit op ELAPSEDTIME of een
  # gestarte taak, en met behoud van bestaande importsplits.
  LEVELERSPLITMODECHECK="$DIR/.leveler-splitmode.mjs"
  if bundle_check "$DIR/check-leveler-splitmode.ts" "$LEVELERSPLITMODECHECK"; then node "$LEVELERSPLITMODECHECK" || STATUS=1; fi

  # Ribbon Baselines & Progress: drie overlays links en twee kleurcontrols rechts horen ieder in
  # een verticale stack; losse groepsitems worden horizontaal gerenderd en maken de rij te breed.
  OVERLAYRIBBONCHECK="$DIR/.ribbon-overlays.mjs"
  if bundle_check "$DIR/check-ribbon-overlays.ts" "$OVERLAYRIBBONCHECK"; then node "$OVERLAYRIBBONCHECK" || STATUS=1; fi

  RELRULES="$DIR/.relrules.mjs"
  if bundle_check "$DIR/check-relation-rules.ts" "$RELRULES"; then node "$RELRULES" || STATUS=1; fi

  # Pijlrouting (issue #41): relatielijnen worden vóór de balken getekend, dus alles wat onder een
  # balk door loopt is onzichtbaar. De vaste elleboog `fromX+8` lag bij SS midden ín de voorganger-
  # balk en liep bij krappe/achterwaartse relaties dwars door de OPVOLGERbalk (incl. pijlkop).
  # Toetst met de echte renderer + opnemende stub dat geen enkel pijlsegment nog binnen een
  # balkrechthoek valt, over een zoom×scrollX-raster.
  ARCHECK="$DIR/.arrow-routing.mjs"
  if bundle_check "$DIR/check-arrow-routing.ts" "$ARCHECK"; then node "$ARCHECK" || STATUS=1; fi

  # Live duur-pilletje tijdens een rand-sleep (issue #51). Toetst de GEOMETRIE (binnen de balk bij
  # een brede balk, erbuiten bij een smalle, geklemd tegen taaktabel- en vensterrand, niets bij een
  # weggescrolde rij) en de EENHEID (een uur-taak toont uren, nooit "1d" — die staat stil omdat de
  # uur-sleep `durationMinutes` muteert). Meet het VERSCHIL tussen een render mét en zónder
  # `durationDrag`, dus onafhankelijk van de rest van de tekenlaag.
  DDCHECK="$DIR/.drag-duration-badge.mjs"
  if bundle_check "$DIR/check-drag-duration-badge.ts" "$DDCHECK"; then node "$DDCHECK" || STATUS=1; fi

  # T2: de Gantt-uurinteractie rekent via CalendarEngine, zodat pauzes, nachten,
  # weekenden en feestdagen niet als gewerkte duur mee kunnen lekken.
  HBDCHECK="$DIR/.hour-bar-drag.mjs"
  if bundle_check "$DIR/check-hour-bar-drag.ts" "$HBDCHECK"; then node "$HBDCHECK" || STATUS=1; fi

  # Tijd-as-consolidatie (issue #21 punt 5, fase 0): geconsolideerde `timeAxis.dateToX`/`xToDate`/
  # `xToDayOffset` vs. letterlijk-gekopieerde OUDE formules (printPreview/GanttCanvas/GanttRenderer/
  # useBarDrag), plus een live-render-vergelijking van de grid-`startOffset`. Bewijst dat de
  # consolidatie geen pixel verandert (docs/superpowers/werkdagen-as-ontwerp.md §3.2).
  AXCHECK="$DIR/.axis-consolidation.mjs"
  if bundle_check "$DIR/check-axis-consolidation.ts" "$AXCHECK"; then node "$AXCHECK" || STATUS=1; fi

  # WorkdayAxis (issue #21 punt 5, fase 1): de nieuwe gecomprimeerde-werkdagen-as, headless en
  # nog niet aangesloten op de renderer/UI. Round-trip datum→index→datum, kleef-rechts-naadlanding
  # voor za/zo/feestdag, 5-werkdagen-span over weekend+feestdag = 5 kolommen, consistentie met
  # CalendarEngine.workDaysBetween/addWorkDays, sub-dag-fracties, lazy-groei + groei-plafond
  # (docs/superpowers/werkdagen-as-ontwerp.md §2, §8 fase 1).
  WDCHECK="$DIR/.workday-axis.mjs"
  if bundle_check "$DIR/check-workday-axis.ts" "$WDCHECK"; then node "$WDCHECK" || STATUS=1; fi

  # Header-datumregel onder compressie (issue #21 punt 5, vervolg): `drawTimelineHeader` gebruikte
  # nog een kalenderdag-aanname (`scrollX/zoom`) voor zijn zichtbare-bereik, die bij compressie +
  # voldoende scroll steeds verder achterliep op het werkelijk zichtbare venster — bij genoeg
  # scroll viel de tick-loop stil vóórdat hij het canvas bereikte (LEGE/zwarte datumregel). Bewijst
  # nu, over een zoom×scrollX-raster: geen stapelende labels binnen één header-rij, volle
  # canvas-dekking van de onderste rij onder compressie, en algebraïsche byte-identiek-heid van de
  # nieuwe as-index-bereiksberekening t.o.v. de oude formule zodra compressie UIT staat.
  HCCHECK="$DIR/.header-compress.mjs"
  if bundle_check "$DIR/check-header-compress.ts" "$HCCHECK"; then node "$HCCHECK" || STATUS=1; fi

  # Om-en-om weekbanden onder compressie (issue #21 punt 2): met de gecomprimeerde as vervalt de
  # weekend-arcering — in de praktijk dé visuele weekscheiding. De gecomprimeerde tak van
  # drawGridBackground tint daarom de kolommen van ONEVEN weeknummers (`palette.gridWeekBand`).
  # Bewijst: band ⇔ weeknummer-pariteit op elke zichtbare kolom (grens = weekStartDay, zelfde als
  # de dikke weeklijn, voor 'monday' én 'sunday'), scroll-invariantie van de banding, en NUL
  # band-fills zodra compressie uit staat (dat pad blijft byte-identiek).
  WBCHECK="$DIR/.week-banding.mjs"
  if bundle_check "$DIR/check-week-banding.ts" "$WBCHECK"; then node "$WBCHECK" || STATUS=1; fi

  # i18n-pluralisatie-contract voor de telsleutels van "Project verplaatsen…". Een ontbrekende
  # plural-categorie valt bij i18next NIET terug op de _other van dezelfde taal maar op fallbackLng,
  # en zet er dus Engels neer (in het Pools al zichtbaar bij twee items). Deze check eist per taal
  # exact de categorieën die Intl.PluralRules opgeeft, en vuurt ze daarna nog echt af.
  I18NCHECK="$DIR/.i18n-plurals.mjs"
  if bundle_check "$DIR/check-i18n-plurals.ts" "$I18NCHECK"; then node "$I18NCHECK" || STATUS=1; fi

  # Het "vandaag"-label in de printkopstrook. Lag vóór `drawTimelineHeader` en werd daardoor in de
  # RASTER-preview weggeschilderd, terwijl het in de VECTOR-PDF (waar alle tekst boven alle vormen
  # staat) juist overleefde en pal op het dagcijfer landde — "Vand29ag". Deze check bewaakt de drie
  # eigenschappen die dat uitsluiten: getekend ná de kopstrook-overschildering, geen overlap met een
  # dagcijfer, en binnen het chartgebied — over talen × papierformaten × lettergroottes.
  TODAYCHECK="$DIR/.today-label.mjs"
  if bundle_check "$DIR/check-today-label.ts" "$TODAYCHECK"; then node "$TODAYCHECK" || STATUS=1; fi

  # Print-voorbeeld × werkende uitzonderingen (fase 3.8, T13 — §T2-afwijking LAAG-7-afnemer):
  # printPreview.ts bouwde vóór T13 een eigen holidaySet + hardgecodeerde dow===6||7-weekend-check,
  # die `calendar.workingExceptions` (T2) volledig negeerden — een ingeroosterde werkende zaterdag
  # printte alsnog als weekend, terwijl de Gantt-canvas 'm al correct als werkdag toonde. Deze check
  # bewaakt de fix (één CalendarEngine-instantie i.p.v. de ad-hoc logica) via een opnemende Draw2D.
  PRINTWECHECK="$DIR/.print-working-exceptions.mjs"
  if bundle_check "$DIR/check-print-working-exceptions.ts" "$PRINTWECHECK"; then node "$PRINTWECHECK" || STATUS=1; fi

  # Relatielijn-stijl in het geëxporteerde rapport (issue #56). De printlaag zette één vaste grijze
  # kleur BUITEN de lus, riep `setLineDash` nooit aan en las `seq.type` niet — de export gooide dus
  # de P6-betekenis weg (doorgetrokken = bepalend, rood = kritiek) en tekende élke relatie als FS,
  # ook een SS. Deze check draait `renderReport` met een opnemende Draw2D (dezelfde renderer die de
  # raster-preview én de vector-PDF voedt) en bewaakt kleur, lijnstijl, dash-schaling, de SS/FS-
  # ankerpunten, de dash-reset naar kopstrook/tabel en de legenda-regel.
  DEPSTYLECHECK="$DIR/.dependency-style.mjs"
  if bundle_check "$DIR/check-dependency-style.ts" "$DEPSTYLECHECK"; then node "$DEPSTYLECHECK" || STATUS=1; fi

  # Resourcepalet + kleurtoewijzing (#21 punt 1-nieuw): uniekheid, grijswaarden-onderscheid,
  # hash-stabiliteit/-verspreiding, auto-toewijzing "eerste vrije kleur", hash-fallback muteert
  # niets, geen botsing met kritiek-rood.
  BARCOLORCHECK="$DIR/.bar-colors.mjs"
  if bundle_check "$DIR/check-bar-colors.ts" "$BARCOLORCHECK"; then node "$BARCOLORCHECK" || STATUS=1; fi

  # Eén globale balkkleurselectie voor scherm + rapport: vormvalidatie, legacy-migratie en
  # round-trip door de echte settingsStore/localStorage-route.
  BARCOLORSETTINGSCHECK="$DIR/.bar-color-settings.mjs"
  if bundle_check "$DIR/check-bar-color-settings.ts" "$BARCOLORSETTINGSCHECK"; then node "$BARCOLORSETTINGSCHECK" || STATUS=1; fi

  # Thema "Systeem": resolutie van de voorkeur naar dark/light, de matchMedia-detectie/-listener,
  # de opslag (geen legacymigratie van 'system'), en de bronpoorten op het pre-paint-script in
  # index.html + de [data-theme]-blokken in globals.css.
  SYSTEMTHEMECHECK="$DIR/.system-theme.mjs"
  if bundle_check "$DIR/check-system-theme.ts" "$SYSTEMTHEMECHECK"; then node "$SYSTEMTHEMECHECK" || STATUS=1; fi

  # Balkkleurcategorieën delen exact de Group-veldcatalogus; een verwijderd projectveld valt
  # tijdelijk terug op Taaktype zonder de globale keuze te overschrijven.
  BARCOLORFIELDCHECK="$DIR/.bar-color-field-options.mjs"
  if bundle_check "$DIR/check-bar-color-field-options.ts" "$BARCOLORFIELDCHECK"; then node "$BARCOLORFIELDCHECK" || STATUS=1; fi

  # Rapportexport #21/#54: volg-weergave (viewRows→renderReport), statuslijn (statusDate/progress),
  # kleurmodi + legenda — via opnemende Draw2D, zelfde renderer als preview én vector-PDF.
  PRTEXPCHECK="$DIR/.print-report.mjs"
  if bundle_check "$DIR/check-print-report.ts" "$PRTEXPCHECK"; then node "$PRTEXPCHECK" || STATUS=1; fi

  # Rasterexport-streaming: exportRaster() mag geen paginalimiet hebben (een export moet compleet
  # zijn), dus de begrenzing moet uit het geheugengedrag komen — één pagina-canvas tegelijk, meteen
  # naar JPEG en weer vrijgegeven, in plaats van alle rows*cols canvassen tegelijk vasthouden.
  PRTSTREAMCHECK="$DIR/.print-raster-export-streaming.mjs"
  if bundle_check "$DIR/check-print-raster-export-streaming.ts" "$PRTSTREAMCHECK"; then node "$PRTSTREAMCHECK" || STATUS=1; fi

  # Issue #21 punt 2 — wanneer alleen werkdagen tonen aan staat, gebruikt het rapport dezelfde
  # gecomprimeerde as als de scherm-Gantt en vervangt het verdwenen weekendarcering door weekbanden.
  PRTCOMPRESSCHECK="$DIR/.print-compress-week-banding.mjs"
  if bundle_check "$DIR/check-print-compress-week-banding.ts" "$PRTCOMPRESSCHECK"; then node "$PRTCOMPRESSCHECK" || STATUS=1; fi

  # Resource-accent op het scherm (#21): dun streepje resourcekleur onder bladbalken, gesegmenteerd
  # naar rato van unitsPerDay; zonder vlag niets extra. ECHTE GanttRenderer met opnemende ctx-stub.
  RACCHECK="$DIR/.resource-accent.mjs"
  if bundle_check "$DIR/check-resource-accent.ts" "$RACCHECK"; then node "$RACCHECK" || STATUS=1; fi

  # Icoon-sanitizer (bevinding K6a): extensie-geleverde iconen worden nog steeds als inline SVG
  # gerenderd, maar uitsluitend herbouwd uit een allowlist. Deze check draait de DOM-vrije
  # beslissings- en herbouwlaag (allowlists, harde verwijderingen, waardecheck, serialisatie) tegen
  # de bekende aanvalsvectoren én tegen een legitiem lucide-achtig icoon dat intact moet blijven.
  # De parse-stap zelf valt hier buiten: Node heeft geen DOMParser (zie de kop van het script).
  SVGCHECK="$DIR/.svg-sanitizer.mjs"
  if bundle_check "$DIR/check-svg-sanitizer.ts" "$SVGCHECK"; then node "$SVGCHECK" || STATUS=1; fi

  # Extensie-kalendermapper × werkende uitzonderingen (fase 3.8, T13 — §T2-afwijking LAAG-7-
  # afnemer): ExtCalendar (het publieke extensiecontract) miste `workingExceptions` — een extensie
  # die een kalender via toExtCalendar/fromExtCalendar round-trippet (lezen, iets anders wijzigen,
  # terugschrijven) wiste zo stilzwijgend elke werkende uitzondering. Bewaakt round-trip + het
  # byte-identiek-anker (geen workingExceptions ⇒ blijft undefined) + de kopie-losstaandheid.
  EXTCALCHECK="$DIR/.ext-calendar-mapper.mjs"
  if bundle_check "$DIR/check-ext-calendar-mapper.ts" "$EXTCALCHECK"; then node "$EXTCALCHECK" || STATUS=1; fi

  # Undo-grens + coalescing (prioriteitsitem 8). De undo-stack is begrensd op MAX_UNDO; die grens
  # maakt `undoStack.length` als coalescing-identiteit onbruikbaar (constant bij een volle stack),
  # dus die is een monotoon volgnummer geworden. Geen enkele CPM-case duwt 100+ stappen door de
  # stack, dus zonder deze batterij is beide ongedekt.
  UNDOCHECK="$DIR/.undo-bound.mjs"
  if bundle_check "$DIR/check-undo-bound.ts" "$UNDOCHECK"; then node "$UNDOCHECK" || STATUS=1; fi

  # Mutatiekosten (prestatiedoel "5000 taken moet werken"). Eén mutatie deed O(n) werk over de hele
  # takenlijst — deep-clone-snapshot, nummering via de draft, belastingberekening via de draft — dus
  # n mutaties waren O(n2). Deze batterij bewaakt de eigenschappen waar de oplossing op rust: de
  # snapshot deelt per referentie (en dat mag omdat Immer de state diep bevriest), en een mutatie
  # vervangt geen taakobjecten die niet veranderen.
  MUTCHECK="$DIR/.mutation-cost.mjs"
  if bundle_check "$DIR/check-mutation-cost.ts" "$MUTCHECK"; then node "$MUTCHECK" || STATUS=1; fi

  # Benchmark-generator (Instellingen -> Benchmark). De gegenereerde planning moet een ECHT netwerk
  # zijn: elke taak die de solver als leaf ziet hoort minstens een relatie te hebben, anders meet je
  # losse taken op de projectstart. Plus: het instelbare aantal resources mag de structuur van de
  # planning niet veranderen, want dan zijn twee metingen niet meer vergelijkbaar.
  BMGENCHECK="$DIR/.bmgen.mjs"
  if bundle_check "$DIR/check-benchmark-generator.ts" "$BMGENCHECK"; then node "$BMGENCHECK" || STATUS=1; fi

  # formatDate tegen zijn eigen vorige implementatie (characterization). De functie draait per DAG
  # per taak in de solver en de resourcebelasting, dus de allocaties van toISOString().split() telden
  # echt op; de herschrijving moet byte-identiek zijn, óók buiten jaar 0-9999 en bij een Invalid
  # Date. Let op: dat hij UTC-getters gebruikt bewijst pas de tijdzone-matrix onderaan dit script.
  DATEFMTCHECK="$DIR/.datefmt.mjs"
  if bundle_check "$DIR/check-date-format.ts" "$DATEFMTCHECK"; then node "$DATEFMTCHECK" || STATUS=1; fi

  # Publiek extensie-contract (K-item 37). De mappers tussen het interne domeinmodel en de
  # Ext*-DTO's hadden geen compile-afdwinging op VOLLEDIGHEID: een optioneel veld vergeten is legaal
  # TypeScript, dus het veld bestond simpelweg niet voor extensies. Deze batterij klinkt de
  # sleutellijsten compile-time vast aan de types, controleert beide mapperrichtingen op een
  # maximale fixture, legt vast welke interne velden BEWUST niet oversteken, en dekt de
  # apiVersion-poort (contractversie, los van de CalVer-app-versie).
  EXTCHECK="$DIR/.extcontract.mjs"
  if bundle_check "$DIR/check-ext-contract.ts" "$EXTCHECK"; then node "$EXTCHECK" || STATUS=1; fi

  # Extensie-integriteit en -afscherming (K-item 38, pragmatische helft). Een catalogusentry met
  # sha256 wordt geverifieerd en bij verschil geweigerd; de rauwe host-globals worden in de
  # extensie-scope geschaduwd. De batterij toont OOK expliciet aan dat dat laatste geen sandbox is —
  # ontsnappen via globalThis kan nog steeds, en dat hoort zichtbaar te zijn in plaats van beloofd.
  EXTINTCHECK="$DIR/.extintegrity.mjs"
  if bundle_check "$DIR/check-ext-integrity.ts" "$EXTINTCHECK"; then node "$EXTINTCHECK" || STATUS=1; fi

  # Toestemming bij extensie-installatie (K-item 38, laatste deel). De faalstand moet WEIGEREN zijn
  # (geen dialoog geladen ⇒ niet installeren), elk installatiepad moet langs de poort, en die poort
  # moet vóór de eerste schrijfactie staan — anders laat een weigering een half geïnstalleerde
  # extensie achter, en dat is precies wat een headless test niet kan zien.
  EXTCONSENTCHECK="$DIR/.extconsent.mjs"
  if bundle_check "$DIR/check-ext-consent.ts" "$EXTCONSENTCHECK"; then node "$EXTCONSENTCHECK" || STATUS=1; fi

  # Runtimevalidatie op de extensie-ingangen (onderhoudbaarheidsprogramma 1). Deze batterij begint
  # bij het manifestcontract; catalogus- en opslagcases worden in hun eigen tasks toegevoegd.
  EXTVALIDATIONCHECK="$DIR/.extvalidation.mjs"
  if bundle_check "$DIR/check-extension-validation.ts" "$EXTVALIDATIONCHECK"; then node "$EXTVALIDATIONCHECK" || STATUS=1; fi

  # Scherm <-> print (K-item 39). De afdruk beantwoordde drie vragen zelf die de renderer al
  # beantwoordt — weeknummer, weekgrens en welke dagen vrij zijn — en was op alle drie afgedreven.
  # Een project met zaterdag als werkdag of "week begint op zondag" kreeg op papier iets anders dan
  # op het scherm.
  PRINTPARCHECK="$DIR/.printparity.mjs"
  if bundle_check "$DIR/check-print-screen-parity.ts" "$PRINTPARCHECK"; then node "$PRINTPARCHECK" || STATUS=1; fi

  # Store-factory (K-item 41). Elke context bezit nu eigen projectdata, undo/redo en runtime-
  # metadata; de batterij toetst die scheiding en legt tegelijk vast welke niet-documentaire staat
  # (zoals het taakklembord) bewust een documentwissel binnen dezelfde context overleeft.
  SFCHECK="$DIR/.storefactory.mjs"
  if bundle_check "$DIR/check-store-factory.ts" "$SFCHECK"; then node "$SFCHECK" || STATUS=1; fi

  # Per-store runtime-isolatie (onderhoudbaarheidsprogramma 2). Dezelfde coalesceKey in twee
  # contexten, geneste/interleaved batches en de gedeeltelijk-committen throwsemantiek mogen elkaars
  # undo, redo of suppressiediepte nooit beïnvloeden.
  SRICHECK="$DIR/.store-runtime-isolation.mjs"
  if bundle_check "$DIR/check-store-runtime-isolation.ts" "$SRICHECK"; then node "$SRICHECK" || STATUS=1; fi

  # Mechanische ownershippoort voor storegebonden runtimecode. Draait de echte repositorycheck en
  # bewijst met tijdelijke bronfixtures dat value-singletons en adapterlogica worden geweigerd,
  # terwijl commentaar en type-only imports geen vals alarm geven.
  SRBCHECK="$DIR/.store-runtime-boundaries.mjs"
  if bundle_check "$DIR/check-store-runtime-boundaries.ts" "$SRBCHECK"; then node "$SRBCHECK" || STATUS=1; fi

  # Export-guard (bevinding K7). Exports schrijven CPM-datums naar derden; zonder guard ging een
  # verouderde planning het bestand in. De subtiele helft: na een cyclus staat `scheduleStale` al
  # op false terwijl `task.time` oud is, dus een guard op alleen die vlag exporteert stil verkeerd.
  EXPCHECK="$DIR/.export-guard.mjs"
  if bundle_check "$DIR/check-export-guard.ts" "$EXPCHECK"; then node "$EXPCHECK" || STATUS=1; fi

  # STEP-string-veiligheid (bevinding K2). De parser was string-onveilig in drie lagen (sectie-split,
  # commentaar-strip, entity-regex) en de writer interpoleerde naam/auteur/bedrijf RAUW in de header.
  # `);`, `(…)` en `ENDSEC;` zijn normale plantekst; het ergste geval was een STILLE duurwijziging
  # bij opslaan+heropenen. Draait de echte keten store→writeIFC→readIFC per faalvector, plus een
  # onafhankelijke syntaxcontrole op de FILE_NAME-header.
  SSCHECK="$DIR/.step-strings.mjs"
  if bundle_check "$DIR/check-step-strings.ts" "$SSCHECK"; then node "$SSCHECK" || STATUS=1; fi

  # Recovery-integriteit (bevinding K4). `readIFC` had NUL throws: een afgekapte snapshot leverde
  # stil een gedeeltelijk hersteld document op (bij 80% afkappen: alle taken, NUL relaties — een
  # planning die compleet oogt en geen logicanetwerk heeft), waarna clearRecovery() hem opruimde.
  # Deze batterij eist dat onzin-invoer en afgekapte bestanden een IfcParseError gooien, én dat een
  # leeg-maar-geldig project (0 taken) gewoon doorparst — dat laatste borgt het INGETROKKEN
  # voorstel om snapshots op taakaantal te filteren.
  RECCHECK="$DIR/.recovery-integrity.mjs"
  if bundle_check "$DIR/check-recovery-integrity.ts" "$RECCHECK"; then node "$RECCHECK" || STATUS=1; fi

  # X9 recoverydelta: inhoud volgt uitsluitend IFCSaveSource/sameIFCSource. Eén wijziging geeft
  # één upsert; actieve-tab-, pad- en dirtymetadata schrijven alleen het manifest.
  RECDELTACHECK="$DIR/.recovery-delta.mjs"
  if bundle_check "$DIR/check-recovery-delta.ts" "$RECDELTACHECK"; then node "$RECDELTACHECK" || STATUS=1; fi

  # X9 recovery-opslaggrens: één van twaalf gewijzigde documenten geeft één doc-upsert plus één
  # manifest-put in exact één IndexedDB-readwrite-transactie; actieve-tabwissel is metadata-only.
  RECWRITEAMPCHECK="$DIR/.recovery-write-amplification.mjs"
  if bundle_check "$DIR/measure-xer-recovery-write-amplification.ts" "$RECWRITEAMPCHECK"; then node "$RECWRITEAMPCHECK" || STATUS=1; fi

  # S2: werkelijk automatisch opslaan is nadrukkelijk geen crashherstel. De controller bewaakt
  # het bestaande schrijfdoel, single-flight, nieuwste-run en de dirty-race zonder browser/Tauri-I/O.
  AACHECK="$DIR/.actual-autosave.mjs"
  if bundle_check "$DIR/check-actual-autosave.ts" "$AACHECK"; then node "$AACHECK" || STATUS=1; fi

  # Recovery-isolatie tussen instanties (bevinding K5). De opruimlogica veegde op PREFIX door de
  # gedeelde appDataDir. Twee gelijktijdige vensters wisten daarmee elkaars snapshots — en omdat
  # de productie-base (`recovery`) een prefix is van elke dev-base (`recovery.<slug>`), wiste één
  # start van de productiebuild ONVOORWAARDELIJK de snapshots van alle dev-worktrees. Deze
  # batterij vuurt de pure beslissingslaag (naamherkenning + de twee opruimplanners) af tegen een
  # gemengde directorylisting; de Tauri-I/O zelf draait niet headless.
  RISOCHECK="$DIR/.recovery-isolation.mjs"
  if bundle_check "$DIR/check-recovery-isolation.ts" "$RISOCHECK"; then node "$RISOCHECK" || STATUS=1; fi

  # Meldingenkanaal (bevinding K8). De app had geen gebruikerszichtbaar foutkanaal: mislukte
  # opslag, mislukte auto-save en corrupte invoer hadden alle drie hetzelfde symptoom — niets.
  # Deze batterij bewaakt de drie eigenschappen die stil kunnen afdrijven: samenvouwen op
  # dedupeKey (de auto-save probeert het elke 10 s opnieuw), een fout die bij het aftoppen niet
  # door een info verdrongen wordt, en app-globale opslag — zit `notifications` straks per ongeluk
  # in het documentcontract, dan verdwijnt een opslaanfout bij een tabwissel of een Ctrl+Z.
  NOTIFCHECK="$DIR/.notifications.mjs"
  if bundle_check "$DIR/check-notifications.ts" "$NOTIFCHECK"; then node "$NOTIFCHECK" || STATUS=1; fi

  # X9 reviewfix 2: res.json van de Tauri-dev-poller mag geen onopgeloste Promise als `{}`
  # serialiseren wanneer de round-tripopdracht async werkt.
  DEVBRIDGEPOLLERCHECK="$DIR/.dev-bridge-poller.mjs"
  if bundle_check "$DIR/check-dev-bridge-poller.ts" "$DEVBRIDGEPOLLERCHECK"; then node "$DEVBRIDGEPOLLERCHECK" || STATUS=1; fi

  # T1: de duur-eenheid hoort bij de taak, inclusief kalenderplaatsing, legacy-migratie,
  # compacte presentatie en IFC-roundtrip. Deze check draait ook in de tijdzone-matrix.
  T1DURCHECK="$DIR/.task-duration-unit.mjs"
  if bundle_check "$DIR/check-task-duration-unit.ts" "$T1DURCHECK"; then node "$T1DURCHECK" || STATUS=1; fi

  # K2: scalaire pauzevelden leiden effectief werktijd af, blokkeren ongeldige patronen en
  # overleven IFC, undo/redo en documentwissel.
  BREAKCHECK="$DIR/.calendar-breaks.mjs"
  if bundle_check "$DIR/check-calendar-breaks.ts" "$BREAKCHECK"; then node "$BREAKCHECK" || STATUS=1; fi

  # IFC-round-trip-contract (fase 3, P11, bevinding A2/F2). Twee stappen:
  #  (1) COMPILE-AFDWINGING van de fixture-volledigheid — de hoofd-tsconfig sluit tests/ uit, dus een
  #      eigen tsconfig die de check-batterijen typecheckt (`satisfies Required<...>`); een
  #      nieuw domeinveld → compile-fout → fixture MOET bijgewerkt (zelf-uitbreidende batterij).
  #      tsconfig.check.json dekt ÁLLE check-*.ts (model: tests/library/tsconfig.check.json) — het
  #      oude tsconfig.roundtrip.json dekte alleen deze ene batterij, de rest werd door esbuild
  #      gestript en dus nooit type-gecheckt.
  #  (2) De round-trip zelf: writeIFC→readIFC veld-voor-veld + idempotentie + KNOWN_GAPS.
  "$ROOT/node_modules/.bin/tsc" --noEmit -p "$DIR/tsconfig.check.json" || STATUS=1

  # Tabel-overhaul Task 2: stabiele dynamische kolom-id's, registrycontract en compile-time
  # velddekking. Beide checks zijn headless en importeren geen Zustand-store.
  TGREGCHECK="$DIR/.task-column-registry.mjs"
  if bundle_check "$DIR/check-task-column-registry.ts" "$TGREGCHECK"; then node "$TGREGCHECK" || STATUS=1; fi
  TGFIELDCHECK="$DIR/.task-field-coverage.mjs"
  if bundle_check "$DIR/check-task-field-coverage.ts" "$TGFIELDCHECK"; then node "$TGFIELDCHECK" || STATUS=1; fi
  TGPREFCHECK="$DIR/.task-grid-preferences.mjs"
  if bundle_check "$DIR/check-task-grid-preferences.ts" "$TGPREFCHECK"; then node "$TGPREFCHECK" || STATUS=1; fi

  # Tabel-overhaul Task 4A: één sessiebrede, scopebewuste geschiedenis. Puur modelbewijs voor
  # multi-documentvolgorde, globale gridvoorkeuren, compounds, redo-invalidatie en pruning.
  SHMODELCHECK="$DIR/.session-history-model.mjs"
  if bundle_check "$DIR/check-session-history-model.ts" "$SHMODELCHECK"; then node "$SHMODELCHECK" || STATUS=1; fi
  SHMATCHECK="$DIR/.history-materialization.mjs"
  if bundle_check "$DIR/check-history-materialization.ts" "$SHMATCHECK"; then node "$SHMATCHECK" || STATUS=1; fi
  SHSTORECHECK="$DIR/.session-history-store.mjs"
  if bundle_check "$DIR/check-session-history-store.ts" "$SHSTORECHECK"; then node "$SHSTORECHECK" || STATUS=1; fi
  SHBOUNDCHECK="$DIR/.session-history-boundaries.mjs"
  if bundle_check "$DIR/check-session-history-boundaries.ts" "$SHBOUNDCHECK"; then node "$SHBOUNDCHECK" || STATUS=1; fi
  SHMIGRATIONCHECK="$DIR/.session-history-migration.mjs"
  if bundle_check "$DIR/check-session-history-migration.ts" "$SHMIGRATIONCHECK"; then node "$SHMIGRATIONCHECK" || STATUS=1; fi
  ACTIVATIONCHECK="$DIR/.document-activation.mjs"
  if bundle_check "$DIR/check-document-activation.ts" "$ACTIVATIONCHECK"; then node "$ACTIVATIONCHECK" || STATUS=1; fi
  GRIDTXCHECK="$DIR/.grid-transaction.mjs"
  if bundle_check "$DIR/check-grid-transaction.ts" "$GRIDTXCHECK"; then node "$GRIDTXCHECK" || STATUS=1; fi

  RTCHECK="$DIR/.ifc-roundtrip-check.mjs"
  if bundle_check "$DIR/check-ifc-roundtrip.ts" "$RTCHECK"; then node "$RTCHECK" || STATUS=1; fi

  # Datums zoals opgeslagen (issue #63) — de pure laag: aanwezigheidsregistratie, verschiltelling,
  # reconstructie. Betreden/verlaten en de undo-keten volgen later (aparte taak, hangt de store/UI
  # eraan). Draait mee in de tijdzone-matrix — de reconstructie rekent met datums, dus
  # TZ-onafhankelijkheid moet bewezen worden.
  RECDATES="$DIR/.check-recorded-dates.mjs"
  if bundle_check "$DIR/check-recorded-dates.ts" "$RECDATES"; then node "$RECDATES" || STATUS=1; fi
fi

# ── Losse check-bestanden bij een gerichte run (argumentvorm check-*.ts) ───────────────────
# Zelfde `bundle_check`-mechanisme als hierboven, maar dan alleen voor de expliciet gevraagde
# bestanden — dus geen esbuild-kosten voor de overige check-batterijen. Twee checks forceren in
# de volledige run bewust OPS_RELAX_PERF=0 (zware, tijdzone-onafhankelijke performance-poorten);
# dat gedrag wordt hier gespiegeld zodat een gerichte aanroep niet stilzwijgend een relaxte
# omgevingsvariabele van de aanroepende shell overneemt.
if [ "${#CHECK_NAMES[@]}" -gt 0 ]; then
  for name in "${CHECK_NAMES[@]}"; do
    base="${name%.ts}"
    out="$DIR/.$base.mjs"
    if bundle_check "$DIR/$name" "$out"; then
      case "$base" in
        check-task-grid-performance|check-task-grid-paste-performance)
          OPS_RELAX_PERF=0 node "$out" || STATUS=1
          ;;
        *)
          node "$out" || STATUS=1
          ;;
      esac
    fi
  done
fi

if [ "$HARNESS_OK" -eq 1 ]; then
  # Bij een gerichte run met uitsluitend check-*.ts-argumenten is FILES leeg; de harness dan
  # toch aanroepen zou alleen een verwarrende "TOTAAL: 0/0" opleveren.
  if [ "${#FILES[@]}" -gt 0 ]; then
    node "$OUT" "${FILES[@]}" || STATUS=1
  fi
else
  echo "XX  cases overgeslagen: de harness kon niet gebundeld worden (zie de fout hierboven)"
fi

# ── Tijdzone-matrix ────────────────────────────────────────────────────────────────────────
# De hele suite draaide altijd onder de tijdzone van de machine, waardoor een tijdzone-
# afhankelijke datumbug (K1: `parseDate` las een UTC-instant met lokale getters uit) onzichtbaar
# bleef op een Europese laptop maar 120 cases roodmaakte in New York. Deze matrix herdraait de
# AL GEBOUWDE bundels onder een andere TZ — bundelen is de dure stap en het artefact zelf is
# tijdzone-onafhankelijk, dus dit kost alleen de looptijd van de checks. De tsc-typecheck van
# het round-trip-contract hoort hier bewust niet bij (compile-stap, tijdzone-onafhankelijk).
#
# De set dekt de vier manieren waarop een datum kan verschuiven:
#   UTC               referentie/nulpunt (offset 0, geen DST)
#   America/New_York  negatieve offset MÉT DST — de klassieke "dag valt terug"-zone
#   Pacific/Midway    extreem negatief (UTC−11), grootste terugval
#   Pacific/Auckland  extreem positief (UTC+12/+13), grootste vooruitsprong
#   Atlantic/Azores   DST-variant die over UTC+0/−1 kantelt; op het ankerpunt 2026-06-01 van de
#                     suite staat hij op +0, dus alleen deze zone betrapt fouten die pas buiten
#                     de zomer (wintertijd = −1) zichtbaar worden.
# Alleen bij een volledige run — met een losse batterij als argument is dit onnodige looptijd.
if [ "$RUN_HOLIDAYS" -eq 1 ]; then
  echo ""
  echo "── Tijdzone-matrix (herdraait de gebouwde bundels onder andere TZ) ──"
  for TZONE in UTC America/New_York Pacific/Midway Pacific/Auckland Atlantic/Azores; do
    TZ_STATUS=0
    TZ_LOG=""
    # $OUT alleen meenemen als de harness gebouwd is; anders draaien we een niet-bestaand bestand.
    MATRIX=("${BUNDLES[@]}")
    [ "$HARNESS_OK" -eq 1 ] && MATRIX+=("$OUT")
    for BUNDLE in "${MATRIX[@]}"; do
      if [ "$BUNDLE" = "$OUT" ]; then
        BUNDLE_OUT="$(TZ="$TZONE" node "$OUT" "${FILES[@]}" 2>&1)" || TZ_STATUS=1
      else
        BUNDLE_OUT="$(TZ="$TZONE" node "$BUNDLE" 2>&1)" || TZ_STATUS=1
      fi
      TZ_LOG+="--- $(basename "$BUNDLE") ---"$'\n'"$BUNDLE_OUT"$'\n'
    done
    if [ "$TZ_STATUS" -eq 0 ]; then
      echo "TZ $TZONE: groen"
    else
      echo "TZ $TZONE: ROOD — volledige uitvoer volgt"
      printf '%s\n' "$TZ_LOG"
      STATUS=1
    fi
  done
fi

# ── Waarschuwing bij een gerichte run ───────────────────────────────────────────────────────
# RUN_HOLIDAYS is exact 0 wanneer er argumenten meegegeven zijn (zie de argumentafhandeling
# hierboven). Het aantal overgeslagen check-batterijen wordt dynamisch geteld door dit script
# zelf te lezen — geen los bijgehouden getal dat kan verouderen zodra er een check bij komt of
# verdwijnt. De regel-vorm (`if bundle_check "$DIR/check-...`) filtert het documentatievoorbeeld
# in het commentaar boven `bundle_check` eruit: die staat op een `#`-regel.
#
# Twee dingen die hier bewust anders zijn dan de eerste versie van deze paragraaf:
#  1. `"${BASH_SOURCE[0]}"` i.p.v. het hardgecodeerde `"$DIR/run.sh"`, en de hele grep-pijplijn
#     eindigt op `|| true`. Onder `set -euo pipefail` faalt een `VAR=$(pijplijn)`-toewijzing zodra
#     één stap in de pijplijn niets vindt (bijv. na een naamswijziging van deze regelvorm) — de
#     assignment krijgt dan exitcode 1, en `set -e` doodt het script VOORDAT de banner of
#     `exit "$STATUS"` bereikt wordt: een groene gerichte run eindigt dan als stille exitcode 1.
#     `|| true` maakt lege uitvoer (dus `wc -l` = 0) het ergste geval, nooit een crash.
#  2. De telling gaat via WIRED_CHECK_NAMES (de daadwerkelijke namen, niet alleen een aantal) en
#     REQUESTED_CHECK_NAMES (een SET, geen array) i.p.v. `TOTAL - ${#CHECK_NAMES[@]}`. Dat oude
#     verschil loog in twee gevallen: een dubbel opgegeven check (`check-x.ts check-x.ts`) trok
#     twee van het totaal af terwijl er maar één overgeslagen werd, en een check-bestand dat wel
#     op schijf staat maar niet via een `bundle_check`-regel is aangesloten (een wees, zie de
#     check-scriptinventaris hierboven) telde toch mee als "gedraaid" zodra je 'm als argument gaf.
if [ "$RUN_HOLIDAYS" -eq 0 ]; then
  mapfile -t WIRED_CHECK_NAMES < <(grep -E '^[[:space:]]*if bundle_check "\$DIR/check-' "${BASH_SOURCE[0]}" \
    | grep -oE 'check-[A-Za-z0-9_-]+\.ts' | sort -u || true)
  TOTAL_CHECK_SCRIPTS="${#WIRED_CHECK_NAMES[@]}"
  declare -A REQUESTED_CHECK_NAMES=()
  for n in "${CHECK_NAMES[@]}"; do REQUESTED_CHECK_NAMES[$n]=1; done
  SKIPPED_CHECK_COUNT=0
  for n in "${WIRED_CHECK_NAMES[@]}"; do
    if [ -z "${REQUESTED_CHECK_NAMES[$n]:-}" ]; then
      SKIPPED_CHECK_COUNT=$((SKIPPED_CHECK_COUNT + 1))
    fi
  done
  echo ""
  echo "############################################################################"
  echo "##  GERICHTE RUN — dit is niet de volledige poort."
  echo "##  $SKIPPED_CHECK_COUNT van de $TOTAL_CHECK_SCRIPTS check-*.ts-regressiebatterijen zijn"
  echo "##  overgeslagen, plus de tijdzone-matrix onderaan dit script."
  echo "##  Draai 'bash tests/planning/run.sh' zonder argumenten voor de volledige poort"
  echo "##  vóór je op dit resultaat vertrouwt (bijv. vóór een commit of PR)."
  echo "############################################################################"
fi

exit "$STATUS"
