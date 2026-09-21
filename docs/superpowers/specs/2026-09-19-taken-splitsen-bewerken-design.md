# Taken splitsen als bewerkfunctie — ontwerp

Datum: 2026-09-19 · Aanleiding: issue #146 (gfayat, "tâche fractionnée - Split Task") ·
Sluit de open TODO-regel "Splitsen/handmatig plannen als bewerkfunctie (UI)" (plan §1.4/O2).

## In gewone taal

Een gesplitste taak — werk, een pauze, weer werk — kan de app al lezen (MS Project, P6), doorrekenen,
tekenen en bewaren. Wat ontbreekt is zélf zo'n pauze maken en bijstellen. Dit ontwerp voegt dat toe
op drie plekken: met de muis in de Gantt, als tabel in het eigenschappenpaneel, en via de
AI-assistent. Eén rekenonderdeel doet voor alle drie het werk, zodat ze nooit iets anders zeggen.

## Besluiten van de eigenaar (2026-09-19)

1. Ingang = **splits-modus** (knop in het lint, klik op de balk, sleep voor de pauzelengte) — zoals
   MS Project.
2. Bewerkniveau 3: splitsen, stukken verslepen (pauze langer/korter, dichtslepen = samenvoegen) én
   stukken langer/korter maken.
3. De rechterrand van een stuk slepen **verandert de taakduur** (MSP-gedrag), het verdeelt het werk
   niet over de andere stukken.
4. Alle drie de oppervlakken in deze etappe: Gantt + paneeltabel + MCP-tool.
5. Aanpak A: één puur bewerkmodel; geen oppervlak rekent zelf op `afterMinutes`/`gapMinutes`.
6. Geen mockups vooraf: prototypen in de app, met een kijkmoment na elke zichtbare stap.

## Verwerkte critreview (2026-09-21, Opus — oordeel was NEE)

De review toonde aan dat de eerste versie op drie punten iets beloofde wat de code niet nakomt. De
besluiten hieronder zijn daarop genomen; de secties verderop zijn ermee in lijn gebracht.

| # | Bevinding (geverifieerd in de code) | Besluit |
|---|---|---|
| 1 | Op een importtaak met Z8-sturing overschrijft `timephasedFinish` de duur-gebaseerde finish (`CPMSolver.ts` ~1969): een gatbewerking zou de datums niet raken. | Een splitbewerking IS een tijdbasis-bewerking: `clearTimephasedWindow` + (bij bevroren werk) `clearTimephasedDurationWalks` + `notifyTimephasedLoss`, óók zonder duurwijziging. Gepinde case: EF beweegt daarna mee. |
| 2a | Dag-taak op een kalender met werktijdbanden (`addDurationChecked`, `eng.isHourMode`-tak) negeert `splitGaps`. | Solver-fix: die tak (en zijn spiegel in `subDuration`) gebruikt `splitTotalSpanDays`. Zonder gaten byte-identiek; eigen regressiecase. |
| 2b | `manuallyScheduled` slaat de solver over. | `canSplitTask` weigert `manuallyScheduled`. |
| 3 | Het stukkenmodel kan niet elke bestaande gatenlijst dragen (gat voorbij het werktotaal, overlap): stille normalisatie vernietigt data. | "Wélgevormd" hard gedefinieerd; niet-wélgevormde lijsten zijn **alleen-lezen** in deze etappe (zie §1). |
| 4 | Het `.mpp`-corpus staat niet in de repo; een test daarop is geen poort. | Round-trip-batterij op gecommitte fixtures; corpus hooguit als extra. |
| 5 | MSPDI/P6-writers schrijven een split zonder contour niet (alleen `console.warn`). | Verlies via de bestaande export-guard/K8a-melding zichtbaar maken; native schrijven van een contourloze split is een benoemde vervolgstap (TODO). |
| 6/7 | `updateTask` wist nivelleergaten en `rescaleSplitGaps` schaalt fractioneel; er is geen herkomst voor gebruikersgaten en `ifcPsets.ts` gooit onbekende `source` weg. | Nieuwe `source: 'user'` (type, IFC-lezer, taakgrid). `setTaskSplits` is een EIGEN smalle mutatie, niet via `updateTask`. Adoptieregel: zie §2. `rescaleSplitGaps` snapt `'user'`-gaten op de eenheid. |
| 8 | De nivelleerder legt scatter-gaten blind over bestaande gaten. | De nivelleerder knipt een taak met niet-`'leveling'`-gaten niet op (alleen als geheel uitstellen). |
| 9/10 | "coalesceKey" én "commit bij loslaten" spreken elkaar tegen; met een stale planning eet een pauze het werk op binnen de oude balkextent. | Per-mousemove-commit met `coalesceKey`, zoals `useBarDrag`. `setTaskSplits` schrijft ook de eigen `scheduleFinish` (start ⊕ `splitTotalSpan`), zodat de balk meteen meegroeit; opvolgers wachten op F5/auto-calc, zoals bij elke duurwijziging. |
| 11 | `verify:docs` telt de `planner_*`-tools tegen CLAUDE.md (nu 40). | CLAUDE.md naar 41 in dezelfde commit als de tool. |
| 12 | `verify-gantt-boundaries.mjs` kent het nieuwe gebaar niet. | `startSplitGesture` in `gestureStarts`; het gebaar start via `useGanttPointerCoordinator`. |
| 13 | Een gatbewerking her-mapt stil de contour-dagslots. | Contour verhuist mee: dagslots lezen met de OUDE gaten, terugschrijven met de NIEUWE (`contourDaySlots` → `buildEditedContourPeriods`); werk per werkdag blijft gelijk. |
| 14 | Scherm↔datum moet dezelfde as gebruiken als `useBarDrag`. | `viewport.sharedAxis` + `barDragMath`/`hourBarDragMath`; geen eigen datumconversie. |
| 15 | "Voltooid werk" had geen formule. | Ergonomiegrens, geen rekeneis: voltooid werk = totaal − resterend (`remainingMinutes`/`remainingTime`, zoals `CPMSolver` ~1878); zonder die velden `completion × totaal`. |
| 16 | Snap-regel dubbelzinnig. | Alleen het BEWERKTE stuk wordt gesnapt; de rest gaat ongewijzigd terug. |
| 17/18 | Stuk-rechthoeken zijn nieuw rendereroppervlak; losse eindjes. | Benoemd als werk; docblok `getTaskBarBounds` en `resetDocumentScopedUI` bijwerken; `splitEdit.ts` blijft in `engine/scheduler/` naast `splitWalk.ts` (zelfde as, zelfde guards). |

## Uitgangspunt in de code

- Opslagvorm: `Task.splitGaps: TaskSplitGap[]` (`src/types/task.ts`) — `afterMinutes`/`gapMinutes`
  in werkminuten op MSP's cumulatieve elapsedWork-as. **H1-valkuil:** de as telt eerdere gaten mee;
  de aspositie ná gat n is `afterMinutes + gapMinutes` (`src/engine/scheduler/splitWalk.ts`).
- `splitWalk.ts` is de ene bron voor "welke dagen werkt een gesplitste taak" (renderer, print,
  lastlezer, nivelleerder). Dag-modus rondt op hele werkdagen, uur-modus loopt op minuten.
- `splitGaps` round-tript al door IFC (`ifcPsets.ts`), MSPDI en P6-XML, en `CPMSolver` rekent ermee.
- Een gat kan `source: 'leveling'` dragen (door de nivelleerder ingevoegd; `clearLevelingGaps`).
- `rescaleTaskContours` (`src/utils/taskDefaults.ts`) herschaalt contour én importsplits bij een
  duurwijziging.
- MCP: `taskFields.ts` weigert `splitGaps` nu expliciet; `readTools.ts` geeft de rauwe gaten terug.
- Balkslepen: `src/components/canvas/hooks/useBarDrag.ts` (+ `barDragMath.ts`,
  `hourBarDragMath.ts`); grenzen bewaakt door `npm run verify:gantt-boundaries`.

## Architectuur

### 1. Bewerkmodel — `src/engine/scheduler/splitEdit.ts` (puur, nieuw)

Werkt in **stukken**: een afwisselende lijst `[werk, pauze, werk, …]`, elk met een lengte in
werkminuten. Begint en eindigt altijd met werk.

- **Wélgevormd** is een gatenlijst die: eindige getallen heeft, `gapMinutes > 0`, oplopend gesorteerd
  is zonder overlap (`after[i+1] ≥ after[i] + gap[i]`), en waarvan het werk vóór elk gat
  (`after[i] − Σ eerdere gaten`) `> 0` en `< totalWorkMinutes` is.
- `isEditableSplit(gaps, totalWorkMinutes)` — niet wélgevormd ⇒ de taak is voor splits
  **alleen-lezen**: geen sleepgrepen, paneelregels niet bewerkbaar, MCP weigert, met één gekleurd
  blok/reden "deze onderbrekingen komen uit het bronbestand in een vorm die hier niet bewerkt kan
  worden". Alleen "Alle onderbrekingen opheffen" blijft mogelijk (expliciete, herkenbare undo-stap).
  Er wordt dus NOOIT stil genormaliseerd.
- `toSplitPieces(gaps, totalWorkMinutes)` → stukkenlijst (alleen voor wélgevormde invoer).
- `fromSplitPieces(pieces)` → `{ gaps, totalWorkMinutes }`, met de H1-as correct opgebouwd.
- **Round-trip-eis:** op wélgevormde invoer is `fromSplitPieces(toSplitPieces(g, w))` identiek aan
  `g` (inclusief `source` en sub-dag-gaten), zodat alleen-kijken nooit data wijzigt.
- Bewerkingen, elk `pieces → pieces`:
  - `splitAt(pieces, workOffsetMinutes, gapMinutes)` — positie op de WERK-as (zonder pauzes).
  - `setGapLength(pieces, gapIndex, minutes)` — `0` ⇒ samenvoegen met buren.
  - `setWorkLength(pieces, workIndex, minutes)` — verandert de totale duur.
  - `removeGap(pieces, gapIndex)` / `removeAllGaps(pieces)`.
- **Eenheid/snap:** elke bewerking krijgt een `unitMinutes` (dag-modus: `hoursPerDay × 60`; uur-modus:
  de bestaande sleepsnap). Alleen de lengte/positie van het BEWERKTE stuk wordt op een veelvoud
  daarvan afgerond — alle andere stukken gaan ongewijzigd terug; een werkstuk is minimaal
  één eenheid; splitsen kan niet op positie 0 of op/voorbij het eind. Een ongeldige bewerking geeft
  de invoer ongewijzigd terug (geen throw) plus een reden voor de aanroeper.
- Herkomst: een bewerkt of nieuw gat krijgt `source: 'user'`; een onaangeraakt importgat blijft
  zonder `source`. Nivelleergaten: zie de adoptieregel in §2.
- `canSplitTask(task)` — één predicaat mét reden: bladtaak, geen mijlpaal, geen verzameltaak, geen
  hammock, geen `ELAPSEDTIME`, niet `manuallyScheduled`, duur ≥ 2 eenheden.

Datum ↔ werk-as-offset krijgt één hulpfunctie in `splitEdit.ts` (`workOffsetAtDate`, op de
kalender-engine en de stukkenlijst — `computeSplitSegments` levert alleen datumparen en volstaat
daarvoor niet), zodat Gantt en paneel (van–tot-datums) dezelfde bron gebruiken. Pixel ↔ datum is
NIET van deze module: dat loopt via `viewport.sharedAxis` en `barDragMath`/`hourBarDragMath`, exact
zoals `useBarDrag` (werkdagencompressie, uur-snap).

**Solver-fix (bevinding 2a):** `CPMSolver.addDurationChecked`/`subDuration` — de tak "dag-taak op
een kalender met banden" rekent met `splitTotalSpanDays(task, eng)` in plaats van de kale
`scheduleDuration`. Zonder gaten byte-identiek.

### 2. Store-actie — `taskSlice.setTaskSplits(taskId, pieces, opts?)`

Een EIGEN smalle mutatie — niet via `updateTask` (dat wist nivelleergaten en herschaalt gaten
fractioneel). Volgorde binnen één `set`:

1. Weiger (no-op + reden) als `canSplitTask` of `isEditableSplit` faalt.
2. Undo-snapshot (met `coalesceKey` per sleepgebaar, per-mousemove-commits zoals `useBarDrag`),
   redo leeg, `isDirty`.
3. Contour meeverhuizen: dagslots lezen met de OUDE gaten/duur; bij een duurwijziging eerst de
   contour herschalen (alleen de contour, niet de gaten — `rescaleTaskContours` wordt daarvoor
   opgesplitst of krijgt een vlag); daarna terugschrijven met de NIEUWE gaten
   (`buildEditedContourPeriods`). `mspTaskType === 'FIXED_WORK'` houdt het werk vast, zoals nu.
4. Schrijf `splitGaps` (leeg ⇒ `undefined`) en zo nodig de duur (`scheduleDuration` of
   `durationMinutes`, naar de eenheid van de taak).
5. **Adoptieregel:** na een gebruikersbewerking zijn álle resterende `'leveling'`-gaten van díé taak
   `'user'` geworden. Reden: wat de gebruiker op het scherm ziet staan blijft staan; "Nivellering
   wissen" haalt dan niets meer weg van een taak die hij zelf heeft ingedeeld, en er ontstaat geen
   mengvorm die `clearLevelingGaps` half opruimt. Importgaten zonder `source` blijven zo.
6. Tijdbasis-gevolgen: `clearTimephasedWindow`, en bij bevroren werk
   `clearTimephasedDurationWalks`; verloren sturing ⇒ `notifyTimephasedLoss` (na de `set`).
7. Eigen `scheduleFinish` bijwerken (start ⊕ `splitTotalSpan`), zodat de balk direct klopt.
8. `markScheduleStale` via `finishMutation({ stale: true })` — opvolgers schuiven bij F5/auto-calc.

Latere duurwijzigingen via `updateTask`: `rescaleSplitGaps` snapt `'user'`-gaten op de eenheid
(dag-modus: hele werkdagen), zodat een gebruikersgat niet naar een andere dag of naar 0 rondt.

**Nivelleerder:** `ResourceLeveler` knipt een taak met minstens één niet-`'leveling'`-gat niet op
(alleen uitstellen als geheel) — de scatter-as kent bestaande gaten niet.
- Core-runtime: dezelfde logica beschikbaar voor `createMcpTransactions` zonder `useAppStore`-import
  (`verify:store-boundaries`).

### 3. Gantt-interactie

- **Splits-modus:** sessie-state `ui.ganttSplitMode: boolean` (niet persistent; uit bij
  documentwissel via `resetDocumentScopedUI`, en bij Esc). Knop **Taak splitsen** in de taakgroepen
  van Start, Planning en Tabel (`ribbonConfig.tsx`), toggle-stijl, uitgeschakeld zonder Gantt.
- Nieuwe hook `src/components/canvas/hooks/useSplitGesture.ts` naast `useBarDrag`; de centrale
  mousedown-hittest kiest: modus aan ⇒ split-gebaar, anders bestaande paden.
  - Hover: verticale geleidelijn op de gesnapte dag + label met de datum; niet-splitsbare balk ⇒
    `not-allowed`-cursor.
  - Mousedown op een stuk = pauzebegin; slepen naar rechts = pauzelengte (label "n werkdagen
    pauze"); loslaten zonder slepen = 1 eenheid. Eén undo-stap (coalesce). Modus blijft aan.
  - Het gebaar start via `useGanttPointerCoordinator`; `startSplitGesture` komt in `gestureStarts`
    van `scripts/verify-gantt-boundaries.mjs`.
- **Buiten de modus** (uitbreiding van `useBarDrag`/hit-testing):
  - NIEUW rendereroppervlak: `GanttRenderer` bewaart per getekende gesplitste balk de
    stuk-rechthoeken en biedt ze aan de hit-test aan (`getTaskBarBounds` blijft de volle extent; het
    docblok daar dat per-segment-slepen "een latere etappe" noemt wordt bijgewerkt).
  - Body van stuk 0 ⇒ hele taak verplaatsen (bestaand). Body van stuk i>0 ⇒ `setGapLength` van de
    pauze ervoor; tegen het vorige stuk ⇒ samenvoegen.
  - Rechterrand van stuk i ⇒ `setWorkLength(i)`; de rechterrand van het laatste stuk blijft het
    bestaande duur-slepen (zelfde uitkomst). Linkerrand van stuk 0 = bestaand gedrag; linkerranden
    van latere stukken hebben geen eigen grijpzone.
  - Per-mousemove-commit met één `coalesceKey` per gebaar (= één undo-stap), zoals `useBarDrag`;
    een sleeplabel toont wat er verandert. Geen aparte preview-route.
- **Contextmenu** op een gesplitste balk: "Onderbreking opheffen" (de pauze onder/naast de cursor)
  en "Alle onderbrekingen opheffen".
- Tekenen verandert niet: O5 blijft gelden (een echte split tekent altijd gesplitst).

### 4. Eigenschappenpaneel — sectie "Onderbrekingen"

`src/components/panels/TaskSplitsSection.tsx` in `TaskPropertiesPanel`, alleen bij
`canSplitTask(task) || task.splitGaps?.length`.

- Eén regel per pauze: *na n werkdagen* (invoer) · *n werkdagen pauze* (invoer) · van–tot (alleen-
  lezen, uit `splitWalk`) · verwijderknop. Urentaak ⇒ uren. Onderaan "Onderbreking toevoegen"
  (standaard: halverwege het langste werkstuk, 1 eenheid).
- "na n" is de positie op de WERK-as (dagen werk vóór de pauze), niet de H1-as.
- Kenmerk *nivellering* bij `source: 'leveling'`.
- Geen losse bijschriften; een mededeling (bv. herkomst MS Project) alleen als gekleurd blok.
- Tekstgroottes via de zes rollen.

### 5. MCP — `planner_set_task_splits`

- Invoer: `taskId` + `pieces`-achtige agentvorm: `interruptions: [{ afterWorkDays|afterWorkHours,
  pauseDays|pauseHours }]` (werk-as, leesbaar), lege lijst = alles opheffen. Geen rauwe
  `afterMinutes`.
- Contract in `contracts.ts`, schema, registratie in `toolRegistry.ts`; werkt binnen `planner_batch`;
  respecteert `aiReadOnly`/`aiPaused`/drift-anker; ná de mutatie geldt de bestaande stale-regel.
- `taskFields.ts`: de weigertekst voor `splitGaps` verwijst naar de nieuwe tool in plaats van "niet
  zetbaar". `readTools.ts` geeft naast de rauwe `splitGaps` de leesbare `interruptions`-vorm.
- `goed-plannen`-skill: korte regel wanneer splitsen vs. losse taken.

### 6. i18n, docs

- Sleutels in `task.json`/`menu.json` voor alle 14 locales; aantallen ("n werkdagen pauze") als
  echte pluralfamilies met de juiste CLDR-categorieën.
- Nieuwe gids `gids-taken-splitsen.md` (nl+en) + manifest-entry; verwijzing vanuit
  `gids-msproject-import.md`. TODO-regel afvinken; CLAUDE.md-alinea bij *Rendering*/*State*.

## Randgevallen

- **Voortgang:** ergonomiegrens (geen rekeneis — een gat vóór het voltooide deel heft zichzelf op in
  de solver): splitsen en bewerken is begrensd tot het resterende deel. Voltooid werk = totaal −
  resterend (`remainingMinutes`/`remainingTime`); zonder die velden `completion × totaal`.
- **Export naar MS Project/P6:** een split op een taak zonder urenverdeling gaat daar nu verloren;
  de export meldt dat via de export-guard/K8a-melding (aantal taken), niet alleen in de console.
- **Dag-modus-afronding:** geïmporteerde gaten < ½ werkdag zijn in dag-modus onzichtbaar; het paneel
  toont ze wél (in uren) zodat ze niet stil verdwijnen bij een bewerking van een ánder gat.
- **Duur < 2 eenheden:** niet splitsbaar.
- **Undo tijdens modus:** Ctrl+Z werkt normaal; de modus blijft aan.
- **Datums zoals opgeslagen (#63):** `markScheduleStale` regelt de modusinteractie; nooit de vlag
  rechtstreeks zetten.
- **Niet-actieve documenten / batch:** de actie werkt op de meegegeven documentcontext.

## Tests

- `tests/planning/check-split-edit.ts`, op GECOMMITTE fixtures (het corpus staat niet in de repo en
  is geen poort): netjes, met `source`, sub-dag-gat, overlap, gat voorbij het werktotaal —
  round-trip-identiteit op de wélgevormde, `isEditableSplit === false` op de rest; elke bewerking;
  snap alleen op het bewerkte stuk; `source`-gedrag. Corpus-doorloop optioneel als extra.
- `check-split-edit-store.ts`: undo/redo + coalescing, `isDirty`, `scheduleStale`, adoptieregel,
  contour meeverhuisd (werk per werkdag gelijk, geen dubbele schaling), Z8-venster losgelaten +
  melding en **EF beweegt mee na solve**, eigen `scheduleFinish` bijgewerkt, weigeren
  (`canSplitTask`/`isEditableSplit`).
- CPM-case: dag-taak met split op een kalender met banden (solver-fix) + spiegel in de backward pass.
- Nivelleerder: taak met gebruikersgat wordt niet opgeknipt.
- IFC-round-trip van een zelfgemaakte split incl. `source: 'user'`; export-guard-melding MSPDI/P6.
- `tests/mcp/`: tool-case (+ batch, read-only, registry-vangnet).
- `tests/browser/task-split.spec.ts`: echte muis — modus aan, klik-sleep, stuk verslepen, dichtslepen,
  rand slepen, contextmenu, paneelregel bewerken; asserties via `window.__OPS__`.
- `GOAL_ZERO_DEVIATIONS` blijft groen (de engine raakt geen importdatum zonder bewerking).

## Bouwvolgorde en kijkmomenten

1. `splitEdit.ts` + store-actie + headless tests.
2. Splits-modus in de Gantt → **kijkmoment 1**.
3. Stukken/randen slepen + contextmenu → **kijkmoment 2**.
4. Paneelsectie → **kijkmoment 3**.
5. MCP-tool (+ CLAUDE.md-toolaantal 40 → 41), i18n, gids, browsertest, `npm run verify`, PR (nooit
   rechtstreeks naar main).

## Buiten scope

Handmatig plannen (`manuallyScheduled`) als bewerkfunctie; optie B van de nivelleerder; split-view;
een `.mpp`-schrijfpad; native MSPDI/P6-schrijven van een split zonder urenverdeling (TODO-regel);
bewerken van niet-wélgevormde importsplits; de nivelleerder gaten-bewust laten opknippen.

## Niet gecontroleerd door de review

Print/PDF, rapporten, baselines/variance en verzameltaak-rollup bij een gebruikerssplit zijn niet
nagelopen (ze lezen `splitWalk`/de solver-uitkomst en veranderen niet door deze etappe, maar dat is
een aanname). Het plan neemt één rooktest per oppervlak op in de browsertest/planningssuite.
