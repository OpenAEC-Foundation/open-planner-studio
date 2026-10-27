# F2 — fixronde 1, deel B (laden, migratie, routes), 23 oktober 2026

De drie BLOKKEERT-punten uit review ronde 1, deel B, zijn opgelost, elk met een regressie en een
mutatiebewijs. Het VERVOLG-punt (dubbele normalisatie) is opgeruimd. De drie rode MCP-tests en de zeven
rode planningschecks uit CI-run 39973718779 zijn ingedeeld: twee checks waren een echte fout (B3, code
gerepareerd), de rest volgt uit besloten specpunten (B1, verwachting bijgewerkt). Geen enkel geval is
B2. Dit verslag is opgesteld door een AI-assistent; de volledige CI is niet afgetekend.

## Werkplek

- Worktree `.claude/worktrees/uren-f2-laden`, branch `claude/uren-f2-laden`, gemaakt op `b17768940`
  (stap 0 gecontroleerd met `git log -1`). Geen PR; de orkestrator merget in `claude/uren-f2-kern`.
- De hoofdrepo heeft geen `node_modules`. `node_modules` is daarom een link naar
  `.claude/worktrees/uren-f2/node_modules` (zelfde `package-lock.json`, met `cmp` gecontroleerd).
- Node 22.23.4 (zoals CI). De typecheck draait met een eigen cachebestand in `/tmp/uren-f2-laden/tsc/`,
  zodat de cache van de F2-worktree niet wordt overschreven (zie "Niet getest en aandachtspunten").
- `CPMSolver.ts`, `CalendarEngine.ts` en `projectDuration.ts` zijn niet aangeraakt.

## De review, deel B

### Punt 1 — een ongewijzigde datum naast een naamwijziging wist nivellering (BLOKKEERT)

**Oorzaak.** `updateTask`, `updateTaskFields` en `patchTaskFields` normaliseerden de taak voor de
no-op-toets (`next`), maar de gevolgregels (`taskTriggerChanges`) en het schrijven gebruikten daarna de
ruwe patch. Een SNET "2026-06-01" was daar een andere waarde dan het opgeslagen "2026-06-01T07:00", dus
`clearLevelingGaps` vuurde.

**Fix.** Eén gedeelde functie `normalizeTaskPatch` (`src/state/migrations/minuteModel.ts:359`) zet de
datums in de patch om naar de momenten uit `next`. Daarna gebruikt elke route alleen die patch:
`taskSlice.ts:1132`, `createMcpTransactions.ts:426` (`updateTaskFields`) en `:551` (`patchTaskFields`).
In `patchTaskFields` volgt `next` nu ook `top.time` (`:548`), zoals het schrijven; geen aanroeper geeft
`top.time` mee, dus voor de tool verandert daar niets.

**Bewijs.** Nieuwe check `tests/planning/check-minute-model-input.ts`, 35/35: via `updateTask` en via
de echte `planner_update_tasks` blijft de pauze staan, het einde blijft 4 juni 16:00, één undo-stap, en
na een IFC-rondgang staat de pauze in het bestand. Controles: een échte nieuwe SNET wist de pauze nog
wel; een gelijke deadline is een no-op. Mutatie (`cp` van `taskSlice.ts` en `createMcpTransactions.ts`
van `b17768940`): 29/35, exit 1, precies het symptoom (pauze weg, einde 3 juni, ook na opslaan).
Hersteld: 35/35, exit 0. De probe van de reviewer (`probe-neutral.ts`) geeft exit 0.

### Punt 2 — de tweede undo wordt door de hook weer doorgerekend (BLOKKEERT)

**Oorzaak.** `useExitRecordedDates` plant een herberekening bij elke overgang "modus aan → uit" binnen
hetzelfde document. Een undo die voorbij de modus gaat (geval 6) is zo'n overgang, maar geen bewerking.

**Fix.** De waarneming draagt de sessiehistorie mee (`useExitRecordedDates.ts:35`). De pure functie
`restoredFromHistory` (`src/state/recordedDatesExit.ts:37`) herkent een historieherstel: alleen undo en
redo wisselen de status van een bestaand event (`historySlice.ts:127`, en de terugdraai van een
bibliotheekverdeling, `librarySlice.ts:1539`). Een bewerking voegt events toe of ruimt undone events op.
`leftRecordedDatesMode` telt een herstel niet als verlaten (`recordedDatesExit.ts:77`).

**Bewijs.**
- Browserspec `tests/browser/recorded-dates.spec.ts`, de bestaande B5-route uitgebreid met geval 6,
  met de echte hooks: herstel met Automatisch berekenen uit, tabblad activeren, naam wijzigen in de
  tabel (F2, typen, Enter), F5, tweemaal Ctrl+Z. Na 300 ms: B op 16 maart, oorspronkelijke naam,
  `minuteModelPending: true`, verouderd, modus uit. Mutatie (`cp` van `recordedDatesExit.ts` en
  `useExitRecordedDates.ts` van `b17768940`): B springt naar 9 maart, vlag uit, exit 1. Hersteld: de
  hele spec 3/3 groen.
- Headless: `check-recorded-dates.ts` 10E-9 t/m 10E-14 (undo, redo, bewerking, opruimen, geen
  historiewijziging), 383/383.
- De hooks-probe van de reviewer, met aangepaste paden in Chromium: 10/10, exit 0.

### Punt 3 — datumloze IFC-actuals worden vóór de normalisatie middernacht (BLOKKEERT)

**Oorzaak.** Op een minutenkalender (`LiteralTimes`, eigen werkblokken, of een urentaak op een
gemarkeerd scalaire kalender) zette `toHour` in `applyHourModeIFC` elk slot om met `formatInstant`; een
datum zonder tijd werd zo 00:00. De normalisatie op de laadgrens laat een moment staan.

**Fix.** `toHour` houdt een datum zonder tijd als datum (`ifcReader.ts:1533`). De normalisatie in
`payloadFromImport` zet hem daarna per veld en kalender om (D1 begin, D2 einde). Nagelopen: Openen,
voorbeeld, MCP-import en de kern (`src/core/index.ts`, via `openAsDocument`) gaan naar
`applyLoadedProject` → `payloadFromImport` (`fileSlice.ts:828`); crashherstel gaat via
`payloadFromInput` (`documentSlice.ts:636`/`:671`). De bibliotheek leest alleen de pool; `devBridge` en
de benchmark tellen alleen. De fix geldt bewust voor elke minutenkalender, niet alleen `LiteralTimes`:
§3.6/T17 en §5.2 regressiegeval 9 zeggen dat een datum zonder tijd een moment wordt.

**Bewijs.** `check-minute-model-ifc.ts` krijgt twee varianten (63/63): een `LiteralTimes`-kalender
(07:00 / 16:00) en een kalender met werkblokken 08:00–17:00 (08:00 / 17:00). Elk: de lezer houdt de
datum, de normalisatie geeft D1/D2, na openen met berekening en na opslaan en heropenen blijft het zo.
Mutatie (`cp` van `ifcReader.ts` van `b17768940`): 55/63, exit 1 (00:00 in beide varianten). Hersteld:
63/63, exit 0. De probe van de reviewer (`probe-literal.ts`) geeft exit 0.

### Punt 4 — één normalisatie per grens (VERVOLG, meegenomen)

- `addTask`: de tweede `normalizeTaskDates` bij `push` is weg (`taskSlice.ts:1051`).
- `fileSlice.ts:897` en `documentSlice.ts:651`: de vastlegging gaat ruw naar `minuteModelTransition`,
  die haar zelf normaliseert (zelfde payload, idempotent). B5 87/87 bevestigt gelijk gedrag.

## Rode CI-gevallen op `b17768940` (run 39973718779): indeling

Eén vraag eerst: is "datum zonder tijd wordt 07:00 of 16:00" de bedoelde normalisatie? Ja. §3.6 (T17):
"elk startachtig en eindachtig taakveld is na het laden en na elke invoer een moment", ook via paneel,
dialoog, raster, MCP en extensies. De regel per veld staat in §4.2: D1 begin, D2 einde, D6 een werkelijk
einde op de statusdag is het einde van die werkdag, D7 een mijlpaal heeft één moment. Het verschil
tussen dag- en urenkalender (T17, `LiteralTimes`/`AtDayEnd`) is een schrijfregel voor IFC; in de store
is elk veld een moment. Alleen waar de uitkomst níét D1/D2/D6/D7 volgt, is het een fout.

| Check | Geval | Oud → nieuw | Indeling en grond |
|---|---|---|---|
| `check-duration-change-routes` (4) | duur = gedane werk ⇒ voltooid, 4 routes | einde 07:00, verwacht 16:00 | **B3.** `carryRemainingThroughDurationEdit` riep `applyProgressInvariants` zonder kalender aan; het einde bleef "2026-06-03" (00:00) en de F1-volgorderegel maakte het gelijk aan de start van 07:00. Fix: kalender mee (`workRuleApply.ts:814`, aanroepers `taskSlice.ts:1198`, `createMcpTransactions.ts:467`/`:588`, `taskEditPlan.ts:195`). Verwachting blijft (D6). |
| `check-task-dialog-save` (1) | 2.100 dialoog = paneel | einde 07:00, verwacht 16:00 | **B3.** Zelfde oorzaak via `draftWithProgress` zonder kalender. Fix: `applyProgressInvariants` vergelijkt een afgeleid einde zonder tijd op dagniveau (`taskMutationRules.ts:166`); de store normaliseert het bij het schrijven. Ook `taskDialogSave.ts:250` geeft nu de kalender mee. Verwachting blijft. |
| `check-task-grid-clipboard` (6) | MSO geplakt als 27-08-2026 | `2026-08-27` → `T07:00` | **B1**, §3.6 invoer + D1. |
| `check-task-grid-editors` (4) | afgeleide werkelijke datums | `2026-01-05` → `T08:00`, `2026-01-07` → `T16:00` | **B1**, §3.6 + D1, D6 (kalender 08:00–16:00). Een niet-bewerkte start uit de fixture blijft zonder tijd; de store normaliseert bij het schrijven. |
| `check-progress-import` (1) | 6f werkelijke start in blad | `2026-01-06` → `T07:00` | **B1**, §3.6 invoer + D1. |
| `check-progress-import-ronde` (3) | C2, C3, C4 | `T07:00` begin, `T16:00` einde | **B1**, §3.6 invoer + D1/D2. Het lezen van het datumformaat blijft getoetst. |
| `check-split-bar-render` (4) | geval 1, twee gaten | segmenten 2 px op x=80 | **B1**, §8 B1 (een maat per taak). `cc1889437` liet de renderer de splitmaat op de maat van de taak kiezen; de fixture was een dagtaak op een urenkalender. De taak krijgt de urenmaat, zoals de jaar-2-case al had; de x-posities blijven gelijk. |
| MCP `cases-auto-actual-start` | dag: opgegeven start blijft | `{as:2026-06-03, af:2026-06-10}` → `{T07:00, T16:00}` | **B1**, §3.6 + D1 en D6 (einde op de statusdag). Het uur-scenario verandert niet. |
| MCP `cases-progress-entry-ai` | taak mét actualStart | `2026-06-08` → `T07:00` | **B1**, §3.6 + D1. |
| MCP `cases-progress-entry-ai` | mijlpaal met werkelijke datum | `2026-06-09` → `T07:00 / T07:00` | **B1**, §4.2 D7: één moment; zonder `milestoneKind` D1. Het paneel doet hetzelfde (`check-progress-entry.ts:270`, "3d mijlpaal", 07:00), en `actualDateSide` (F1) geeft alleen bij `FINISH` het einde. Zie de open vraag hieronder. |

**Open vraag (geen besluit genomen).** Mijlpaal M staat in deze test gepland op 1 juli **16:00**: B6
plaatst een losse mijlpaal in het OPS-profiel aan het einde van de werkdag. Een opgegeven werkelijke
datum zonder tijd wordt volgens D7 **07:00**. Op dagniveau is dat gelijk. D7 noemt voor "zonder soort,
zonder hint" alleen het laden ("oud bestand, ander programma"); voor invoer zegt de spec niets apart.
Wil de eigenaar dat een afgemelde losse mijlpaal ook aan het einde van de dag landt, dan is dat een
specwijziging van D7 voor invoer, voor alle routes tegelijk. Ik heb dat niet beslist.

## Gerichte controles (Node 22.23.4)

| Controle | Uitkomst | Exit |
|---|---|---|
| B5 `check-minute-model-transition.ts` | 87/87 | 0 |
| IFC `check-minute-model-ifc.ts` | 63/63 | 0 |
| Invoer `check-minute-model-input.ts` (nieuw) | 35/35 | 0 |
| Documentcontract `check-document-contract.ts` | 765/765 | 0 |
| IFC-rondgang `check-ifc-roundtrip.ts` | 270/270 | 0 |
| MSPDI `check-mspdi-werktijd-minuten.ts` | 61/61 | 0 |
| XER-rondgang `check-xer-recorded-roundtrip.ts` | 76/76 (lokaal met corpusbestanden; CI telt 70) | 0 |
| Oude lezer `check-minute-model-compat.ts` (v2026.9.0, tag `2bb279d18` → commit `53502be8a`, zelf gebundeld) | 21.613/21.613, 27 bestanden | 0 |
| F1 `check-auto-actual-start.ts` / `check-hours-f1-status.ts` / `check-hours-f1-review.ts` | 135/135, 114/114, 439/439 | 0 |
| `check-recorded-dates.ts` | 383/383 | 0 |
| Overige minutenmodelchecks (`check-minute-model.ts`, grenzen, routes, voorbeelden) | 137, 17/17, 34 aanroepen zonder afwijking, 6.090/6.090 | 0 |
| De zeven rode planningschecks | alle groen | 0 |
| 85 gerichte planningschecks samen (voortgang, actuals, IFC-lezer, minutenmodel, raster, splits, XER-voortgang) | GROEN | 0 |
| MCP-suite `tests/mcp/run.sh` | 65 groen, 0 rood | 0 |
| Browser `recorded-dates.spec.ts` | 3/3 | 0 |
| `npm run typecheck` (eigen cachebestand) / `npm run lint` | geen fouten | 0 / 0 |
| `verify:cycles` / `verify:store-boundaries` / `verify:conventions` | 823 modules zonder cyclus; grenzen en conventies OK | 0 |

Logs, probes en mutatiebestanden: `/tmp/uren-f2-laden/` (onder meer `gericht-1.log`,
`mcp-suite-1.log`, `browser-3.log`, `mut-punt1-*.log`, `mut-punt2-basis.log`, `mut-punt3-*.log`,
`compat-1.log`, `probe-hooks.log`).

## Niet getest en aandachtspunten

- Niet gedraaid: de volledige planningssuite en de tijdzone-matrix, `npm run verify`, de volledige
  browsersuite (alleen `recorded-dates.spec.ts`), de bibliotheek- en dev-serversuites,
  `measure:profiles`, de `cases-*.json`-batterijen, Tauri.
- De motorfix in `claude/uren-f2-kern` loopt tegelijk. Na de merge moeten de checks hierboven opnieuw
  groen zijn; botsingen verwacht ik niet (andere bestanden).
- `node_modules` is gedeeld met de F2-worktree. Vite gebruikt standaard `node_modules/.vite`; mijn
  browserrun gebruikte dus dezelfde cachemap. Zelfde `package-lock.json` en configuratie, dus dezelfde
  voorgebundelde modules. De eerste twee typecheckruns schreven nog in `node_modules/.cache/ops-tsc`;
  daarna een eigen cachebestand. Gevolg hoogstens een volledige herbouw bij de andere agent.

## Bijvondsten (geen knownbugs-nummer gegeven)

1. **BEVESTIGD, VERVOLG.** `updateExternalLink` (`taskSlice.ts`, `sameExternalLink`) vergelijkt het
   ruwe anker. Hetzelfde anker opnieuw als datum zonder tijd geeft een extra undo-stap (3 → 4) en zet de
   planning op verouderd, terwijl het opgeslagen moment gelijk blijft. Probe:
   `/tmp/uren-f2-laden/probe-extlink.ts`.
2. **BEVESTIGD (renderer), VERMOED (motor).** Een dagtaak met gaten korter dan een dag: de renderer
   rondt de gaten af op hele dagen (`computeSplitSegments`, `splitWalk.ts:104`,
   `Math.round(minutes / minutesPerDay)`), dus de balk krijgt stompjes van 2 px. De motor telt dezelfde gaten via `splitTotalSpanDays` met een breuk. F3-gebied (§3.14).
3. **BEVESTIGD, tekst.** De kop van `check-task-dialog-save.ts` zegt dat de dialoog `draftWith*`
   gebruikt; `TaskDialog.tsx` gebruikt `planProgressEntry` met de kalender.
4. **Voorstel voor de brief.** De brief noemt `/home/aia09/projects/open-planner-studio/node_modules`
   als linkdoel; die map bestaat niet op deze machine.
