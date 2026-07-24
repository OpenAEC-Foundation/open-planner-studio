# Ontwerp: Verticaal slepen van taakbalken in de Gantt (reparenting + herordenen)

*Datum: 2026-07-24 · Status: **ontwerp** (nog niet geïmplementeerd) · Bron: GitHub-issue #21 punt 1, optie 1 (door de issuemaker gekozen)*

> Dit is een **ontwerpdocument**, geen implementatie. Alle feiten hieronder zijn
> ter plaatse geverifieerd tegen de huidige code (worktree `issue-21-verbeterpunten`,
> main-stand 9e7c4a2). Waar de oorspronkelijke verkenning-feiten afweken van de
> werkelijke code, staat dat expliciet in §2. Het document eindigt met open
> productvragen (§8) die een besluit van de producteigenaar vergen.

## 0. Doel en harde eisen

Een taakbalk in de Gantt verticaal verslepen naar **elke plek in de lijst**,
**ook onder een andere summary-taak** (reparenting). Tijdens het slepen een
visuele invoeg-indicator; de echte mutatie pas bij **mouseup**. **Eén undo-stap.**
**Datums veranderen niet** door verticaal slepen (pure structuurwijziging).

Niet-doel (v1): multi-selectie-blok-slepen, TableEditor-reordering, touch/pen.

## 1. Waar het op aansluit (bestaande mechaniek)

- **Horizontaal balk-slepen** bestaat: `src/components/canvas/hooks/useBarDrag.ts`.
  Leest uitsluitend `e.clientX` (regel 135), muteert **live per mousemove** via
  `updateTask` met undo-coalescing `bardrag:<id>:<seq>` (regel 52). Mouseup doet
  alleen `setDragState(null)` (regel 202-204) — géén `finishMutation`. De hook
  communiceert uitsluitend via de store; de renderer tekent gewoon de
  reeds-gemuteerde taak.
- **Store-acties voor structuur** in `src/state/slices/taskSlice.ts`:
  `moveTask(id, newParentId)` (:300), `reorderSibling(id,'up'|'down')` (:484),
  `indentTasks`/`outdentTasks` (:341/:392), `addTask` met `position.anchor` (:117,
  synchronisatie-stuk op :175-197).
- **Undo-ritueel** leeft in `src/state/transaction.ts` (`beginUndoable`/`finishMutation`),
  **niet** in `historySlice.ts` (correctie op de brief — zie §2).
- **Rijen**: `src/engine/view/visibleRows.ts` produceert `ViewRow[]`;
  `src/engine/renderer/GanttRenderer.ts` levert `getRowAtY`/`getTaskAtY`/`getRowIndex`
  (:1377-1391) en `getTaskBarBounds` (:1436).
- **Overlay-patroon**: de box-select-rechthoek in `src/components/canvas/GanttCanvas.tsx`
  (:1078-1105) — een absoluut-gepositioneerde `<div>` in de `containerRef`-wrapper,
  `pointerEvents:'none'`, themakleur via `var(--theme-accent)`.
- **Event-wiring**: `handleMouseDown` (:857-944) is de dispatch; modifiers worden
  vóór alles gelezen (`shift`→dependency, `ctrl/meta`→no-op-slot, verder niks).

## 2. Geverifieerde feitenbasis — incl. correcties op de brief

Tijdens het ontwerp zijn de aangeleverde feiten machineel en door lees-subagents
nagegaan. Correcties/aanvullingen:

1. **`beginUndoable`/`finishMutation` staan in `src/state/transaction.ts`**, niet in
   `historySlice.ts`. `historySlice.ts` bevat alleen `undo`/`redo`/`stacks`.
   `finishMutation(s, {stale})` zet altijd `isDirty=true` en alleen bij
   `stale===true` ook `scheduleStale=true`.
2. **`addTask`-position-sync staat op `taskSlice.ts:175-197`**, niet "168-195".
3. **De "twee bronnen van waarheid" zijn reëeler dan de brief suggereerde — en het
   WBS-ontwerpdoc (2026-07-02) is deels verouderd.** Geverifieerd in
   `visibleRows.ts:102-104` (`sortTasks` retourneert de array ongewijzigd als
   `sort` leeg is) én `:242`/`:245`:
   - **Root-weergavevolgorde** = rauwe `s.tasks`-arrayvolgorde (`:245`).
   - **Kind-weergavevolgorde** = `parent.childIds`-volgorde (`:242`).
   - **WBS-codes / `flattenOrder` / IFC-writer** = rauwe `s.tasks`-arrayvolgorde
     (`src/utils/wbs.ts:8`: *"childIds-volgorde wordt door de renderers genegeerd"*).
   Het WBS-ontwerpdoc stelt nog *"alle renderers gebruiken de array-positie"* —
   dat klopt voor `flattenOrder`, maar `visibleRows` gebruikt intussen `childIds`
   voor non-root kinderen. **Gevolg:** `moveTask`, `indentTasks`, `outdentTasks` en
   `reorderSibling`-non-root muteren alleen `childIds` en laten de rauwe array
   onaangeroerd → display klopt, maar de WBS-code kan op een andere positie wijzen
   dan de getoonde volgorde (latent risico). Alleen `addTask`-position schrijft
   beide bronnen. **Onze nieuwe actie zal beide bronnen expliciet schrijven** en is
   daarmee consistentie-correcter dan de bestaande structuur-acties (§4).
4. **`ViewRow` heeft géén `y`, `height` of `parent`-veld.** Posities worden in de
   renderer afgeleid uit de rij-index: `rowToY(i) = HEADER_HEIGHT + i*ROW_HEIGHT − scrollY`
   (`GanttRenderer.ts:189-191`). De invoeg-positie is dus een **rij-index**, geen
   pixel-y. `ROW_HEIGHT=28`, `HEADER_HEIGHT=50` (`GanttCanvas.tsx:30-31`).
5. **`getTaskBarBounds` sluit summaries (`childIds.length>0`) én milestones uit**
   (`GanttRenderer.ts:1439`). Verticaal slepen moet dus op `getRowAtY`/`getTaskAtY`
   leunen, niet op `getTaskBarBounds` — anders kun je een summary of mijlpaal
   nooit grijpen.
6. **Er is géén drempel in het horizontale bar-drag** (vuurt op de eerste pixel);
   drempel-precedent is `BOX_SELECT_THRESHOLD = 4` (`hooks/constants.ts:6`).
7. **Er bestaat nergens autoscroll** (verticaal noch horizontaal), bij geen enkel
   gebaar. Moet voor verticaal slepen van scratch worden gebouwd (§5).
8. **Geen `setPointerCapture`** in de hele codebase; alle gebaar-hooks gebruiken het
   patroon *window-listener in `useEffect` + cleanup*. Een nieuwe hook moet dat volgen.
9. **Muismodel-only** (géén pointer/touch-events). Verticaal slepen is v1 desktop/muis.
10. **`e.altKey` wordt in het canvas nergens gelezen** (alleen in
    `shortcutRegistry.ts` voor keyboard-shortcut-matching en `Select.tsx` voor
    tekstinput). Alt is daarmee een *technisch* vrije sleuf voor een modifier —
    met een belangrijke disclaimer: veel OS-window-managers (Linux/Mac) gebruiken
    Alt+sleep om het venster te verplaatsen (§3.1).
11. **Selectie wordt bij plain balk-press hard gereset** (`GanttCanvas.tsx:916`:
    `selectTask(hit.task.id, false)` → `s.selectedTaskIds = [id]`). Horizontaal
    slepen is daarmee per definitie single-task; verticaal slepen moet daarmee
    parity houden (§3.5).
12. **Click-suppressie via `justBoxSelectedRef`** (`GanttCanvas.tsx:152`): gebaren
    die niet willen dat de spuriouse native click ná mouseup de selectie overschrijft,
    zetten die ref op `true` op hun mouseup/Escape. `useBarDrag` doet dat **niet**
    (een bekend minpunt); een nieuwe verticale-drag-hook moet het wél doen.

## 3. Kernbeslissingen (met motivering)

### 3.1 Gebaar: dominant-as-bij-eerste-beweging, op de balk (keuze)

**Keuze.** Een plain (zonder modifier) mousedown op een taakrij start een
*pending drag*. Bij de eerste beweging voorbij een drempel (`ROW_DRAG_THRESHOLD`,
hergebruik 4 px) wordt de as beslist en **vergrendeld** tot mouseup:

- `|dy| > |dx|` → **verticale reorder-modus** (dit ontwerp).
- `|dx| ≥ |dy|` **én** er was een balk-hit (`getTaskBarBounds`≠null, dus een
  leaf-taak op de balk-zijde) → **horizontale datum-modus** (bestaand, ongewijzigd).
- `|dx| ≥ |dy|` maar géén balk-hit (summary/mijlpaal-rij, of de task-table-goot)
  → géén horizontale modus mogelijk; alleen verticaal is zinvol → **verticale
  reorder-modus**. (Een summary- of mijlpaalbalk is vandaag al niet horizontaal
  te slepen, dus dit voegt niets onverwachts toe.)

Dit werkt op **alle taakrijen** (leaf, summary, mijlpaal) omdat de kandidaat via
`getTaskAtY(y)` (rij-niveau) wordt bepaald, niet via `getTaskBarBounds`.

**Waarom dominant-as en niet een modifier.**
- Het issue heet *"taakbalken verticaal verslepen"* — de balk zélf is het grijppunt.
  Een modifier (Alt) is onontdekbare en Alt botst bovendien met OS
  venster-verplaatsen (Linux/Mac). Ctrl/Shift zijn al bezet (zie §3.5).
- As-vergrendeling bij eerste beweging is het standaard-, voorspelbare model
  (bv. veel bestandsbomen, Trello-lijsten). Eén keer beslist = geen
  modus-wissel midden in de sleep.
- De invoeg-indicator verschijnt **alléén** in verticale modus. Ziet de gebruiker
  de lijn, dan weet hij dat hij aan het herordenen is.

**Risico: de misgreep.** Wie een datum wil verschuiven maar zijn eerste beweging
(≥4 px) méér verticaal dan horizontaal maakt, triggert per ongeluk een reorder.
Mitigaties: (a) drempel + as-vergrendeling maken het onwaarschijnlijk bij een
bewust horizontale veeg; (b) de indicator geeft direct zichtbare feedback;
(c) **Esc annuleert** de sleep zonder mutatie; (d) bij exact gelijke as
(`|dx|===|dy|`) wint horizontaal (bescherming van de kernoperatie). Restrisico:
trackpad-gebruikers met oneffen streken. **Fallback als dit in testen te vaak
misgaat:** sleep-initiatie verplaatsen naar de **task-table-goot** (de kolom met
WBS-code/naam, `x < taskTableWidth`), die vandaag box-select start — daar geen
horizontaal datum-slepen mogelijk is, dus nul ambiguïteit. Dat is een kleinere
UX-verandering dan het lijkt en wordt als aparte optie in §8-Q1 meegenomen.

> **Gevolg voor bestaand gedrag (expliciet te reviewen):** er komt een 4 px
> dode zone vóór het horizontale bar-drag. Vandaag vuurt dat op de eerste pixel.
> Dit is een opzettelijke, minimale wijziging die ook per ongeluk 1 px
> datum-verschuivingen bij een klik voorkomt — maar het wél aan te merken als
> een gedragsverandering aan de kernoperatie.

### 3.2 Droptarget-semantiek: drie banden per rij

Tijdens de verticale sleep wordt per pointer-Y één doelrij bepaald
(`renderer.getRowIndex(canvasY)`, geklemd op `[0, rows.length-1]`). Binnen die
rij bepaalt de Y-relatief-tot-rij-hoogte de **band** (elke rij is `ROW_HEIGHT`=28 px):

| Band | Voorwaarde (binnen doelrij) | Resultaat |
|---|---|---|
| **before** | bovenste ~40 % (`y < 0.4·h`) | invoegen vóór doelrij-taak, als sibling bij diens parent |
| **after** | onderste ~40 % (`y > 0.6·h`) | invoegen ná doelrij-taak, als sibling bij diens parent |
| **nest** | middelste ~20 % **én** doelrij is een summary (`childIds.length>0`) of een te-nesten leaf | doelrij-taak wordt de nieuwe parent; T wordt **laatste** kind |

- **Op een summary** zijn dus alle drie de banden actief: boven/onder = sibling
  vóór/achter de summary; midden = kind-worden (als laatste kind, P6-conventie).
- **Op een leaf/mijlpaal** is alleen before/after actief (midden-band valt weg →
  gehele rij is before/after, splits op 50 %). Nesten onder een leaf is wél
  toegestaan (de leaf wordt dan summary); zie §8-Q7.
- **Groepsrijen** (`kind:'group'`) komen alleen voor in gegroepeerde modus = niet
  `isTreeMode` → verticaal slepen staat dan helemaal uit (§3.5), dus geen doel.
- **Buiten de lijst** (`canvasY` boven de header of onder de laatste rij): klemt
  naar "bovenste doelrij = before" resp. "onderste doelrij = after → append als
  laatste root". Zie randgevallen §7.

De indicator tekent (§5): bij `before`/`after` een horizontale lijn op de
rij-grens; bij `nest` een highlight/haak om de summary-rij.

### 3.3 De store-actie: `reparentTask` — signatuur, dual-source sync, cycle, stale, undo

**Signatuur** (toe te voegen aan `taskSlice.ts`, type in `slices/types.ts`):

```ts
reparentTask: (taskId: string, target: { parentId: string | null; childIndex: number }) => void;
```

`target.parentId === null` = root-niveau. `childIndex` = gewenste **uiteindelijke**
0-based positie onder de bestemmings-parent (na verwijdering uit de oude parent),
geklemd op `[0, childCount]`. Een hogere waarde dan `childCount` = achteraan.

De drag-logica lost de band (refTask + before/after/nest) op tot zo'n `target`
via een aparte pure helper (§5); de store-actie is het structurele primitief.

**Algoritme** (operates op de Immer-draft `s`):

1. **No-op-guard.** Als `target.parentId === task.parentId` én de huidige
   child-index al `=== clamp(childIndex)` → return zónder snapshot (geen
   undo-vervuiling).
2. **Cycle-guard** (hergebruik `moveTask`-patroon :310-316): als
   `target.parentId === taskId` óf in de ouderketen van `target.parentId`
   bovenop `taskId` uitkomt → return (geen mutatie).
3. `beginUndoable(s)` — **zonder** `coalesceKey` (één schot bij mouseup; de
   coalescing uit `useBarDrag` is hier overbodig omdat we niet per move muteren).
4. **`childIds` (display-bron):** verwijder `taskId` uit `oldParent.childIds`;
   `task.parentId = target.parentId`; splice `taskId` op
   `min(childIndex, newParent.childIds.length)` in `newParent.childIds`
   (`newParent === null` → geen childIds; root-lidmaatschap is implicit via
   `parentId === null`).
5. **Rauwe `s.tasks`-array (WBS/writer-bron) — het nieuwe ten opzichte van
   `moveTask`:**
   - Verzamel `task` + alle nakomelingen via pure helper `subtreeMembers(s.tasks, taskId)`
     (per parentId-keten — de array is niet gegarandeerd aaneengesloten; zie
     waarneming hieronder).
   - Verwijder die leden uit `s.tasks` (filter op lidmaatschap, niet op een
     index-range).
   - Bepaal doel-index in de gereduceerde array via pure helper
     `childInsertIndex(s.tasks, target.parentId, childIndex)` (zie hieronder).
   - Splice het hele blok (volgorde behouden) op die doel-index terug.
6. **WBS:** `if (s.project.wbsAutoNumber) applyWbsNumbering(s.tasks);`
7. `finishMutation(s)` — **`stale: false`** (zie motivering hieronder).

**Twee nieuwe pure helpers in `src/utils/wbs.ts`** (beide headless testbaar):

```ts
/** Verzamelt task + álle nakomelingen (per parentId-keten, niet afgaand op
 *  array-aaneengeslotenheid — zie waarneming hieronder) en retourneert hen in
 *  hun huidige relatieve array-volgorde. */
export function subtreeMembers(tasks: Task[], rootId: string): Task[];

/** Array-index waar een nieuw/verplaatst kind als childIndex-de kind van parentId
 *  thuishoort, zodanig dat flattenOrder het als dat kind uitbraakt.
 *  parentId===null → childIndex-de root. Berekend op de array ZONDER het block. */
export function childInsertIndex(tasks: Task[], parentId: string | null, childIndex: number): number;
```

`childInsertIndex` hergebruikt de `flattenOrder`-traversie-logica: het wandelt
diepte-eerst en telt kinderen van `parentId`; de return-waarde is de array-index
vlak vóór het huidige `childIndex`-de kind, of direct ná `parentId`/diens
laatste nakomeling bij append.

> **Waarneming (array is niet gegarandeerd aaneengesloten):** `reorderSibling`-root
> (`taskSlice.ts:502-521`) wisselt twee root-**knooppunten** op absolute index
> (`s.tasks[absA] = s.tasks[absB]`) zonder hun subtrees mee te bewegen. Daarna is
> de array **niet** diepte-eerst-aaneengesloten (een root-kind kan gescheiden van
> diens parent elders staan). Dat is géén bug: `flattenOrder`/`deriveWbsCodes`
> hergroeperen op `parentId`, dus display én WBS blijven correct. Maar het dwingt
> af dat `subtreeMembers` nakomelingen **per parentId-keten verzamelt** (en de
> block-verwijdering filtert op lidmaatschap, niet op een index-range) — een
> naïeve `slice(start,end)`-range zou anders niet-nakomelingen meenemen. Pseudocode
> in §4 is dienovereenkomstig op te lezen.

**Waarom `stale: false`.** Verticaal slepen raakt geen datums, duur, sequences
of kalender → de CPM-wiskunde verandert niet. `reorderSibling` zet om dezelfde
reden expliciet géén `stale` (docstring `taskSlice.ts:53`: *"Puur volgorde —
raakt GEEN tijden/CPM"*). `moveTask` zet wél `stale:true` (:336); dat is
waarschijnlijk defensief-overconservatief (ook reparenting raakt CPM niet), maar
dat reconciliëren valt buiten dit issue. `reparentTask` volgt de
`reorderSibling`-lijn en de issue-eis *"datums veranderen niet"*.

**Eén undo-stap.** Een enkele `beginUndoable`+`finishMutation` bij mouseup. Er
wordt **niet** per mousemove gemuteerd (in tegenstelling tot horizontaal slepen),
dus één undo-entry is natuurlijk — geen coalescing nodig.

### 3.4 Drag-state en rendering

- **Nieuwe hook** `src/components/canvas/hooks/useRowDrag.ts`, vorm gespiegeld aan
  `useBarDrag`: `{ rowDragState, startRowDrag, active }`, met window-listeners in
  een `useEffect` (geen pointer-capture, conform codebase-conventie).
  `rowDragState = { taskId, startY, currentCanvasY, target: { parentId, childIndex } | null }`.
- **Coördinatie met as-beslissing:** `handleMouseDown` armt bij plain press op een
  taak-rij een *pending drag* (start-x/y + kandidaat-taak). Pas wanneer de
  as-beslissing (§3.1) op *verticaal* uitkomt, roept het `startRowDrag` aan; bij
  *horizontaal* wordt `barDrag.startBarDrag` aangeroepen (bestaand). Beide sluiten
  elkaar uit door de as-vergrendeling.
- **Indicator:** hergebruik het box-select-overlay-patroon (`GanttCanvas.tsx:1078-1105`)
  — een `pointerEvents:'none'` `<div>` in `containerRef`. Bij `before`/`after` een
  2 px horizontale lijn op de rij-grens (volledige breedte van de timeline);
  bij `nest` een highlight + haak om de summary-rij. **Belangrijk** (uit §2):
  de lijn-Y moet via `rowToY(index)` met de **actuele** `scrollY` worden
  omgerekend, anders drijft hij weg zodra de viewport tijdens de sleep scrollt.
- **Geen ghost/live-mutatie:** de bron-rij blijft normaal op zijn plek staan
  tijdens de sleep (mogelijk licht gedimd + `move`-cursor); alleen de
  invoeg-lijn toont het doel. Dat is het standaard lijst-reorder-UX en eenvoudiger
  dan een meebewegende ghost.
- **Autoscroll** (net nieuw): een `requestAnimationFrame`-loop, actief zolang
  `rowDragState`≠null en de pointer binnen een randzone (bv. ≤40 px van de
  container-top/bottom) valt → `setScroll(view.scrollX, view.scrollY ± delta)`,
  geklemd via de reeds geregistreerde `maxScrollY`
  (`setGanttScrollBounds` in `GanttCanvas.tsx:461-464`). Stop bij mouseup/Escape.

### 3.5 Guards

- **`isTreeMode(view) === false`** (actief filter/groepering/sortering): verticaal
  slepen staat **helemaal uit**. Bij non-tree-mode is de boom niet de bron van
  waarheid, dus structuur-mutaties zijn zinloos (docstring `visibleRows.ts:43-46`).
  De pending-drag armt dan niet; de indicator verschijnt nooit. Identiek aan hoe
  `indent`/`outdent`/`reorderSibling` zich via het contextmenu verbergen.
- **Modifier-botsing (issue #21 pt. 3):** verticaal slepen armt **uitsluitend bij
  een plain press** (géén modifier). `shift`+press → dependency-tekenen (bestaand,
  ongewijzigd); `ctrl`/`meta`+press → no-op-slot voor click-toggle (bestaand). Daarmee
  is er geen conflict. Alt wordt niet gebruikt (OS-conflict, §3.1).
- **Multi-selectie:** als meerdere taken geselecteerd zijn en je sleept er één,
  wordt **alleen de gegrepen taak** verplaatst en de selectie **ingekrompen tot
  die taak** — exact parity met horizontaal bar-drag vandaag (`:916` hard-reset).
  Blok-slepen van een non-contiguous multi-selectie is complex (per-taak
  cycle-checks, ordening) en uit scope v1 (§8-Q4).

## 4. De store-actie in detail (pseudocode)

```ts
reparentTask: (taskId, target) => set((s) => {
  const task = s.tasks.find(t => t.id === taskId);
  if (!task) return;

  // 1. no-op
  const oldParentId = task.parentId;
  if (oldParentId === target.parentId) {
    const parent = target.parentId ? s.tasks.find(t => t.id === target.parentId) : null;
    const cur = parent ? parent.childIds.indexOf(taskId) : s.tasks.filter(t=>!t.parentId).indexOf(task);
    const clamped = Math.min(target.childIndex, parent ? parent.childIds.length : /*rootCount*/ Infinity);
    if (cur === clamped) return; // niets veranderd → geen undo
  }

  // 2. cycle-guard (wandel ouderketen van target.parentId omhoog; taskId gevonden → return)
  if (isDescendantOrSelf(s.tasks, target.parentId, taskId)) return;

  // 3. undo
  beginUndoable(s);

  // 4. childIds (display)
  removeFromChildIds(s, oldParentId, taskId);
  task.parentId = target.parentId;
  insertIntoChildIds(s, target.parentId, taskId, target.childIndex);

  // 5. rauwe array (WBS/writers) — het nieuwe t.o.v. moveTask
  const members = subtreeMembers(s.tasks, taskId);            // task + alle nakomelingen
  s.tasks = s.tasks.filter(t => !members.some(m => m.id === t.id)); // verwijder (lidmaatschap, niet range)
  const at = childInsertIndex(s.tasks, target.parentId, target.childIndex);
  s.tasks.splice(at, 0, ...members);                          // herplaats hele blok, volgorde behouden

  // 6. WBS
  if (s.project.wbsAutoNumber) applyWbsNumbering(s.tasks);

  // 7. afsluiten — géén stale (datums/CPM ongewijzigd)
  finishMutation(s);
}),
```

`isDescendantOrSelf` hergebruikt de keten-wandeling uit `moveTask` (:310-316).
`removeFromChildIds`/`insertIntoChildIds` zijn triviale wrappers die de parent
vinden en filteren/splicen (bestaan al inline in `moveTask`/`indent`/`outdent` —
deze actie is een gelegenheid ze te deduperen tot helpers, optioneel).

## 5. Drag-state machine + band→target-resolutie

State-overgangen (in `useRowDrag` + `handleMouseDown`):

```
IDLE
 └─ plain mousedown op taak-rij → PENDING (record start-x/y, kandidaat-taak, window-listeners aan)
       └─ eerste move > THRESHOLD:
            │ |dy|>|dx|  → VERTICAL (startRowDrag) ──┐
            │ |dx|≥|dy| & bar-hit → hand af aan barDrag (bestaand), PENDING afbreken
            │ |dx|≥|dy| & geen bar-hit → VERTICAL (summary/mijlpaal) ──┐
            └──────────────────────────────────────────────────────────┤
       VERTICAL:
         mousemove → bereken doelrij+band → update rowDragState.target → herrender indicator
                     (+ autoscroll bij rand)
         Esc       → ANNULEREN (state weg, justBoxSelectedRef=true, géén mutatie)
         mouseup   → als target geldig: store.reparentTask(taskId, target)
                     state weg; justBoxSelectedRef=true (onderdruk spuriouse click)
```

**Band→target-resolutie** (pure helper, leeft naast de store-actie):

```ts
// Gegeven de zichtbare rijen, de pointer boven doelrij `ref` in band `b`:
function resolveDropTarget(rows: ViewRow[], refTaskId: string, b: 'before'|'after'|'nest'): { parentId: string|null; childIndex: number } {
  // before  → sibling vóór ref bij ref.parentId, childIndex = index van ref onder diens parent
  // after   → sibling ná ref bij ref.parentId, childIndex = index van ref + 1
  // nest    → parentId = refTaskId, childIndex = ref.childIds.length (laatste kind)
}
```

De indicator heeft deze helper nodig op render-tijd (per mousemove); de store-actie
krijgt het opgeloste `target` pas bij mouseup.

## 6. Faseringsvoorstel (3 stappen, elk afzonderlijk bouwbaar + verifieerbaar)

### Stap 1 — Pure logica + headless tests (geen UI)
De riskanteste logica (dual-source sync, cycle, block-range) volledig geïsoleerd.
- **Bestanden:** `src/utils/wbs.ts` (+`subtreeBlockRange`, `childInsertIndex`),
  `src/state/slices/taskSlice.ts` (+`reparentTask`), `src/state/slices/types.ts`
  (signatuur), `src/state/transaction.ts` (geen wijziging, alleen hergebruik).
- **Verificatie:** headless op Node (esbuild-harness zoals `tests/planning/`, of
  een los scriptje dat dezelfde store+helpers laadt). Assertions per geval:
  - na `reparentTask(T, {P, k})` → `flattenOrder` toont T op de juiste plek;
  - `P.childIds` bevat T op index k; `oldParent.childIds` niet meer;
  - WBS-codes (indien `wbsAutoNumber`) consistent met nieuwe volgorde;
  - cycle (`T→eigen nakomeling`) → no-op, géén undo-entry;
  - no-op (zelfde plek) → géén undo-entry;
  - `task.time` byte-identiek (datums ongewijzigd);
  - exact één entry op `undoStack`.

### Stap 2 — Gebaar + as-disambiguatie + store-call (zonder indicator)
- **Bestanden:** `src/components/canvas/hooks/useRowDrag.ts` (nieuw),
  `src/components/canvas/hooks/constants.ts` (+`ROW_DRAG_THRESHOLD = 4`),
  `src/components/canvas/GanttCanvas.tsx` (dispatch in `handleMouseDown`,
  as-beslissing, `justBoxSelectedRef`-set bij mouseup/Escape, cursor-hint in
  `handleMouseMove`).
- **Verificatie:** Playwright-MCP + `window.__OPS__` tegen de browser-dev-build
  (`npm run dev`). Store-asserties (geen canvas-pixels):
  - sleep taak naar andere summary → `reparentTask`-effect zichtbaar in store
    (parent/childIds/flattenOrder); **datums ongewijzigd**;
  - horizontaal slepen doet nog steeds datum-mutatie (regressie-check);
  - `ctrl`/`shift`+press triggert géén verticale modus (multiselect/dependency
    ongewijzigd);
  - summary- en mijlpaal-rij zijn nu verticaal te grijpen;
  - Esc annuleert zónder mutatie;
  - `isTreeMode===false` (groepering aan) → géén verticale modus.

### Stap 3 — Indicator-overlay + edge-autoscroll
- **Bestanden:** `src/components/canvas/GanttCanvas.tsx` (overlay-JSX, autoscroll
  rAF), eventueel `src/engine/renderer/GanttRenderer.ts` (helper
  rij-grens-Y gegeven index, als die er niet is).
- **Verificatie:** visueel (screenshots) — lijn op before/after-grens, highlight
  bij nest; lijn blijft op de juiste rij tijdens autoscroll; nesten in een
  ingeklapte summary expandeert deze op drop.

*(Optioneel) Stap 4 — afwerking:* cursor-states per band, i18n eventuele
tooltips, documentatie/changelog, en de eventuele gutter-alternatief (§8-Q1).

## 7. Randgevallen — per stuk beantwoord

| # | Geval | Antwoord |
|---|---|---|
| 1 | `target.parentId === taskId` of nakomeling | **cycle-guard weigert**, no-op, géén undo (hergebruik `moveTask`-ketenwandeling). |
| 2 | Slepen naar exact de huidige plek | **no-op-guard**, géén undo-entry. |
| 3 | Slepen naar kind-positie onder een *leaf* | toegestaan; leaf wordt summary. (Zie §8-Q7.) |
| 4 | Nesten in een **ingeklapte** summary | op drop **auto-expand** zodat resultaat zichtbaar is (open Q: extra dwell-expand tijdens sleep — §8-Q2). |
| 5 | **Mijlpaal** als sleepbron | toegestaan (reorder); mijlpaal blijft mijlpaal, datums ongewijzigd. |
| 6 | Mijlpaal als nest-doel | leaf → alleen before/after; nesten maakt er summary van (ongebruikelijk, wel toegestaan). |
| 7 | **Groepsrij** (`kind:'group'`) als doel | komt alleen voor buiten tree-mode → verticaal slepen uit → nooit een doel. |
| 8 | Boven de **eerste rij** | before op rij 0 → eerste sibling bij diens parent (of nieuwe eerste root). |
| 9 | Onder de **laatste rij** / buiten de lijst | after op laatste rij → **append als laatste root** (open Q: laatste-root vs. laatste-sibling-van-laatste-rij — §8-Q3). |
| 10 | **Summary** slepen | hele subtree verplaatst mee (block). Cycle-check voorkomt droppen in eigen nakomeling. |
| 11 | `isTreeMode===false` | verticaal slepen uit; indicator verschijnt niet. |
| 12 | **Multi-selectie** actief, je sleept er één | alleen gegrepen taak verplaatst; selectie → alleen die taak (parity met horizontaal). |
| 13 | **Esc** tijdens sleep | annuleren, géén mutatie, `justBoxSelectedRef=true`. |
| 14 | Loslaten op **ongeldig** doel (cycle / groepsrij) | géén `reparentTask`-call, state weg, selectie ongewijzigd. |
| 15 | Reeds horizontaal aan het slepen | as-vergrendeling sluit verticaal uit (en omgekeerd). |
| 16 | **Touch/pen** | niet ondersteund v1 (mouse-only). |
| 17 | Spuriouse native **click** ná mouseup | onderdrukt via `justBoxSelectedRef=true` (anders overschrijft `handleClick` selectie). |
| 18 | Document-switch tijdens sleep | window-`mouseup` buiten het canvas ruimt de listener op (conventie); bij twijlf Esc. |

## 8. Open productvragen (besluit van de eigenaar vereist)

- **Q1 — Gebaarkeuze.** Dominant-as-op-de-balk (aanbevolen) vs. Alt-modifier vs.
  gutter-sleep (`x < taskTableWidth`). Aanbeveling: dominant-as; fallback gutter
  als Stap-2-testen een te hoog misgreep-percentage laten zien.
- **Q2 — Nesten in ingeklapte summary.** Auto-expand-op-drop (aanbevolen) vs.
  dwell-expand tijdens sleep (~600 ms) vs. blokkeren.
- **Q3 — Onder-de-lijst-semantiek.** Append-als-laatste-root (aanbevolen) vs.
  laatste-sibling-van-laatste-zichtbare-rij.
- **Q4 — Multi-selectie-blok-sleep.** v1 single-task (aanbevolen); blok-sleep als
  latere uitbreiding.
- **Q5 — `stale` bij reparent.** `false` aanbevolen (parity met `reorderSibling`,
  CPM is structuur-onafhankelijk). Bevestigen dat er géén verborgen CPM-afhankelijkheid
  van boom-positie is (geen — CPM leest sequences+duur+kalender).
- **Q6 — TableEditor.** Alleen Gantt (issue scope) — TableEditor-reordering als
  latere, aparte taak noteren.
- **Q7 — Leaf/mijlpaal als nest-doel.** Toestaan (wordt summary, P6-conform,
  aanbevolen) vs. blokkeren (alleen nesten onder bestaande summaries).

## 9. Wat bewust NIET in v1

- Multi-selectie-blok-sleep (Q4) en herordenen van een non-contiguous selectie.
- TableEditor (DOM) verticaal slepen — Gantt-only (Q6).
- Touch/pen-ondersteuning (vereist migratie naar Pointer Events voor het hele canvas).
- Een meebewegende *ghost* van de taak (de bron-rij blijft staan; alleen de
  invoeg-lijn toont het doel).
- Reconciliëren van `moveTask`'s `stale:true` met de `stale:false`-conventie —
  buiten dit issue.
- WBS-code-maskers/prefixen — al v2 in het WBS-ontwerp.

## 10. Verificatie-aanpak (samengevat)

- **Stap 1** headless op Node: pure store+helpers, assertions op
  flattenOrder/childIds/wbsCodes/cycle/no-op/datums/undo (zie §6).
- **Stap 2** Playwright-MCP + `window.__OPS__` op de browser-build:
  store-asserties, géén canvas-pixels (conform `docs/self-test-harness.md` Tier 1).
- **Stap 3** visueel: screenshots van before/after/nest-indicator + autoscroll.
- Buiten scope van dit ontwerp, maar aanbevolen: een `tests/planning/`-case voor
  reparenting-round-trip door de IFC-writer/reader (volgorde-behoud via
  `IfcRelNests`), aangezien de rauwe array-volgorde nu de writer voedt.
