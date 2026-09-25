---
paths:
  - "src/services/xer/**"
  - "src/services/xerSourceArchive.ts"
  - "src/services/xerExportLoss.ts"
  - "src/services/formatRegistry.ts"
  - "src/services/mcp/tools/xerProvenanceTools.ts"
  - "src/engine/scheduler/p6*"
  - "src/engine/scheduler/CPMSolver.ts"
  - "tests/planning/check-xer-*"
  - "tests/planning/check-ifc-xer-*"
  - "tests/browser/*xer*"
  - "docs/xer-recovery-guardrails.md"
---

<!-- Verplaatst uit CLAUDE.md (2026-09, bij het samenvoegen van PR #109 met de CLAUDE.md-inkorting van #176): laadt alleen wanneer Claude een bestand leest dat op `paths` past. Inhoud overgenomen; kruisverwijzingen wijzen naar het betreffende rules-bestand. -->

### De XER-lezer (Primavera P6): bronarchief in het IFC, P6-getrouwheid in drie lagen

`src/services/xer/` leest het native `.xer`-uitwisselingsformaat van Primavera P6 rechtstreeks
(geen Rust, geen externe bibliotheek): `xerTables.ts` (tabelparser, getalnotatie uit `CURRTYPE`,
tekencodering BOM → UTF-8 → Windows-1252), `xerReader.ts` (entry point `readXER()`, hetzelfde
`ImportResult`-contract als de andere lezers, via `formatRegistry.ts` achter een dynamic import),
`xerMultiProject.ts` (één bestand ⇒ meerdere documenten; baselineprojecten worden bij hun huidige
project gematerialiseerd), `xerCalendarData.ts` (de `clndr_data`-decoder incl. herstelcodes),
`xerScheduleOptions.ts` (SCHEDOPTIONS → `SchedulingOptions`, X5), `xerRecordedTimes.ts` (zie
hieronder) en de resource-/metadata-lezers. Het volledige plan met eigenaarsbesluiten, dossiers en
de overdrachtsstand staat in `docs/superpowers/plans/2026-08-20-plan-xer-p6-lezer.md`; lees §4.1
(de veldwhitelist met vier "bakken") vóór je een TASK-kolom aanraakt.

Drie architectuurregels die je moet kennen. (1) **Het bronarchief.** De volledige oorspronkelijke
`.xer`-bytes reizen als `xerSourceArchive` (+ `xerImportMetadata`, `xerSourceProjectId`) mee in
`DOCUMENT_FIELDS` én in `IFC_SAVE_KEYS` (`src/services/xerSourceArchive.ts`): het IFC-projectbestand
en elke crashherstel-snapshot dragen het archief, zonder bovengrens — gemeten 17,7 MB `.xer` ⇒ ±50 MB
IFC, ±3,6 s hoofdthread per auto-save-tick (`docs/xer-recovery-guardrails.md`; eigenaarsbesluit,
plan §10.f). De MCP-tool `planner_inspect_xer_provenance` en de extensie-API `data.getImportSource*` (achter
de permissie `importSource`, default-deny) lezen eruit. (2) **Bak 4 — opgeslagen rekenuitvoer is
weergave, nooit solverinvoer.** De zes P6-uitvoerkolommen (`early_/late_start/end_date`,
`total_/free_float_hr_cnt`) mogen uitsluitend via `xerRecordedTimes.ts` gelezen worden, als
`ImportResult.recordedTimes`; ze voeden de weergave "Datums zoals opgeslagen" (issue #63, zie
`.claude/rules/state.md`) en de X12-meetlat, nooit `Task.time` als invoer. Bak 2 (`restart_date`,
`driving_path_flag`, …) mag de lezer nooit lezen. `tests/planning/check-xer-field-whitelist.ts` grept beide grenzen
corpusloos over heel `src/`; de X12-non-interferentie in `check-xer-product-fidelity-x12.ts` bewijst
het per mutatie. (3) **P6-gedrag is fail-closed op `p6Source`.** Elke P6-specifieke solvertak
(`CPMSolver.ts`, `p6Completed*.ts`, `p6OpenLoe*.ts`) staat achter
`schedulingOptions.p6Source === 'XER'`; de XER-lezer zet die vlag, het IFC round-tript haar (met
`sanitizeSchedulingOptions` als type-/sleutelpoort in `ifcReader.ts`), andere formaten blijven
byte-identiek — de corpusloze planningssuite bewaakt dat. Uitzondering: `lagCalendar` is sinds X5 een
werkende instelling voor élk formaat (was een dode UI-keuze).

Meten gaat via het corpus (`OPS_XER_CORPUS`, plan §10.a; niet in de repo, geen CI-poort):
`check-xer-product-fidelity-x12.ts` telt zesassige afwijkingen tegen P6's eigen uitvoer
(`OPS_XER_FIDELITY_REPORT=summary|detail|baseline`), gepind in `xer-product-fidelity-baseline-v2.json`
en corpusloos in `check-xer-corpusless-fidelity-gate.ts`. Het nuldoel van plan §1 is niet gehaald
(15.056 op 2026-09-07); mét corpus staat de suite daarom by design rood op precies die drie regels.
`npm run test:browser:x11` legt lokaal (headed, met corpus en desktopdisplay) aanvullend schermbewijs vast;
hij vervangt de corpusloze CI-poort niet.
Gebruikersgidsen: `public/docs/{nl,en}/gids-xer-import.md` en `datums-zoals-opgeslagen.md`.
