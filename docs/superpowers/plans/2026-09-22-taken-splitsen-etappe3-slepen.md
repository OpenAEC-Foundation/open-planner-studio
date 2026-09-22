# Taken splitsen — etappe 3 (stukken slepen + contextmenu) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Op een gesplitste balk buiten de splits-modus: een later stuk slepen maakt de pauze ervoor
langer/korter (tegen het vorige stuk = samenvoegen), de rechterrand van een stuk maakt dat stuk
langer/korter (taakduur verandert mee), en rechtsklik biedt "Onderbreking opheffen" / "Alle
onderbrekingen opheffen". Eindigt in **kijkmoment 2**.

**Architecture:** De renderer bewaart per getekende gesplitste balk de stuk-rechthoeken en geeft in
`getTaskBarBounds` naast `edge` ook `segmentIndex`/`segmentCount` terug (nieuw oppervlak, spec
bevinding 17). `useBarDrag` krijgt twee nieuwe sleeptakken die — net als het splitsgebaar — vanaf
een bevroren `pieces0` rekenen en per mousemove `setTaskSplits(id, pieces, { coalesceKey })`
committen. Rekenwerk uitsluitend via `splitEdit.ts`. Het contextmenu volgt het bestaande
`barHit`-patroon in `ContextMenu.tsx`.

Spec: `docs/superpowers/specs/2026-09-19-taken-splitsen-bewerken-design.md` §3 "Buiten de modus"
en "Contextmenu". Eigenaar op kijkmoment 1 (2026-09-22): gat-tekening is goed; niets wijzigen aan
etappe 2.

**Werkafspraken:** poorten op exitcode; geen `npm run verify`/`npm test`; nooit twee suites tegelijk;
`PATH` met nvm node v24; niet pushen; Nederlands.

---

### Task 1: Renderer levert stuk-rechthoeken

**Files:** `src/engine/renderer/GanttRenderer.ts` (tekenlus ~1237–1250 waar `computeSplitSegments`
wordt aangeroepen; `getTaskBarBounds` ~2222–2250 incl. het Z15-docblok), `tests/planning/check-split-bar-render.ts`.

- [ ] Falende test: renderer met een 10-daagse taak met `splitGaps: [{afterMinutes:2400, gapMinutes:1440, source:'user'}]`;
  na `render()` moet `getTaskBarBounds(xMiddenStuk2, yRij)` `{ edge:'body', segmentIndex:1, segmentCount:2 }` geven,
  `getTaskBarBounds(xRechterrandStuk1, y)` `{ edge:'right', segmentIndex:0, segmentCount:2 }`, en een x IN het gat `null`
  (een gat is geen grijpvlak). Ongesplitste taak: `segmentIndex:0, segmentCount:1` — bestaande asserties blijven groen.
- [ ] Implementeer: bewaar in de tekenlus per taak-id de `segments` (schermcoördinaten `x1,x2`) in een `Map` die per
  `render()` wordt geleegd; `getTaskBarBounds` zoekt eerst het stuk onder `canvasX` (met `edgeZone` per stuk: linkerrand
  ALLEEN op stuk 0, rechterrand op elk stuk); geen stuk ⇒ `null`. Retourtype uitbreiden met
  `segmentIndex: number; segmentCount: number`. Het Z15-docblok herschrijven: per-segment-slepen is nú deze etappe.
- [ ] Alle aanroepers van `getTaskBarBounds` typechecken (`useGanttPointerCoordinator`, tests). Commit:
  `Splits: renderer levert stuk-rechthoeken aan de hit-test`.

### Task 2: Stuk slepen = pauze ervoor bijstellen; rechterrand = stuklengte

**Files:** `src/components/canvas/hooks/useBarDrag.ts`, `useGanttPointerCoordinator.ts` (stap 6 geeft
`segmentIndex/segmentCount` door), `ganttCoordinatorTypes.ts`, `GanttCanvas.tsx` (label tijdens slepen:
hergebruik het `split-mode-label`-DOM-chip-patroon van etappe 2 — "n werkdagen pauze" bij stuk-slepen,
de nieuwe stuklengte bij rand-slepen; `useDisplayDate` voor datums).

- [ ] `DragState` krijgt `segmentIndex`, `segmentCount`, en bij een split-sleep `pieces0: SplitPiece[]`,
  `anchorDate` (gesnapte pointerdatum bij start) en een `coalesceKey` `splitdrag:<taskId>:<n>`.
- [ ] Takken in de mousemove-handler, vóór de bestaande body/right/left-takken:
  - `edge==='body' && segmentIndex>0` ⇒ `delta = workAxisMinutesBetween(anchorDate, huidige gesnapte datum)`
    (bestaande helper uit `splitEdit.ts`; negatief naar links), nieuwe pauze = oude pauzelengte(gapIndex
    `segmentIndex-1`) + delta ⇒ `setGapLength(pieces0, segmentIndex-1, nieuw, unit)`; `nieuw <= 0` ⇒ samenvoegen
    (dat doet `setGapLength` al). Resultaat `ok:false` ⇒ niets committen. Commit via `setTaskSplits`.
  - `edge==='right' && segmentCount>1` ⇒ `setWorkLength(pieces0, segmentIndex, oudeLengte + delta, unit)`; ook voor het
    LAATSTE stuk (dat vervangt het bestaande duur-slepen op een gesplitste balk, met dezelfde uitkomst: duur verandert).
  - Ongesplitste balk (`segmentCount===1`): bestaande code, byte-identiek.
  - `edge==='left'` op stuk 0: bestaand gedrag (hele taak).
  - Verticale sleep op de body van stuk i>0 gaat NIET naar de rijsleep-overdracht (`onVerticalBodyDrag`) —
    alleen stuk 0 doet dat, zoals een ongesplitste balk.
- [ ] Cursor: `grab` op elk stuk-body, `ew-resize` op elke rechterrand — geen nieuwe cursors.
- [ ] Commit: `Splits: stukken en stukranden slepen`.

### Task 3: Contextmenu

**Files:** `useGanttPointerCoordinator.ts` (`onContextMenu` gebruikt `getTaskBarBounds` erbij om `segmentIndex`
in `GanttContextMenuState` te zetten: nieuw veld `splitGapIndex: number | null` = index van de pauze VÓÓR het
aangeklikte stuk, `null` op stuk 0 of zonder splits), `ganttCoordinatorTypes.ts`, `ContextMenu.tsx` (twee
`MenuItem`s onder `startRelationHere` als `task.splitGaps?.length`: `context.removeSplitGap` (alleen als
`splitGapIndex !== null`) en `context.removeAllSplitGaps`), `GanttCanvas.tsx` (handlers: `removeGap`/`null` via
`setTaskSplits`), `menu.json` in ALLE 14 locales (nl: "Onderbreking opheffen", "Alle onderbrekingen opheffen").
Voor een niet-bewerkbare importsplit (`canSplitTask` ⇒ `'not-editable'`) blijft alleen "Alle onderbrekingen
opheffen" over (spec §1).
- [ ] `tests/planning/check-context-menu-scope.ts` uitbreiden als die de balk-items pint.
- [ ] Commit: `Splits: onderbrekingen opheffen via het contextmenu`.

### Task 4: Browsertest

**Files:** `tests/browser/task-split.spec.ts` (uitbreiden; fixture-helpers hergebruiken).
- [ ] Test 5: taak met split 5+3+5 (via `setTaskSplits` in de brug) ⇒ stuk 2 twee dagkolommen naar rechts slepen ⇒
  `gapMinutes` 2400; naar links tot tegen stuk 1 ⇒ `splitGaps` weg; één undo-stap per gebaar.
- [ ] Test 6: rechterrand van stuk 1 één dag naar links ⇒ `afterMinutes` 1920, `scheduleDuration` 9.
- [ ] Test 7: rechtsklik op stuk 2 ⇒ "Onderbreking opheffen" zichtbaar en werkt; rechtsklik ⇒ "Alle onderbrekingen
  opheffen" op een taak met twee pauzes ⇒ `splitGaps` weg.
- [ ] `npm run test:browser -- task-split` exit 0. Commit: `Splits: browsertests voor slepen en contextmenu`.

### Task 5: Poorten
- [ ] `typecheck`, `lint`, `test:planning`, `verify:i18n`, `verify:gantt-boundaries`, `verify:text-roles`,
  `verify:store-boundaries`, `verify:cycles`, `verify:docs` — elk exit 0, sequentieel.
