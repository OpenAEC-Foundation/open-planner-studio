# X6 — resources en toewijzingen

## Afbakening

Deze wijziging bedraadt uitsluitend de actuele X6-kern in de XER-leesroute. RSRC, RSRCRATE,
ROLERATE, RSRCCURVDATA en TASKRSRC worden één keer uit de geparste tabelset gelezen. X4b-
meerdocumentselectie en baseline-uitsluiting blijven ongewijzigd; X5 SCHEDOPTIONS blijft
ongewijzigd. Er is geen X8-wiring en er is geen X9-IFC-, recovery- of exportserialisatieclaim.
De retained XER-metadata is uitsluitend in-memory bronbewijs voor een latere X9-overdracht.

## Gewijzigde bestanden

- `src/services/xer/xerResourceTypes.ts`: retained bronvormen, fouten en read-context.
- `src/services/xer/xerResourceCurves.ts`: 21 rauwe curvepunten en niet-destructieve best-fit.
- `src/services/xer/xerResourceAssignments.ts`: lineaire TASKRSRC-partitionering en projectview.
- `src/services/xer/xerResources.ts`: bestandsbrede resource-/rol-/ratecatalogus en mutable
  projectmaterialisatie.
- `src/services/xer/xerReader.ts`: catalogus/index éénmaal maken en per X4b-project projecteren.
- `src/services/xer/xerTables.ts`: rows en cells na parsing runtime-bevriezen.
- `src/services/xer/xerMultiProject.ts`: catalogus/raw rows referentie-identiek herstellen na
  de bestaande mutable projectclone.
- `src/services/importTypes.ts`: optionele retained X6-metadata onder `xer`.
- `tests/planning/check-xer-resources.ts`: X6-contract voor calendar/rates/curves,
  task.resourceIds, X4b-projectfiltering, baselineretentie, catalogusalias en clone-isolatie.
- `tests/planning/check-xer-resource-corpus.ts`: onafhankelijke bytescan met anonieme hashes,
  twee publieke corpuspins en parser-/kernperformance/heap-poorten.
- `tests/planning/run.sh`: beide X6-checks éénmaal buiten de tijdzonematrix; de corpuscheck met
  `--expose-gc`.
- `tests/planning/check-xer-schedule-options.ts`, `src/utils/wbs.ts` en
  `src/state/slices/librarySlice.ts`: type- en instrumentatieaanpassingen die nodig waren nu
  parserrows bevroren zijn; geen nieuwe X5- of library-semantiek.

## Invarianten en mutatiebewijs

- Eén `parseXerTables()` voedt één immutable catalogus; de catalogus deelt de ruwe `XerRow`
  referenties met iedere projectview.
- TASKRSRC wordt éénmaal naar `proj_id` gepartitioneerd. Een project materialiseert alleen zijn
  rijen; ongescope en baseline-rijen blijven uitsluitend in de catalogus voor X9.
- Per project worden resources gekloond en assignments nieuw geprojecteerd. De X4b-test muteert
  P1-resource en -assignment en bewijst dat P2 ongewijzigd blijft, terwijl de catalogus gedeeld
  en bevroren blijft.
- Arbeidsfractie blijft `1 = 100%`; materiaal per uur wordt met de resourcekalender naar per dag
  omgerekend. De tijdelijke productiemutatie `rawRate * 100` maakte de verse X6-bundel rood met
  exitcode 1: `0,5 -> 50` en de onafhankelijke P2-waarde `2 -> 200`. De regel is daarna met
  `apply_patch` exact hersteld; de verse contracttest is weer groen.

## Onafhankelijke orakels en performance

De corpuscheck importeert geen productiemodule voor zijn eerste meting. Hij scant de XER-bytes
zelf, telt tabellen/typen en vergelijkt de anonieme SHA-16-pins voor Roads en rehab-2. Daarna
controleert hij de productiecatalogus en lineaire projectprojectie tegen die onafhankelijke scan.

De geslaagde rerun mat:

| corpuspin | parser | parserheap | X6-kern | kernheap |
| --- | ---: | ---: | ---: | ---: |
| `a2ef7b35c00d8cf8` | 81,6 ms | 20.391.440 B | 59,6 ms | 2.919.512 B |
| `2c1dce175b9f0781` | 977,5 ms | 243.986.592 B | 778,9 ms | 41.203.632 B |

Beide bleven onder de vastgelegde grenzen. De bronlog staat lokaal in
`task-X6-planning-rerun.log`; die log is bewust genegeerd en niet onderdeel van de commit.

## Uitgevoerde poorten

- Gerichte X6-contracttest na herstel: exitcode 0, 7 checks.
- Gerichte X6-corpuscheck met openbare `OPS_XER_CORPUS`: exitcode 0, 14 checks.
- `npm run typecheck`: exitcode 0.
- Volledige `npm run test:planning` met `OPS_XER_CORPUS` en `OPS_P6_COMPARISON`: exitcode 0,
  560/560 en UTC, America/New_York, Pacific/Midway, Pacific/Auckland en Atlantic/Azores groen.
- Volledige `npm run verify` met dezelfde publieke corpuscontext: exitcode 0; inclusief lint,
  planning/library/MCP/dev-server, examples, docs, i18n, cycles en audit (0 vulnerabilities).
- `git diff --check`: exitcode 0.

## X9-overdracht

X9 moet de retained `xer.resources`-catalogus en projectassignment-view door het
documentcontract, IFC-writer/-reader en recovery-bronserialisatie voeren. Deze X6-commit bewaart
alleen de in-memory raw rows met referentie-identiteit; zij claimt expliciet geen save/reload-
round-trip, export of MCP-leespaddocumentatie.
