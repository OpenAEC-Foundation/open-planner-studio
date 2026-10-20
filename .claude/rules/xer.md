---
paths:
  - "src/services/xer/**"
  - "src/services/xerSourceArchive.ts"
  - "src/services/recovery/recoverySnapshot.ts"
  - "src/services/xerExportLoss.ts"
  - "src/state/xerArchiveIssueNotice.ts"
  - "src/state/xerExportNotice.ts"
  - "src/utils/xerDocumentName.ts"
  - "src/services/formatRegistry.ts"
  - "src/services/mcp/tools/xerProvenanceTools.ts"
  - "src/engine/scheduler/p6*"
  - "src/engine/scheduler/CPMSolver.ts"
  - "tests/planning/check-xer-*"
  - "tests/planning/xer-*.json"
  - "tests/planning/xerManifest*"
  - "tests/planning/check-ifc-xer-*"
  - "tests/browser/*xer*"
  - "docs/xer-recovery-guardrails.md"
---

<!-- Verplaatst uit CLAUDE.md (2026-09, bij het samenvoegen van PR #109 met de CLAUDE.md-inkorting van #176): laadt alleen wanneer Claude een bestand leest dat op `paths` past. Inhoud overgenomen; kruisverwijzingen wijzen naar het betreffende rules-bestand. -->

### De XER-lezer (Primavera P6): bronarchief in het IFC, P6-getrouwheid in drie lagen

`src/services/xer/` leest het native `.xer`-uitwisselingsformaat van Primavera P6 rechtstreeks
(geen Rust, geen externe bibliotheek): `xerTables.ts` (tabelparser, getalnotatie uit `CURRTYPE`,
tekencodering BOM → UTF-8 → enkelbyte (besluit B17): Windows-1252, tenzij de tekst eenduidig Cyrillisch/Grieks/Arabisch
is ⇒ Windows-1251/-1253/-1256 (`detectSingleByteEncoding`, review PR #109 N3; Latijnse 1250/1254 zijn niet te
onderscheiden en blijven 1252; de openingsmelding noemt de keuze); een `%R` die door een rauw regeleinde in een cel te kort is, wordt met
de volgende markerloze regels samengevoegd als dat het veldental exact haalt, max. 8 regels — P6 zelf schrijft DEL-DEL), `xerReader.ts` (entry point `readXER()`, hetzelfde
`ImportResult`-contract als de andere lezers, via `formatRegistry.ts` achter een dynamic import),
`xerMultiProject.ts` (één bestand ⇒ meerdere documenten; baselineprojecten worden bij hun huidige
project gematerialiseerd), `xerCalendarData.ts` (de `clndr_data`-decoder incl. herstelcodes),
`xerScheduleOptions.ts` (SCHEDOPTIONS → `SchedulingOptions`, X5), `xerRecordedTimes.ts` (zie
hieronder) en de resource-/metadata-lezers. Het volledige plan met eigenaarsbesluiten, dossiers en
de overdrachtsstand staat in `docs/superpowers/plans/2026-08-20-plan-xer-p6-lezer.md`; lees §4.1
(de veldwhitelist met vier "bakken") vóór je een TASK-kolom aanraakt.

Drie architectuurregels die je moet kennen. (1) **Het bronarchief.** De volledige oorspronkelijke
`.xer`-bytes reizen als `xerSourceArchive` (+ `xerImportMetadata`, `xerSourceProjectId`) mee in
`DOCUMENT_FIELDS` én in `IFC_SAVE_KEYS` (`src/state/ifcSaveInput.ts`; de archiefvelden zelf in `src/services/xerSourceArchive.ts`): het IFC-projectbestand
draagt het archief volledig (pset-schema 2). Crashherstel schrijft het één keer (eigenaarsbesluit plan
(9), sinds 2026-10-07): een snapshot draagt alleen een verwijzing (schema 3, `recovery-reference-v1`,
via `serializeRecoverySnapshot` in `src/services/recovery/recoverySnapshot.ts`), de bytes staan als
content-adressed blob (sha256) naast de snapshots en verdwijnen als geen manifestregel ze nog noemt;
een ontbrekende blob ⇒ openen met `xerArchiveIssue` `bytes-missing` (`docs/xer-recovery-guardrails.md`,
ontwerp in `docs/superpowers/plans/2026-10-07-xer-archief-eenmalig.md`). De MCP-tool `planner_inspect_xer_provenance` en de extensie-API `data.getImportSource*` (achter
de permissie `importSource`, default-deny) lezen eruit. De MCP-tool toont resourcenamen alleen met
`includeResourceNames: true` (ook vereist voor `rawSource`; RSRC-bronrijcellen vragen dat naast `includeRawRows`);
de toolbeschrijving laat de AI-client eerst de gebruiker om toestemming vragen. Codes (`code` = `rsrc_short_name`)
blijven altijd zichtbaar (eigenaarsbesluit 22-09, bevestigd 2026-10-07). De extensie-API filtert géén namen: daar is
de door de gebruiker verleende `importSource`-permissie de toestemming. Een onbruikbaar archief (corrupt, afgeknot of door
een ander IFC-programma herschreven) wordt bij openen WEGGELATEN met één in-app melding — nooit stil
(eigenaarsbesluit 2026-09-24, "openen met melding"): `readIFC` zet `ImportResult.xerArchiveIssue` (zes
codes), `src/state/xerArchiveIssueNotice.ts` maakt er de melding van, `data.getImportSourceIssue()` en
de MCP-provenance tonen het signaal; `xerOrigin` blijft dan afwezig (geen archief, geen archiefherkomst).
Een activiteit zonder `target_start_date` volgt de gedeelde regel `resolveMissingScheduleDates`
(`services/importDates.ts`): anker = statusdatum (`last_recalc_date`, of `data_date` als die kolom ontbreekt), dan
`PROJECT.plan_start_date`, dan de vroegste aanwezige taakstart; nooit meer 1970. De openingsmelding telt ze
(`ImportResult.xerMissingPlannedStarts`, transient; review PR #109 N1).
De documentnaam na een XER-import is de projectnaam, met het P6 Project-ID tussen haakjes als dat afwijkt
(`src/utils/documentProjectCode.ts`, één regel voor XER en P6 XML; de XER-code komt uit `xerProjectCode` in
`src/utils/xerDocumentName.ts`). (2) **Bak 4 — opgeslagen rekenuitvoer is
weergave, nooit solverinvoer.** De zes P6-uitvoerkolommen (`early_/late_start/end_date`,
`total_/free_float_hr_cnt`) mogen uitsluitend via `xerRecordedTimes.ts` gelezen worden, als
`ImportResult.recordedTimes`; ze voeden de weergave "Datums zoals opgeslagen" (issue #63, zie
`.claude/rules/state.md`) en de X12-meetlat, nooit `Task.time` als invoer. Bak 2 (`restart_date`,
`driving_path_flag`, …) mag de lezer nooit lezen. `tests/planning/check-xer-field-whitelist.ts` grept beide grenzen
corpusloos over heel `src/`; de X12-non-interferentie in `check-xer-product-fidelity-x12.ts` bewijst
het per mutatie. (3) **P6-gedrag loopt via het rekenprofiel, niet via het bronformaat.** De XER-lezer zet
`project.schedulingProfile` op het ingebouwde profiel Primavera P6, zonder afwijkingen (`rem_target_link_flag`
wordt alleen nog als diagnose gelezen, sinds 2026-09-24 stuurt hij A19 niet meer); elke P6-specifieke
solvertak staat achter een eigen conventievlag (zie `.claude/rules/rekenprofielen.md`).
`SchedulingOptions.p6Source` bestaat niet meer; oude IFC-bestanden met `p6Source` migreren per veld
(`legacyOptionsToProfile`). `WorkCalendar.p6Source` blijft als diagnoseveld. Uitzondering: `lagCalendar`
is sinds X5 een werkende instelling voor élk formaat.

Meten gaat via het corpus (`OPS_XER_CORPUS`, plan §10.a; niet in de repo, geen CI-poort):
`check-xer-product-fidelity-x12.ts` telt zesassige afwijkingen tegen P6's eigen uitvoer
(`OPS_XER_FIDELITY_REPORT=summary|detail|baseline`), gepind in `xer-product-fidelity-baseline-v2.json`
en corpusloos in `check-xer-corpusless-fidelity-gate.ts`. De orakelpopulatie is sinds 2026-09-23
alleen de aantoonbaar door P6 doorgerekende bestanden (`xer-corpus-manifest.json`, eigenaarsbesluit;
rehab-2 = P3-uitvoer, de DCP-03-Baseline-kopieën = generatoruitvoer en de synthetische bestanden zijn
`reader-only`). Binnen een orakelbestand kan een eigenaarsbesluit bovendien projecten of taken uit de
meetlat halen (`excludeProjects`/`excludeTasks` met `decision`; sinds 2026-09-23: OZB project 9033
(genivelleerd), Hotel project CR, 8 HarbourPointe-taken met verouderde P6-uitvoer; sinds 2026-09-24 ook
HarbourPointe EC1420, dat zijn datums uit die verouderde EC1430 krijgt — 42 taken, hun
afwijkingen staan als niet-stijgende pin `excludedHidden` in het cellenbestand). Het manifestveld
`leveledProjects` (`tests/planning/xerManifestLeveling.ts`) is het meetmechanisme voor de toekomstige
nivellering, zonder data en zonder invloed op de telling. Het nuldoel van plan §1
is niet gehaald (76 zesassige afwijkingen over 8 geselecteerde entries en 18 projecten op 2026-09-24, na C14;
daarvoor 15.056 op het oude, bredere orakel); mét corpus staat de suite daarom by design rood op precies die drie
nuldoelregels. Het cellenbestand (`xer-product-fidelity-cells.json`, versie 2) is een ratchet per cel
op emmer én afwijkingsgrootte, met een eenmalige `ratchetDebt` (14 Roads-cellen, sinds X12 brok 6 op 0) die alleen mag dalen;
recept en verboden omwegen in `scripts/README.md`; de cel-baseline per rekenprofiel draait via
`npm run measure:profiles`.
`npm run test:browser:x11` legt lokaal (headed, met corpus en desktopdisplay) aanvullend schermbewijs vast;
hij vervangt de corpusloze CI-poort niet.
Gebruikersgidsen: `public/docs/{nl,en}/howto-xer-openen.md` en `uitleg-datums-zoals-opgeslagen.md`.

### De XER-schrijver (#391)

`src/services/xer/xerWriter.ts` (`writeXER`) schrijft een `.xer` uit de documentstate; `exportAs('xer')`
in `fileSlice.ts` laadt hem lazy via `writeXerExport` (`formatRegistry.ts`, dezelfde chunkgrens als de
lezer) en slaat de bytes op via `saveBytesDialog`. Het contract (invoer, uitvoer, verliescodes,
`LOSS_ORDER`) staat buiten de lazy map in `src/services/xerWriteTypes.ts`. Vier regels:
(1) **Verlies wordt geteld, nooit stil.** Elke soort die XER niet draagt, telt de writer als
`XerWriteLoss` (vaste volgorde `LOSS_ORDER`); `state/xerExportNotice.ts` maakt er één melding met een
detailregel per soort van. Een nieuw OPS-gegeven dat de writer niet schrijft, krijgt een eigen code én
een `notifications.exportXerLossItem.*`-sleutel. De algemene XER-bronmelding (`xerExportLoss.ts`) valt
bij `xer` weg; haar bron-categorieën worden de regel `sourceDetails`.
(2) **Bak 2 en bak 4 alleen via catalogi.** De PROJECT-kolommen `plan_start_date`/`plan_end_date`/
`critical_drtn_hr_cnt` staan in `XER_PROJECT_PLANNING_COLUMNS` (drie gepinde uitzonderingen in
`check-xer-field-whitelist.ts`), de vastgelegde rekenuitvoer komt uit `XER_RECORDED_OUTPUT_COLUMNS` in
`xerRecordedTimes.ts`. Schrijf nooit zo'n kolomnaam als letterlijke string.
(3) **OPS-markeringen** (`xerOpsMarkers.ts`): de writer zet twee UDF's, `OPS_TaskDurationUnit` (TASK) en
`OPS_ExportInfo` (PROJECT, `ops-xer-1;hourCalendars=<clndr_id's>`). De herkenning is streng (review PR #393):
precies één definitie van elk, een geldige waarde voor het project én een eenheidswaarde voor ELKE
activiteit van het project. Alleen dan leest `readXER` dat project als OPS-export (geen uurmodus-promotie
uit kloktijden, maar de modus per kalender uit de lijst en de eenheid per taak uit de UDF), en filtert
`xerMetadata.ts` de markeringen uit de eigen velden (alleen als elk project in het bestand herkend is).
Anders leest het bestand exact als op main; `check-xer-writer-review.ts` (R1) pint dat.
(4) **Geplande datums** (`target_*`) = `scheduleStart`/`scheduleFinish` (het omgekeerde van de lezer),
niet de berekende datums: onder P6-herkomst leest de lezer `target_*` als ondergrens.
Codering: Windows-1252 (MPXJ-default, BEVESTIGD in de MPXJ-bron); past een teken niet, dan UTF-8 zonder BOM
met een `nonLatinText`-verlies (hoe P6 dat leest is VERMOED, niet bewezen). Project-ID zonder eigen code = de
projectnaam (geen `OPS:`-code; `xerProjectCode` filtert niets). Codes (activiteit, WBS per ouder, resource):
eerst normaliseren, dan lengte (40) en uniciteit (`uniqueCode`). Bewijs: `tests/planning/check-xer-writer.ts` (rondgang, zelfde datums en
speling na `solveProject`, XER → OPS → XER → OPS op `tests/browser/fixtures/xer`, byte-gelijke tweede en
derde export). Een import in P6 zelf is niet getest.
