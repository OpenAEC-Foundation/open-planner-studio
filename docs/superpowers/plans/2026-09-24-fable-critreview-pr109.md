# Hyperkritische review PR #109 — XER/P6-lezer etappe 3 (Claude Fable 5.1, 2026-09-24)

**Reviewer:** Claude Fable 5.1 (model-id `claude-fable-5-1`), op verzoek van de eigenaar.
**Onderwerp:** PR #109, branch `claude/file-formats-support-phase-3-a0ebe2` op `0a29147c`, diff t.o.v. `origin/main` (`dccb437e`): 348 bestanden, +59.811/−871. Gelezen in een eigen detached worktree; corpus alleen-lezen via `OPS_XER_CORPUS`.
**Oordeel: LANDEN-MET-FIXES** — één echte bug in het laadpad, één poort die zichzelf niet kan laten falen, en één P6-semantiekkeuze zonder bewijs die in de gids als P6-gedrag wordt verkocht. De rest is degelijk.

## Voor de eigenaar, in gewone taal

De XER-lezer, het bronarchief in het IFC, "datums zoals opgeslagen", crashherstel en de MCP-/extensietoegang zijn stevig gebouwd en goed getest; typecheck, docs, i18n, cycles en store-grenzen staan groen op de kop van de branch en het IFC-rondje op het grootste corpusbestand geeft de P6-vastlegging byte-identiek terug. Maar er zit één bug in die de gebruiker direct raakt: de berekening die de app bij het **openen** van een `.xer` doet is een andere dan de berekening die hij bij **F5** doet, omdat het laadpad de projecteinddatum niet doorgeeft. Op Hotel_Construction verschuiven daardoor 4.217 van 5.181 late datums en wisselen 388 taken van kritiek-status tussen "net geopend" en "F5 gedrukt" — zonder dat er iets is bewerkt. Daarnaast is de "sluiproute-grep" die moet bewaken dat de lezer geen verboden P6-uitvoer leest, met vier van de vijf triviale omschrijvingen te omzeilen, en beweert de gids over voltooide activiteiten dat de app "Primavera nadoet", terwijl de code zelf zegt dat de regel correlationeel is en door het enige directe P6-bewijs wordt tegengesproken.

## Bevindingen, ergste bovenaan

### 1. [BEVESTIGD] Laadsolve ≠ F5-solve: `prepareLoadedPayload` geeft `projectEndDate` niet door — ernst HOOG

`src/state/documentActivation.ts:198-207` roept `solveProject` aan met `projectStartDate` maar **zonder** `projectEndDate`. Alle andere solve-aanroepers geven hem wél mee: `scheduleSlice.ts:139` (runCPM), `:259` (applyLeveling), `documentSlice.ts:721` (recalculateStaleSleepingDocuments), `projectSlice.ts:387` (moveProject-preview) én de X12-meetlat (`xerTaskReplayProduct.ts:88`, `check-xer-product-fidelity-x12.ts:159`). De solver leest hem op `CPMSolver.ts:3049-3054` zodra `useProjectEndDateForFloat === true` — en dat zet de XER-lezer voor élk bestand met `sched_use_project_end_date_for_float=Y` (`xerScheduleOptions.ts:398-408`).

Gemeten (eigen script, `readXER` → tweemaal `solveProject`, één keer zonder en één keer mét `projectEndDate`, beide op een kloon):

| bestand / project | taken | LS≠ | LF≠ | TF≠ | kritiek≠ |
|---|---|---|---|---|---|
| Hotel Project.xer / HBTF-2 | 5.181 | 4.217 | 4.217 | 4.217 | 388 |
| TERMINAL BUILDING-AIRPORT.xer / TERMINAL-2 | 92 | 65 | 65 | 65 | 35 |
| Roads_Project_TEC.xer / 1 | 1.320 | 1.036 | 1.036 | 1.036 | 0 |
| OZB-Start-09Dec24.xer / OZB-07 | 18 | 14 | 14 | 14 | 0 |

Gevolgen: (a) wat de gebruiker ná openen ziet (late kant, speling, kritiek pad) verandert bij de eerste F5 zonder dat hij iets deed; (b) `countShiftedTasks`/de automatische modus-keuze in `applyRecordedDatesOnLoad` (`documentActivation.ts:255-269`) worden berekend tegen een solve die niet de productsolve is (ES/EF raakt het maar marginaal — 1 taak op Hotel — dus de teller klopt toevallig meestal); (c) de X12-baseline (15.056) is gemeten op de F5-variant, dus de gemeten "productfidelity" is niet wat het product bij openen toont; (d) crashherstel van het actieve document (`documentSlice.ts:589-591`) en `recalculateStaleSleepingDocuments` lopen ook nog eens langs twee verschillende solves. Geen enkele test vangt dit, want alle tests solven rechtstreeks met `projectEndDate`.

**Fix:** één regel — `projectEndDate: payload.project.endDate` in `prepareLoadedPayload`. Voeg een corpusloze check toe die `prepareLoadedPayload(payload,{recompute:true}).cpmResult` byte-vergelijkt met `solveProject({...alle velden uit dezelfde payload})`, zodat de twee routes nooit meer uit elkaar kunnen lopen (het `documentContract`-patroon: één bron voor de solve-invoer, bv. een `solveInputFromPayload(payload)`-helper die runCPM, documentSlice en documentActivation alle drie gebruiken). Daarna X12 opnieuw meten — de baseline hoeft niet te bewegen (de meetlat gaf de datum al door), maar de blast-radius-cellen kunnen.

### 2. [BEVESTIGD] `sched_use_project_end_date_for_float=Y` zonder `plan_end_date` ⇒ de lezer verzint een projecteinde-anker — ernst HOOG (semantiek)

`xerReader.ts:823-830`: `projectEnd = useProjectEndDateForFloat && sourceProjectEnd ? sourceProjectEnd : taskDerivedProjectEnd`, en `xerScheduleOptions.ts:406-408` zet `useProjectEndDateForFloat = true` ongeacht of er een datum ís. Resultaat voor de 37 corpusprojecten met vlag Y en leeg `plan_end_date` (Roads, HarbourPointe, alle OZB, cases-import): de solver verankert de late pass op een **statisch, bij import bevroren** maximum van de *geplande* `target_end_date`s — niet op max(EF), wat P6 doet wanneer *Must Finish By* leeg is (in P6 is de optie zonder datum een no-op). Roads: 1.036 van 1.320 late datums verschillen tussen max(EF) en dit anker. Na élke bewerking die het project voorbij dat bevroren anker duwt krijgt vrijwel elke taak negatieve speling — de "projecteinde-fout" uit `docs/TODO.md` is hier een symptoom van (de projectstart-terugval is het degenerate geval zonder finishes, `:823`), niet de oorzaak.

**Fix:** in `deriveXerScheduleOptions` (of direct in `xerReader.ts:828`) de optie alleen op `true` zetten wanneer `PROJECT.plan_end_date` een geldige instant draagt; anders `false` met een `fallbacks`-regel (`sched_use_project_end_date_for_float` = Y zonder datum ⇒ genegeerd). `project.endDate` blijft dan gewoon de taak-afgeleide waarde en de solver valt op max(EF). Dit is een solverinvoer-wijziging ⇒ regel A/B, corpusmeting + herpin (de X12-baseline op Roads/HarbourPointe/OZB gaat bewegen — mogelijk omlaag). Dit is een eigenaarsbesluit in de zin van plan §5, maar de huidige keuze is aantoonbaar niet P6.

### 3. [BEVESTIGD] De bak-2-sluiproute-grep is met vier van vijf triviale schrijfwijzen te omzeilen — ernst HOOG (poort)

`tests/planning/check-xer-field-whitelist.ts:299-306` (`readsField`: drie regexen op `cells.veld`/`cells['veld']`, een string-argument in een aanroep, en destructurering). Mutatieproef, uitgevoerd in `xerReader.ts` direct na regel 439, elk apart, poort gedraaid vanaf de repo-root:

| mutant | exitcode |
|---|---|
| `const c = row.cells; const rd = c.restart_date;` | **0 (groen)** |
| `const rd = row.cells?.restart_date;` | **0 (groen)** |
| `const k = 'restart_date'; const rd = row.cells[k];` | **0 (groen)** |
| ``const rd = row.cells[`restart_date`];`` | **0 (groen)** |
| `const rd = row.cells['restart_date'];` | 1 (rood, zoals bedoeld) |

De PR-body noemt dit de blokker-1-fix van de eindreview ("nu grept `check-xer-field-whitelist.ts` ook bak 2 over heel `src/`, gemeten: mutant ⇒ rood"). Dat klopt alleen voor de ene mutant die daar gekozen is. Als poort is dit een placebo: iedereen die een alias of optional chaining schrijft — de gangbaarste TS-stijl — glipt erdoor. Dezelfde `readsField` bewaakt bak 4 buiten `xerRecordedTimes.ts`, met hetzelfde gat.

**Fix:** niet nóg een regex. Gebruik dezelfde AST-aanpak als `verify:store-boundaries`/`verify:conventions` (TypeScript-compiler-API): elke `PropertyAccessExpression`/`ElementAccessExpression` waarvan de naam of de string-literal een bak-2/bak-4-kolom is, én elke string-literal/template-literal met zo'n kolomnaam buiten een whitelist-array, in heel `src/` behalve `xerRecordedTimes.ts`. Voeg de vijf mutanten hierboven als positieve zelftest toe (zoals de bestaande `isolatiescan herkent de M-B-mutant`-regels), anders blijft de poort bewijzen wat hij zelf kiest.

### 4. [BEVESTIGD] De gids verkoopt de "voltooide activiteiten krijgen echte speling"-regel als P6-gedrag; de code zegt dat hij correlationeel is en tegengesproken wordt — ernst MIDDEN-HOOG (belofte ≠ code)

`public/docs/nl/gids-xer-import.md` §"Voltooide activiteiten krijgen echte speling": *"Primavera zet een voltooide activiteit … neer als een taak met nul restwerk op de statusdatum — ook aan de late kant. Open Planner Studio doet dat sinds september 2026 na."* De code (`src/types/project.ts:143-144`, docblok bij `p6CompletedLateFromRemainingWindow`): *"de poort dicht op `wrongDurationType`/`missingExplicitTargetWindow`; dat is een toevallige nauwte, geen semantische verzoening."* De PR-body zelf: *"correlationeel: het enige directe P6-bewijs (casus 09) spreekt de regel tegen zodra de poort opengaat."* De poort (`src/utils/p6CompletedTargetWindow.ts:60-124`) eist `DT_FixedDUR2` + `CP_Drtn` + `TT_Task`/`TT_Rsrc` + `p6ExplicitTargetWindow` + `rem_target_link_flag` — P6 conditioneert de late kant van een voltooide activiteit nergens op duurtype of voortgangstype (Oracle P6 Help, *Scheduling → Completed activities*: late dates = data date-gebonden, ongeacht Duration Type). Dit is een fit op rehab-2, en de gids verzwijgt dat. De gebruiker leest "wij doen Primavera na" waar de waarheid is "wij hebben een regel die op één corpusbestand 969 cellen beter maakt en die het enige P6-bewijs tegenspreekt".

**Fix:** de gidstekst (nl+en) eerlijk maken: "afgeleid uit corpusmateriaal, alleen actief onder deze vijf bronvoorwaarden, niet bevestigd door P6-documentatie" — of de regel achter een expliciete, in Projectinfo zichtbare optie zetten die standaard uit staat tot er direct bewijs is. Eigenaarsbesluit (plan §5 punt 5), maar de docs mogen niet meer zeggen dan de code weet.

### 5. [BEVESTIGD] Dode beslistak in de 7a-poort: het `CP_Phys`-pad kan nooit `eligible` worden — ernst LAAG (code die doet alsof hij beslist)

`src/utils/p6CompletedTargetWindow.ts:95-124`: `isPhysicalCompletion` laat `wrongCompletePctType` (`:97`) en `wrongActivityType` (`:104-108`) passeren, om op `:117-123` **altijd** `eligible: false` te geven (`notCompleted` of `wrongCompletePctType`). Alle tussenliggende `CP_Phys`-uitzonderingen zijn dus dood gewicht dat alleen de reason-code kleurt. Als de reason-codes voor de trace bedoeld zijn, zeg dat; anders de tak verwijderen. Het maakt de poort onleesbaar en suggereert een CP_Phys-route die niet bestaat.

### 6. [BEVESTIGD] Een corrupt bronarchief maakt het héle IFC-projectbestand onopenbaar — ernst MIDDEN

`src/services/ifc/ifcReader.ts:323` (`xerArchiveError` ⇒ `IfcParseError('xer-source-archive')`) wordt vóór `extractTasks` gegooid (`:171-183`), en `ifcErrors.ts:24` documenteert bewust "geen legacy fallback". De validatie is streng: exacte property-VOLGORDE (`:375`, `:392`), exact één `IFCRELDEFINESBYPROPERTIES` op exact één `IFCPROJECT` (`:339-350`), sha256-match, chunklengtes. Elk IFC-gereedschap dat een OPS-bestand herserialiseert (IfcOpenShell, BIMcollab, een editor die psets herordent) maakt het projectbestand daarmee onleesbaar — terwijl álle taken, relaties, kalenders en resources er gewoon in staan. Het archief is een sidecar, geen fundament; het mag de opening van het project niet gijzelen.

**Fix:** bij een ongeldig archief het archief laten vallen (`xerSourceArchive: undefined`, geen `recordedTimes`), één K8a-melding met de reden, en het project gewoon openen. Sha-mismatch mag een harde weigering van het *archief* zijn, nooit van het *project*. De strikte volgorde-eis kan blijven als integriteitsdetectie, niet als openingsvoorwaarde.

### 7. [BEVESTIGD] Documentnaam = P6 Project ID (`proj_short_name`), niet de projectnaam — ernst LAAG-MIDDEN (gebruikerszichtbaar)

`xerReader.ts:955`: `name: projectRow.cells.proj_short_name || projectId`. P6 bewaart de projectnaam in de root-PROJWBS-rij (`proj_node_flag=Y`, `wbs_name`); `proj_short_name` is de code. Tabbladen heten dus "HBTF-2", "CR", "TERMINAL-2" (gemeten op het corpus) in plaats van "Hotel Construction". De root-WBS wordt wél als samenvattingstaak gerenderd, dus de naam staat op het scherm — als eerste rij, niet als documenttitel. MPXJ (`PrimaveraReader.processProjectProperties`) neemt `wbs_name` van de root. Fix: root-WBS `wbs_name` als `project.name`, `proj_short_name` als code (er is geen `Project.code`-veld; desnoods `description`).

### 8. [BEVESTIGD] Tokenizer: een cel met een letterlijke regeleinde verliest stil de rest van de rij — ernst LAAG-MIDDEN

`xerTables.ts:660-668`: een vervolgregel wordt alleen als continuation herkend wanneer `values[0]` leeg is (`marker === ''`). Breekt een tekstcel midden in een `%R`-regel af (P6 schrijft `\x7f\x7f` voor regeleindes in notities, maar niet elke schrijver — en `task_name`/`wbs_name` kunnen via SDK's rauwe CR/LF dragen), dan is `values[0]` de rest van de cel, valt de regel in `XER_UNKNOWN_RECORD` (`:719`) en krijgt de rij `XER_ROW_FIELD_COUNT_MISMATCH` met ontbrekende trailing cellen (leeg ⇒ bv. `target_end_date` leeg ⇒ finish = start). Het wordt gerapporteerd als issue, maar niet als dataverlies benoemd. Fix: bij een `%R` met te weinig cellen en een direct volgende niet-marker-regel de regels samenvoegen tot het veldental klopt (bounded, bv. max 8 regels), anders de rij als REJECTED melden in plaats van stilzwijgend afknotten.

### 9. [BEVESTIGD] Relatietype-dialect half: kale `FS`/`SS` worden herkend, `FF`/`SF` niet — ernst LAAG

`xerReader.ts:425-431`: mapping bevat `PR_FS/PR_SS/PR_FF/PR_SF` plus kale `FS`/`SS`, maar geen kale `FF`/`SF`. Een dialectbestand met `FF` valt op `fallback → PR_FS` (gemeld, maar fout). Òf alle vier, òf geen — nu is het een halve regel.

### 10. [BEVESTIGD] In de modus opgeslagen IFC schrijft verzonnen `0`/`.F.` in de IfcTaskTime-slots — ernst LAAG

`ifcTaskSlots.ts:197`: `freeFloat`/`totalFloat`/`isCritical` schrijven ALTIJD een waarde. In de modus draagt `task.time` de terugvallen `totalFloat ?? 0`, `isCritical ?? false`, `lateStart ?? start` (`recordedDates.ts`, `applyRecordedTimesToTasks`). Voor OPS zelf geen verlies (de heropening haalt bak 4 uit het archief, `check-xer-recorded-roundtrip` 3a bewijst dat), maar voor élke derde IFC-lezer zegt het bestand `TotalFloat = PT0H`, `IsCritical = .F.` waar P6 niets zei. De gids ("inclusief welke assen het bronbestand niet vastlegde") is daarmee alleen waar via het archief. Fix: in de modus `$` schrijven voor niet-vastgelegde assen (de reader kent `recordedFields` al en kan `$` onderscheiden) — dat is precies wat `RECORDED_SLOT_KEYS` beloven.

### 11. [BEVESTIGD] MCP `planner_inspect_xer_provenance`: de toolbeschrijving belooft "elke pagina — óók summary — 256 kB", `rawSource` levert tot ~2,1 MB — ernst LAAG

`xerProvenanceTools.ts:682-697`: `rawSource` gaat niet door `finalizeBounded`/`createByteBudget`; 8 chunks × 262.144 base64-tekens ≈ 2,1 MB per antwoord. De beschrijving (`:721-737`) zegt "Elke pagina … kent een harde responsgrens (256 kB …)". Eén van beide aanpassen (bv. `maxLimit: 1` of de zin "behalve rawSource").

### 12. [BEVESTIGD] Dode `'mpp'`-tak in de exportverliesgids — ernst LAAG

`xerExportLoss.ts:11` (`XerLossyExportFormat = … | 'mpp'`), `:79-84` (`xerExportTargetVerdict('mpp') → 'unsupported'`), `:257` (`format === 'mpp' ? 'csv'`). Er bestaat geen `.mpp`-export (CLAUDE.md: "alleen-lezen"). `noUnusedLocals` vangt dit niet omdat het typen zijn. Weg ermee, of een test die `'mpp'` daadwerkelijk aanroept — nu is het code voor een toekomst die niemand beloofd heeft.

### 13. [VERMOED · zekerheid: midden] Bibliotheek-refresh in de modus wordt stil geslikt

`documentActivation.ts:90`: `materializeBehindOnlyRefresh` roept `markScheduleStale(payload)` aan na een kalenderwijziging uit de bibliotheek; in de modus is dat per `scheduleStale.ts` een no-op. Het document krijgt dus een andere kalender, blijft "vers" en toont P6's datums — zonder markering dat de kalender inmiddels afwijkt van wat P6 rekende. De PR-body noemt dit zelf als open dossier ("bibliotheek-refresh in de modus (VERMOED)"). Wat mist om het te bevestigen: een test die een slapend document in de modus een bibliotheek-kalenderupdate laat ondergaan en dan `scheduleStale`/`isDirty`/de melding inspecteert. Richting: in de modus de refresh niet stil toepassen maar als aanbod tonen, óf de modus verlaten met `finishMutation({stale:true})` zoals `moveProject` doet.

### 14. [VERMOED · zekerheid: laag] Basiskalender-overerving (`base_clndr_id`) wordt niet toegepast

`xerCalendarData.ts` linkt `baseCalendar` (niet-enumerable), maar niets in `src/services/xer/` leest hem (grep: nul treffers buiten de decoder). P6 kan uitzonderingen van de globale basiskalender laten overerven. Corpusscan: **0** afgeleide kalenders met minder uitzonderingen dan hun basis over 93 bestanden — P6 lijkt ze uit te schrijven. Blijft dus laag; noteer het als bewuste keuze in de decoder-header in plaats van een stille `linkBaseCalendar` die niemand gebruikt.

### 15. [VERMOED · zekerheid: laag] Windows-1252-terugval voor niet-Latijnse P6-installaties

`xerTables.ts` `decodeXerBytes`: geen BOM ⇒ strikt UTF-8, anders `windows-1252`. Een P6 op een Arabische/Cyrillische/CJK-Windows schrijft cp1256/cp1251/cp932. De PR-body erkent rehab-2's mojibake ("X-O4-heuristiek, pre-existent"). Geen fix vereist voor deze PR, maar de gids zegt "valt terug op Windows-1252" alsof dat de enige mogelijkheid is; een zin "andere Windows-codetabellen worden niet herkend" hoort erbij.

## Wat wél klopt (kort, want daar ben ik niet voor)

- **Bronarchief:** `writeIFC` schrijft alleen bytes (compact schema 2, `ifcWriter.ts:339-366`), de reader reconstrueert via `readIFCWithXerReconstruction`; álle `readIFC`-aanroepers in `src/` lopen via die naad (gecontroleerd: 9 callsites). Rondje gemeten: Hotel 3,8 MB → 14,7 MB IFC, rehab-2 18,6 MB → 52,8 MB, `recordedTimes` 4.217/4.217 resp. 6.976/6.976 identiek, sha gelijk. Heropenen van rehab-2's IFC kost 13,5 s in Node (4,3 s XER-parse + ~9 s IFC-parse) — dat staat niet in de gids ("opslaan duurt tientallen seconden" wel, openen niet).
- **Bak 4:** `readXerRecordedTimes` is de enige lezer; `captureRecordedDates` geeft `recordedTimes` voorrang; `applyRecordedTimesToTasks` raakt de solve niet (X12-mutatiebewijs 7a-7d in `check-xer-recorded-roundtrip`).
- **`scheduleStale`-invariant:** `markScheduleStale` is de enige schrijver, broncode-check in `check-recorded-dates.ts:903-931`; `runCPM` pusht in de modus één snapshot, daarbuiten niet.
- **Multi-project:** `xerMultiProject.ts` — baselinekeuze met self-ref/cycle/all-baselines-terugval, dubbele `proj_id` hard, externe relaties bewaard. Baselinetaken uit *geplande* datums, niet uit bak 4: correct.
- **Recovery v4:** immutable generaties, manifest-atomisch, `datesAsRecorded` in het manifest, slapende documenten in de modus hersteld zonder solve.
- **MCP/extensie:** `importSource` default-deny (`permissions.ts`, mode `throw`), consent-dialoog toont de enige privacypermissie apart; `planner_inspect_xer_provenance` deny-by-default op vrije tekst, bounded, niet batchable.
- **Tokenizer/getallen:** BOM-detectie, `CURRTYPE`-tokens, harde stop op bewijsbare komma-decimaal zonder `CURRTYPE`, harde stop op ongeldige getallen (liever rood dan verkeerd).
- **i18n/gidsen:** 14 locales met CLDR-meervouden (pl `few/many`, ar zes vormen, zh alleen `other`), nl/en gidsen structureel gelijk, `verify:docs`/`verify:i18n` groen.
- **Poorten op de kop:** `typecheck`, `verify:docs`, `verify:i18n`, `verify:cycles`, `verify:store-boundaries` alle exit 0 (zelf gedraaid). Alle 67 nieuwe `check-*.ts` zijn in `run.sh` bedraad.

## Kon ik niet controleren

- `npm run verify`, `test:browser`, `measure:profiles` en de X12-corpuspoort heb ik conform opdracht niet gedraaid; de 15.056/104-tellingen neem ik van de PR-body en CLAUDE.md over.
- De Oracle-documentatie voor "Compute Total Float as … Must Finish By leeg" heb ik uit het hoofd; bevinding 2 is aantoonbaar een *inconsistentie* (bevinding 1) en een *bevroren anker*; of P6 in dit geval exact max(EF) neemt, moet tegen Oracle's P6-help worden nagelezen vóór de herpin.
- De CP_Phys-tak in bevinding 5: mogelijk bewust voor trace-redenen; ik heb geen consument gevonden die op die reason-codes onderscheid maakt, maar heb niet alle 67 checks doorgelezen.
- `test:browser:x11` en de gebruikstest uit de PR-body: niet reproduceerbaar hier.

## Oordeel

**LANDEN-MET-FIXES.** Minimaal vóór merge naar `main`:

1. Bevinding 1 (één regel + een gelijkheidstest laadsolve ≡ F5-solve). Zonder dit toont het product bij openen een andere planning dan bij F5 — dat is geen dossier, dat is een bug.
2. Bevinding 3 (AST-poort met de vijf mutanten als zelftest). Een poort die groen blijft bij `row.cells?.restart_date` bewaakt regel §4.1 niet.
3. Bevinding 4 (gidstekst nl+en eerlijk over het correlationele karakter) — of de regel achter een zichtbare, standaard-uit optie.

Bevinding 2 is een solverwijziging met herpin en mag als eigen PR ná deze; bevindingen 6, 7, 10 horen in dezelfde etappe maar blokkeren de merge niet; 5, 8, 9, 11, 12 zijn opruimwerk. De PR is geen NO-GO: de architectuur (archief als sidecar, bak 4 als weergave, één solve-kern) staat en de tests zijn talrijk en scherp — behalve precies op de naad die niemand testte.
