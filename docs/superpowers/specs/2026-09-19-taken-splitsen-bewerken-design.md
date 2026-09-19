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

- `toSplitPieces(gaps, totalWorkMinutes)` → stukkenlijst. Past dezelfde defensieve guards toe als
  `splitWalk` (niet-eindig/≤0 overslaan, as klemmen, overlappende gaten samenvoegen, niets voorbij
  het taakeinde).
- `fromSplitPieces(pieces)` → `{ gaps, totalWorkMinutes }`, met de H1-as correct opgebouwd.
- **Round-trip-eis:** `fromSplitPieces(toSplitPieces(g, w))` is voor elke wélgevormde invoer
  identiek aan `g` (inclusief `source`), zodat alleen-kijken nooit data wijzigt.
- Bewerkingen, elk `pieces → pieces`:
  - `splitAt(pieces, workOffsetMinutes, gapMinutes)` — positie op de WERK-as (zonder pauzes).
  - `setGapLength(pieces, gapIndex, minutes)` — `0` ⇒ samenvoegen met buren.
  - `setWorkLength(pieces, workIndex, minutes)` — verandert de totale duur.
  - `removeGap(pieces, gapIndex)` / `removeAllGaps(pieces)`.
- **Eenheid/snap:** elke bewerking krijgt een `unitMinutes` (dag-modus: `hoursPerDay × 60`; uur-modus:
  de bestaande sleepsnap). Lengtes worden op veelvouden daarvan afgerond; een werkstuk is minimaal
  één eenheid; splitsen kan niet op positie 0 of op/voorbij het eind. Een ongeldige bewerking geeft
  de invoer ongewijzigd terug (geen throw) plus een reden voor de aanroeper.
- Een bewerkt gat verliest `source: 'leveling'`; onaangeraakte gaten houden hun `source`.
- `canSplitTask(task)` — één predicaat: bladtaak, geen mijlpaal, geen verzameltaak, geen hammock,
  geen `ELAPSEDTIME`, duur ≥ 2 eenheden.

Schermpositie ↔ werk-as-offset komt uit `splitWalk.computeSplitSegments` (datum → in welk stuk val
ik, hoeveel werk ligt ervoor); die vertaling krijgt één hulpfunctie in `splitEdit.ts`
(`workOffsetAtDate`) zodat Gantt en paneel (van–tot-datums) dezelfde bron gebruiken.

### 2. Store-actie — `taskSlice.setTaskSplits(taskId, pieces, opts?)`

- Loopt via `transaction.ts`: undo-snapshot (met `coalesceKey` voor een sleepgebaar), redo leeg,
  `isDirty`, en **`markScheduleStale`** — een split verschuift het taakeinde en dus opvolgers
  (anders dan `setAssignmentContour`).
- Schrijft `task.splitGaps` (leeg ⇒ `undefined`) en, als de totale werkduur wijzigde, de duur via
  hetzelfde pad als `updateTask` (incl. `rescaleTaskContours`, `mspTaskType`-regels). Let op de
  volgorde: `rescaleTaskContours` herschaalt óók `splitGaps`; de actie schrijft de nieuwe gaten
  daarom ná het herschalen, zodat ze niet dubbel geschaald worden.
- Weigert (no-op + reden) als `canSplitTask` faalt.
- Roept `notifyTimephasedLoss` aan wanneer de taak MSP-timephased-sturing had.
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
    pauze"); loslaten zonder slepen = 1 eenheid. Eén undo-stap. Modus blijft aan.
- **Buiten de modus** (uitbreiding van `useBarDrag`/hit-testing):
  - De renderer levert per gesplitste balk de stuk-rechthoeken aan de hit-test (uit dezelfde
    `computeSplitSegments`-uitkomst die hij tekent).
  - Body van stuk 0 ⇒ hele taak verplaatsen (bestaand). Body van stuk i>0 ⇒ `setGapLength` van de
    pauze ervoor; tegen het vorige stuk ⇒ samenvoegen.
  - Rechterrand van stuk i ⇒ `setWorkLength(i)`; de rechterrand van het laatste stuk blijft het
    bestaande duur-slepen (zelfde uitkomst). Linkerrand van stuk 0 = bestaand gedrag; linkerranden
    van latere stukken hebben geen eigen grijpzone.
  - Voorvertoning tijdens het slepen via de bestaande preview-route; commit bij loslaten.
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

- **Voortgang:** een pauze mag niet vóór het reeds voltooide deel komen te liggen als de taak
  actuals heeft: splitsen en bewerken is begrensd tot het resterende deel (positie ≥ voltooid werk).
- **Dag-modus-afronding:** geïmporteerde gaten < ½ werkdag zijn in dag-modus onzichtbaar; het paneel
  toont ze wél (in uren) zodat ze niet stil verdwijnen bij een bewerking van een ánder gat.
- **Duur < 2 eenheden:** niet splitsbaar.
- **Undo tijdens modus:** Ctrl+Z werkt normaal; de modus blijft aan.
- **Datums zoals opgeslagen (#63):** `markScheduleStale` regelt de modusinteractie; nooit de vlag
  rechtstreeks zetten.
- **Niet-actieve documenten / batch:** de actie werkt op de meegegeven documentcontext.

## Tests

- `tests/planning/check-split-edit.ts`: round-trip-identiteit over alle splits in het
  `.mpp`-fidelity-corpus + handgemaakte H1-gevallen; elke bewerking; snap; guards; `source`-gedrag.
- `check-split-edit-store.ts`: undo/redo, `isDirty`, `scheduleStale`, contour-herschaling zonder
  dubbele schaling, timephased-melding, weigeren op niet-splitsbare taken.
- IFC-round-trip van een zelfgemaakte split (bestaande round-trip-batterij uitbreiden).
- `tests/mcp/`: tool-case (+ batch, read-only, registry-vangnet).
- `tests/browser/task-split.spec.ts`: echte muis — modus aan, klik-sleep, stuk verslepen, dichtslepen,
  rand slepen, contextmenu, paneelregel bewerken; asserties via `window.__OPS__`.
- `GOAL_ZERO_DEVIATIONS` blijft groen (de engine raakt geen importdatum zonder bewerking).

## Bouwvolgorde en kijkmomenten

1. `splitEdit.ts` + store-actie + headless tests.
2. Splits-modus in de Gantt → **kijkmoment 1**.
3. Stukken/randen slepen + contextmenu → **kijkmoment 2**.
4. Paneelsectie → **kijkmoment 3**.
5. MCP-tool, i18n, gids, browsertest, `npm run verify`, PR (nooit rechtstreeks naar main).

## Buiten scope

Handmatig plannen (`manuallyScheduled`) als bewerkfunctie; optie B van de nivelleerder; split-view;
een `.mpp`-schrijfpad.
