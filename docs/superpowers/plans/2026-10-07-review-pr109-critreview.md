# Hyperkritische review PR #109 (XER/P6-lezer etappe 3) — stand op main

**Reviewer:** Claude Opus 5.5 (`uitvoerder-opus-midden`), via de skill `hyperkritische-review`. Datum: 2026-10-07.
**Onderwerp:** PR #109, gemerged als `1d8f2df6`. Ik beoordeel de code zoals hij nu op `origin/main` staat (`82213573`). Veel code is na de merge veranderd: de rekenprofielen-groepen A–D (#226/#233/#235/#236/#237), de importfix `0be6ff7c` (ontbrekende geplande datums), de IFC-fixes (GlobalIds, ISO 10303-21-tekst) en de nieuwe gidsen (`6e7c30ba`). Waar dat telt, noem ik het.
**Werkwijze:** alleen lezen, plus proeven in `/tmp/ops-review-pr109-probes/` (mutanten op een kopie van `src/`, corpusscan, eigen fixtures). Geen repo-wijziging, geen commit.

## Samenvatting in gewone taal

De XER-lezer op main is degelijk. Vrijwel alle punten uit de Fable-review van 24 september zijn echt opgelost, en voor de belangrijkste heb ik bewezen dat een test rood wordt als je de fix terugdraait. Er blijft één echte fout over die gebruikers kunnen zien: een XER-bestand zonder geplande startdatum zet het project en zulke taken op 1 januari 1970, zonder melding; drie bestanden uit het corpus doen dat al.

## Oordeel

**GO-MET-FIXES.** De code staat al op main. Er is geen reden om iets terug te draaien. Bevinding N1 (1970) moet in een vervolg-PR. N2 en N3 zijn klein en mogen mee in dezelfde PR.

Aantallen nieuwe of nog open bevindingen: HOOG 0 · MIDDEN 1 · LAAG-MIDDEN 2 · LAAG 0 bevestigd · VERMOED 4.

Apart vermeld, niet uitgewerkt: de grootte van het bronarchief per crashherstel-snapshot (17,7 MB `.xer` ⇒ ±50 MB IFC per auto-save-tick). De bouw-agent op `claude/xer-archief-eenmalig` lost dat nu op (eigenaarsbesluit: het archief één keer schrijven).

## Poorten die ik zelf draaide

- 71 gerichte checks corpusloos, elk apart gebundeld en gedraaid (`runchecks.log`). Ik nam alle `check-xer-*`, `check-recorded-dates*`, `check-document-contract`, `check-ifc-xer-*`, `check-recovery-*`, `check-import-missing-schedule-dates` en `check-p6-verified-cases-engine`. Uitkomst: 68 met exit 0. Drie gaven exit 1 door mijn eigen opzet en niet door de code. `check-xer-chunk-boundary` miste in mijn spiegelmap `vite.config.ts`; na een symlink gaf hij exit 0. `check-xer-metadata-catalog-types` en `check-xer-resource-catalog-types` zijn typecheck-bestanden en zijn niet bedoeld om los te draaien (`run.sh:137-138`).
- Daarnaast `bash tests/planning/run.sh` voor `check-xer-field-whitelist.ts`, `check-xer-recorded-roundtrip.ts` en `check-xer-archive-fallback.ts`: alle drie exit 0.
- Corpusscan (eigen proef `probes/p-corpus.ts`, 93 `.xer`-bestanden) via het echte open-pad: `readXER` → `payloadFromImport` → `prepareLoadedPayload` → `applyRecordedDatesOnLoad`. Uitvoer in `corpus.out`. 31 bestanden weigeren met een getypte fout. Dat zijn allemaal generatorbestanden zonder `proj_id`/ERMHDR, of lege projecten; alle 31 weigeringen zijn terecht.
- `npm run verify`, `test:browser` en X12 mét corpus heb ik niet gedraaid. Dat stond niet in de opdracht en het mag maar één `verify` tegelijk draaien.

## Fable-punten (review van 2026-09-24): is het echt opgelost op main?

| # | Fable-punt | Opgelost? | Bewijs |
|---|---|---|---|
| 1 | Laadsolve ≠ F5 (`projectEndDate` ontbrak) | **ja — BEVESTIGD** | `src/state/documentActivation.ts:238-239` gebruikt `solveInputFor(...)`. Hetzelfde geldt voor `documentSlice.ts:756-757`, `occupancy.ts:78`, `projectSlice.ts:385`, `runner.ts:155` en `useTableReportSpec.tsx:73`. Mutant `mut1` (alleen in het laadpad `projectEndDate: undefined`) ⇒ `check-solve-input.ts` C5-01 **rood** ("verwacht 2026-06-30, kreeg 2026-06-05"); het origineel is groen. |
| 2 | Verzonnen projecteinde-anker bij `Y` zonder `plan_end_date` | **ja — BEVESTIGD** | `xerReader.ts:855-857` (`sourceProjectEnd ?? ''`) en `CPMSolver.ts:190-195` (`withEffectiveProjectEndAnchor`). Mutant `mut2` (terug naar `taskDerivedProjectEnd`) ⇒ `check-xer-reader.ts` 13c, 13d, 13e en 13f **rood**. Corpus: Roads, HarbourPointe en OZB krijgen `end=''`. |
| 3 | Bak-2-grep met triviale schrijfwijzen te omzeilen | **ja — BEVESTIGD** | Er is nu een AST-poort: `check-xer-field-whitelist.ts:395-433`, met zeven zelftestmutanten (`:448-460`): alias, optional chaining, variabele sleutel, template, string-index, destructurering en interpolatie. Daarnaast gepinde uitzonderingen per bestand+context+aantal. Exit 0. De poort benoemt zijn eigen grens eerlijk (`:384-388`: een samengestelde naam glipt door). |
| 4 | Gids verkocht 7a als P6-gedrag | **ja (anders opgelost) — BEVESTIGD** | De regel zit nu achter conventie B3 `p6CompletedDataDateWindow`. Die staat in **elk** ingebouwd profiel uit (`registry.ts:111`). `ref-rekenopties-en-conventies.md:87` zegt "Alleen gezien in P3-uitvoer. Standaard: uit". De claim "Primavera … doet dat na" komt in geen enkele gids meer voor. Gevolg: laag 1 (7a) is op main in de praktijk uitgeschakeld. Dat is een besluit uit de rekenprofielen-etappe, geen fout van #109. |
| 5 | Dode CP_Phys-tak | **deels** | Hij is niet verwijderd, wel gedocumenteerd als diagnosetak (`p6CompletedTargetWindow.ts:130-138`). De redenen zijn gepind in `check-xer-completed-cp-phys-window.ts` (exit 0). Dat is acceptabel. |
| 6 | Kapot archief maakt het hele IFC onopenbaar | **ja — BEVESTIGD** | `ifcReader.ts:176-182` en `:444-469` (`readXerArchiveOrIssue`): archief, selector en metadata vallen samen weg en `xerArchiveIssue` gaat mee. `check-xer-archive-fallback.ts` (16 checks, exit 0) dekt een echt herschreven bestand (`tests/planning/fixtures/xer-archief-herschreven.ifc`), één melding, documentwissel, opslaan en crashherstel. Een mutant draaide ik hier niet. |
| 7 | Documentnaam = Project-ID | **ja — BEVESTIGD** | `xerReader.ts:466-472` (`proj_name`, anders de enige root-WBS) en `:988`; `utils/xerDocumentName.ts`. Corpus: "HBTF - Package 2 (Main Contract Works) (HBTF-2)", "Construction Works (CR)". |
| 8 | Regeleinde in een cel kapt de rij af | **nee — BEVESTIGD open** | `xerTables.ts:662` is ongewijzigd. Zie N2. |
| 9 | Kale `FF`/`SF` ontbraken | **ja** | `xerReader.ts:434-437`. |
| 10 | Verzonnen `0`/`.F.` in IFC-slots in de modus | **ja** | `ifcTaskSlots.ts:138-148` (`unlessWithheld`) samen met `ifcSaveInput.ts:52-57`. `check-xer-recorded-roundtrip` exit 0. |
| 11 | `rawSource` buiten de 256 kB-belofte | **ja** | De toolbeschrijving noemt de uitzondering nu (`xerProvenanceTools.ts:811-812`), maximaal 8 chunks (`:709`). |
| 12 | Dode `'mpp'`-tak | **ja** | `xerExportLoss.ts:29` ("Er bestaat geen `.mpp`-export"). |
| 13 | Bibliotheek-refresh in de modus stil | **nee, bewust gepind** | `documentActivation.ts:134` (`markScheduleStale` is een no-op in de modus). De test `check-document-activation.ts:151` "Behind-kalender respecteert datums-als-opgeslagen" pint dit gedrag als ontwerp. Zie V1. |
| 14 | `base_clndr_id`-overerving niet toegepast | **nee** | Alleen gelinkt en gevalideerd (`xerCalendarData.ts:802-815`, `:958-990`), niet toegepast. Blijft VERMOED laag; het corpus toont geen geval. |
| 15 | Windows-1252-terugval voor niet-Latijnse P6 | **nee — nu BEVESTIGD** | Zie N3. |

## Nieuwe bevindingen, ergste bovenaan

### N1. [BEVESTIGD] Ontbrekende geplande start ⇒ taak en project op 1970-01-01, zonder melding — ernst MIDDEN

**Waar:** `src/services/xer/xerReader.ts:637-640`. Daar staat `start = explicitTargetStart ?? sourceInstant(last_recalc_date) ?? '1970-01-01'`, en op `:846` geldt `projectStart = starts[0]`. De gedeelde regel `resolveMissingScheduleDates` (`services/importDates.ts`, commit `0be6ff7c`, "alle lezers") is in CSV, MSPDI, P6 XML en MPP ingebouwd, maar **niet in de XER-lezer**. `tests/planning/check-import-missing-schedule-dates.ts` bevat geen enkel XER-geval: er is dus een testgat.

**Faalscenario's (gedraaid):**
- Eigen fixture `fixtures/zonder-geplande-start.xer`. Het project heeft `plan_start_date` = 2026-06-01 en geen `last_recalc_date`. Een taak zonder `target_start_date` geeft: `scheduleStart` 1970-01-01, ES 1970-01-01T08:00 ná de laadsolve en projectstart 1970-01-01 (`probes/p-missing.ts`). `xer.report` en de meldingen zeggen niets.
- Corpus (`corpus.out`): `crawl-xer/MER-1-2026_epc.xer` (120/120 taken), `crawl-xer-extra/clause-epc/MER-1-2026_update_2026-05-01.xer` (120/120), `P6-Viewer/XER Files/sample.xer` (11/11) en `crawl-xer/kedular-field-mismatch.xer` (1/2) krijgen invoerstart 1970 en projectstart 1970. Deze bestanden openen automatisch in "Datums zoals opgeslagen". De modus toont P6's vroege datums en verbergt zo de 1970-invoer. In MER-1 en sample.xer blijft de rekenuitkomst toevallig goed, want de taken hebben actuals of voorgangers (`probes/p-mer.ts`: na F5 0 taken met ES in 1970). Maar Projectinfo, de exportformaten en de vloer `rootFloor` lezen projectstart 1970. Een nieuwe taak zonder voorganger gaat in zo'n project ook naar die vloer.
- De lezer negeert `PROJECT.plan_start_date` en `PROJECT.data_date` als terugval. Juist die velden staan in deze bestanden (MER-1 heeft `data_date`, sample.xer heeft `plan_start_date`).

**Waarom het pijn doet:** dit is precies de klasse fouten die `0be6ff7c` voor alle andere lezers dichtzette ("een wortel-taak verhuisde naar vandaag"). Bij XER is het nu "naar 1970": erger, en stil.

**Fix:** roep `resolveMissingScheduleDates` ook in `readXER` aan, vóór de voortgangsnormalisatie. Neem als anker `PROJECT.plan_start_date`, dan `last_recalc_date`/`data_date`, dan de vroegste aanwezige taakstart. Meld elke vervangen datum als `enumFallbacks`- of tabelissue, zodat de openingsmelding hem telt. Let op: dit verandert solverinvoer ⇒ regel A/B, dus `measure:profiles` en X12 mét corpus draaien. De vier betrokken bestanden zijn `reader-only`/geen orakel, dus de X12-baseline hoort niet te bewegen; meet dat wel.

**Testen:** voeg XER-gevallen toe aan `check-import-missing-schedule-dates.ts`: (a) geen `target_start_date` mét `plan_start_date`, (b) alleen `data_date`, (c) niets. Mutatiebewijs: zet de oude `?? '1970-01-01'` terug ⇒ rood.

### N2. [BEVESTIGD] Rauwe regeleinde in een tekstcel: de rest van de TASK-rij verdwijnt, de taak landt op 1970 — ernst LAAG-MIDDEN (Fable 8, nog open)

**Waar:** `src/services/xer/xerTables.ts:662-672` en `:719-724`. Een vervolgregel telt alleen als vervolg wanneer kolom 0 leeg is.

**Faalscenario (gedraaid, `probes/p-tokenizer.ts`, fixture `fixtures/regeleinde-in-naam.xer`):** `task_name` = "Fundering⏎storten" geeft de naam "Fundering", `target_drtn_hr_cnt` en de doeldatums gaan verloren, de taak staat op 1970-01-01 (via N1) en de duur is 0. De tweede halve regel wordt `XER_UNKNOWN_RECORD`; de rij krijgt `XER_ROW_FIELD_COUNT_MISMATCH`. Die tellers verschijnen alleen als diagnose. Niets zegt "deze taak is beschadigd". Echte P6-uitvoer schrijft regeleinden als `\x7f\x7f`. Een XER die iemand met een spreadsheet of een script bewerkt, kan ze wel bevatten.

**Fix:** voeg een `%R` met te weinig cellen samen met de direct volgende regels zonder marker, tot het veldental klopt (begrensd, bijvoorbeeld 8 regels). Lukt dat niet, weiger de rij dan zichtbaar (REJECTED-issue met het taakcode-nummer) in plaats van haar half te importeren.

**Testen:** voeg de twee fixtures toe aan `check-xer-tables.ts`. Verwacht: volledige naam met `\n`, duur 80 h en de juiste datums.

### N3. [BEVESTIGD] Niet-Latijnse P6-bestanden worden stil als Windows-1252 gelezen ⇒ onleesbare namen, ook in de tabtitel — ernst LAAG-MIDDEN (Fable 15)

**Waar:** `src/services/xer/xerTables.ts:302-322`. Zonder BOM probeert de lezer strikte UTF-8 en anders altijd `windows-1252`.

**Faalscenario:** eigen proef met de cp1251-bytes van "Фундамент": de naam wordt "Ôóíäàìåíò". Corpus: `crawl-xer-extra/jailaff-xer-splitter/rehab-2.xer` (Arabisch, cp1256) opent als tab "ãÔÑæÚ ÇáÑÍÇÈ - 2 (R111)" en met 6.977 onleesbare taaknamen. De openingsmelding noemt alleen dat de codering "anders dan UTF-8" is. Ze zegt niet dat de tekst waarschijnlijk verminkt is.

**Fix (klein):** als de 1252-terugval veel tekens in het bereik 0xC0–0xFF oplevert en geen gewone West-Europese woorden, toon dan een waarschuwing in de bestandsmelding. Een melding per codetabel hoort via `t(...)` te lopen. Groter (eigen PR): een keuze "Lees opnieuw als …" met cp1250/1251/1253/1256.

**Testen:** een fixture met cp1251-bytes in `check-xer-tables.ts`; verwacht een waarschuwingsissue.

### V1. [VERMOED · zekerheid: laag] Kalenderverversing uit de bibliotheek in de modus: de strook blijft "zoals opgeslagen" beweren

`documentActivation.ts:126-135`. In de modus wordt de kalender ververst en settelen taken met een werkregel. Toch blijft de modus aan en blijft `scheduleStale` uit. `check-document-activation.ts:151` pint dit bewust. Er komt wel de `libraryRefreshNotice`, maar de strook zegt niet dat invoer en kalender nu afwijken van wat P6 rekende. **Wat mist:** het bewijs dat de toestand "modus aan + gekoppelde bibliotheekkalender die achterloopt" bereikbaar is. Koppelen aan een bibliotheek lijkt `importPristine` te breken. Een store-test die de modus handmatig weer aanzet en daarna heropent, maakt dit BEVESTIGD of weerlegt het.

### V2. [VERMOED · zekerheid: laag] Kapot archief + `OPS_ImportProvenance.SourceFormat=xer` ⇒ oude OPS-solve als "datums zoals opgeslagen"

Zonder archief wordt de herkomst `'ifc-own'` met `recordedSourceFormat` xer. `recordedDatesSource` (`documentActivation.ts:304-317`) laat dan de IFC-slots toe. Was het bestand opgeslagen búíten de modus en nog `importPristine`, dan zijn die slots OPS's eigen eerdere solve. Na een app-update met andere rekenregels kan de modus dan automatisch aangaan en een oude OPS-berekening als P6-datums tonen. **Wat mist:** of F5 `importPristine` laat staan, en een round-trip-test (XER → F5 → opslaan → archief beschadigen → heropenen). Raakt #167 meer dan #109.

### V3. [VERMOED · zekerheid: laag] DCMA-rapport in de modus mengt P6-speling met een eigen solve

`dcmaAssessment.ts:183-190` (criticalPathTest) rekent een kloon door met OPS-regels. De andere metrieken lezen `task.time` en dat zijn in de modus P6's vastgelegde waarden. **Wat mist:** een rapporttest in de modus. Er bestaat al een rapportmelding in de modus. Mogelijk is dat genoeg.

### V4. [VERMOED · zekerheid: laag] Basiskalender-overerving (Fable 14) blijft niet toegepast

Ongewijzigd. Het corpus toont geen geval. Leg het vast als bewuste keuze in de decoder-header.

## Testkwaliteit (punt 9 van de opdracht)

- Goed: C5-01/02 (laadpad = F5) en 13c–13g (projecteinde) pinnen gedrag en bevatten een eigen tegenproef ("de fixture kan het verschil zien"). Mijn mutanten maken ze rood. De AST-poort heeft zelftestmutanten en telt uitzonderingen exact.
- Zwak: de XER-lezer zit niet in de formaatbrede test voor ontbrekende datums (N1). Er is geen test voor een rij met een regeleinde (N2) of voor een niet-1252-codering (N3). De "foute bestanden"-dekking test dus vooral harde weigeringen, niet half-gelezen rijen.

## Kon ik niet controleren

- X12 mét corpus, `measure:profiles`, `npm run verify` en `test:browser`: niet gedraaid.
- De visuele weergave: de dev-server op 3042 heb ik niet aangeraakt en niet in een browser bekeken.
- De bereikbaarheid van V1 en V2 in de echte UI.
- De MCP-leestools heb ik alleen op de punten van Fable gelezen (de `rawSource`-grens, het archiefsignaal). Privacy en paginering van alle secties heb ik niet opnieuw getest.

## Voor de visuele check door de eigenaar (http://localhost:3042/)

1. **N1 — projectstart 1970.** Open `/home/nozzit/open-aec/voor claude/testdata-crawl/crawl-xer/MER-1-2026_epc.xer`. Je ziet de strook "Datums zoals opgeslagen". Open Bestand → Projectinfo. Verwacht nu: startdatum 1 januari 1970. Druk F5 en zoom de Gantt uit ("passend maken"). Kijk of de tijdlijn naar 1970 springt. Open daarna `/tmp/ops-review-pr109-probes/fixtures/zonder-geplande-start.xer`, druk F5 en zie taak A100 in 1970.
2. **N2 — regeleinde.** Open `/tmp/ops-review-pr109-probes/fixtures/regeleinde-in-naam.xer`. Verwacht nu: taak A100 heet "Fundering", heeft duur 0 en staat in 1970. Lees de openingsmelding en kijk of die iets zegt over een beschadigde taak.
3. **N3 — codering.** Open `/home/nozzit/open-aec/voor claude/testdata-crawl/crawl-xer-extra/jailaff-xer-splitter/rehab-2.xer`. Verwacht: de tabtitel en de taaknamen zijn onleesbaar ("ãÔÑæÚ …"). Lees wat de melding over de codering zegt.
4. **Fable 1 — openen = F5 (moet goed zijn).** Open `/home/nozzit/open-aec/voor claude/testdata-crawl/crawl-xer/Hotel_Construction_TEC.xer` en kies tab HBTF-2. Noteer de late start en de totale speling van een paar taken en het aantal kritieke taken. Druk F5. Verwacht: niets verandert.
5. **Fable 2 — geen verzonnen projecteinde (moet goed zijn).** Open `/home/nozzit/open-aec/voor claude/testdata-crawl/crawl-xer/Roads_Project_TEC.xer`. Verwacht: in Projectinfo is de einddatum leeg en geen enkele taak heeft negatieve speling.
6. **Fable 6 — kapot archief (moet goed zijn).** Open `/home/nozzit/open-aec/open-planner-studio/.claude/worktrees/review-pr109/tests/planning/fixtures/xer-archief-herschreven.ifc`. Verwacht: het project opent volledig, met één melding "Het XER-bronarchief in dit bestand is onbruikbaar en weggelaten …" en een link "Lees meer".
7. **Fable 7 — documentnaam (moet goed zijn).** Open `/home/nozzit/open-aec/voor claude/testdata-crawl/crawl-xer/eh_P6Workshops/OZB-Start-09Dec24.xer`. Verwacht: elf tabs met de vorm "Bid for Facility Extension (OZB-…)".

## Poortuitspraak

Dit is fundamenteel gezond. De Fable-blokkers zijn aantoonbaar dicht. **Het gaat door: ja**, het staat al op main en blijft daar. Minimaal vóór de volgende XER-release: N1 (XER door `resolveMissingScheduleDates`, met testgevallen en een corpusmeting). N2 en N3 mogen in dezelfde PR mee.
