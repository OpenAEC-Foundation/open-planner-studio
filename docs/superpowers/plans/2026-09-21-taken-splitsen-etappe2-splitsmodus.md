# Taken splitsen — etappe 2 (splits-modus in de Gantt) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** De gebruiker zet in het lint **Taak splitsen** aan, klikt op een balk op de dag waar de
pauze begint en sleept naar rechts voor de lengte. Eindigt in **kijkmoment 1** met de eigenaar.

**Architecture:** De modus spiegelt het bestaande relatie-tekenen (`ui.showDependencyMode`,
`DependencyModeNotice`, de toggle in `ribbonWidgets.tsx`): sessie-vlag in `uiSlice`, een gekleurd
meldingsblok boven de Gantt, en een eigen gebaar-hook die door `useGanttPointerCoordinator` wordt
gestart. Al het rekenwerk loopt via `splitEdit.ts` en `taskSlice.setTaskSplits` (etappe 1).
Pixel ↔ datum uitsluitend via `viewport.sharedAxis` (zoals `useBarDrag`).

**Tech Stack:** React 19, Zustand/Immer, Canvas 2D-overlay, Playwright.

Spec: `docs/superpowers/specs/2026-09-19-taken-splitsen-bewerken-design.md` §3. Dit is een
PROTOTYPE-etappe: de eigenaar stuurt na het kijkmoment bij. Houd de UI daarom klein en
omkeerbaar; geen paneel, geen contextmenu, geen stuk-slepen (etappe 3/4).

---

### Task 1: `workOffsetAtDate` — datum → positie op de werk-as (puur)

**Files:** Modify `src/engine/scheduler/splitEdit.ts`; Test `tests/planning/check-split-edit.ts`.

- [ ] Falende tests (dag-kalender ma–vr 8u, `CalendarEngine` zoals in `check-split-walk.ts`):
  taak start ma 2026-06-01, 10 dagen, geen gaten: datum wo 06-03 ⇒ `960` (twee werkdagen vóór
  woensdag); datum = start ⇒ `0`; za 06-06 ⇒ `2400` (weekend telt niet). Met stukken
  `[2400 werk, 2400 pauze, 2400 werk]`: een datum IN de pauze (ma 06-08 + …) ⇒ `{ inGap: true }`;
  di 06-16 (eerste dag na de pauze +1) ⇒ `2880`. Uur-kalender: 06-01T12:00 ⇒ `240`.
- [ ] Implementeer
  `workOffsetAtDate(pieces, taskStart: Date, at: Date, eng: CalendarEngine, hourMode: boolean): { workMinutes: number; inGap: boolean }`
  — tel werkminuten tussen `taskStart` en `at` (`eng.workMinutesBetween` in uur-modus,
  `eng.workDaysBetween`-achtige telling × `hoursPerDay×60` in dag-modus; let op: `workDaysBetween`
  is INCLUSIEF, gebruik de half-open variant die `splitWalk`/`addWorkingDaysSigned` hanteert) en
  loop die as-afstand door de stukken: werk telt mee, pauze niet. Type-only import van
  `CalendarEngine` (geen cyclus — `verify:cycles`).
- [ ] Groen + `npm run typecheck`. Commit: `Splits: datum naar werk-as-positie`.

### Task 2: Modusvlag, lintknop en meldingsblok

**Files:** `src/state/slices/types.ts` (`UIState.showSplitMode: boolean`), `src/state/slices/uiSlice.ts`
(default `false`; wederzijds uitsluitend met `showDependencyMode` — aanzetten van de ene zet de
andere uit, op de plek waar `setUI` dat kan afdwingen of in de twee toggles),
`src/components/layout/Ribbon/ribbonWidgets.tsx` + `ribbonConfig.tsx` (knop **Taak splitsen** in
de taakgroep van Start, Planning en Tabel, naast de relatie-tekenknop; toggle-stijl `active`),
`src/components/layout/SplitModeNotice.tsx` (kopie-naar-vorm van `DependencyModeNotice.tsx`:
gekleurd blok met één zin uitleg + knop "Stoppen"), mount naast `DependencyModeNotice`.

- [ ] Lees eerst hoe `showDependencyMode` van begin tot eind loopt
  (`grep -rn "showDependencyMode" src`) en volg élke plek: default, Esc-afhandeling,
  documentwissel/reset, sneltoetsregister. De nieuwe vlag krijgt op al die plekken hetzelfde.
- [ ] Icoon: kies een bestaand icoon uit de gebruikte iconenset dat "knippen/splitsen" uitdrukt
  (bv. `Scissors`/`SplitSquareHorizontal` als de set lucide is — controleer de import in
  `ribbonWidgets.tsx`).
- [ ] i18n: nieuwe sleutels in `menu.json` (`ribbon.splitTask`, `ribbon.splitTaskOnHint`,
  `ribbon.splitTaskOffHint`) en `common.json` of waar `view.dependencyModeHint` woont
  (`view.splitModeHint`, `view.splitModeStop`) in ALLE 14 locales — nl canoniek, de rest echt
  vertaald (geen Engels in een andere taal). `npm run verify:i18n` exit 0.
  nl-teksten: knop "Taak splitsen"; hint "Klik op een balk op de dag waar de onderbreking begint
  en sleep naar rechts voor de lengte. Esc stopt."; stopknop "Stoppen".
- [ ] Tekstgroottes alleen via de zes rollen (`npm run verify:text-roles`).
- [ ] Commit: `Splits: splits-modus als lintknop met meldingsblok`.

### Task 3: Het splitsgebaar

**Files:** Create `src/components/canvas/hooks/useSplitGesture.ts`; Modify
`useGanttPointerCoordinator.ts`, `ganttCoordinatorTypes.ts`, `GanttCanvas.tsx` (vlag doorgeven +
overlay tekenen), `scripts/verify-gantt-boundaries.mjs` (`gestureStarts` += `'startSplitGesture'`)
en de bijbehorende fixture-check in `tests/planning/` (zoek: `grep -ln "gestureStarts\|startDepDraw" tests/planning/*.ts`).

- [ ] **Volgorde in `onMouseDown`:** nieuwe stap tussen 4 en 5 — `splitMode && hit` ⇒
  `canSplitTask(...)`; `null` ⇒ `event.preventDefault(); splitGesture.startSplitGesture({...}); selectTask(id,false); return;`
  anders niets starten (de cursor zegt al "verboden"). Werk het karakteriseringscommentaar boven
  `onMouseDown` en de "actief gebaar weigert een tweede"-guards bij (`splitGesture.active` overal
  waar `barDrag.active` staat). Als er een karakteriseringstest van die matrix bestaat, breid hem uit.
- [ ] **Hook** naar het model van `useBarDrag` (eigen state + window-listeners, `getTask` voor
  actuele lezing, `axis` = dezelfde `sharedAxis`, monotone teller voor een unieke
  `coalesceKey` `split:<taskId>:<n>`):
  - bij start: `pieces0 = toSplitPieces(task.splitGaps, werk)`; `offset = workOffsetAtDate(...)`
    van de gesnapte klikdatum (dag-modus: begin van de aangeklikte dag; uur-modus: de bestaande
    uur-snap uit `hourBarDragMath`); `inGap` of weigering door `splitAt` ⇒ gebaar start niet.
  - per mousemove: pauzelengte = werkminuten tussen klikdatum en huidige gesnapte datum (min. 1
    eenheid, nooit negatief) ⇒ `splitAt(pieces0, offset, pauze, unit, completedWorkMinutes(...))`
    ⇒ `setTaskSplits(id, pieces, { coalesceKey })`. ALTIJD vanaf `pieces0` rekenen (niet vanaf
    de vorige mousemove), zodat terugslepen de pauze weer korter maakt.
  - mouseup zonder beweging ⇒ één commit met pauze = 1 eenheid. Esc tijdens het gebaar ⇒ `undo()`
    van de lopende coalesce-stap als er al gecommit is, en stoppen.
  - exposeer `active`, `gestureState` (taskId, klik-x, huidige x, pauze in eenheden) voor de overlay.
- [ ] **Hover/overlay in de modus:** verticale geleidelijn op de gesnapte dag over de balkhoogte +
  klein label met de datum; tijdens het gebaar het label "n werkdagen pauze" (pluralfamilie —
  `task.json`, alle 14 locales, juiste CLDR-categorieën; uur-taak: uren). Tekenen op de bestaande
  overlaylaag waar ook de relatie-sleeplijn getekend wordt (lees hoe `overlays.dependency` in
  `GanttCanvas.tsx` wordt verwerkt). Cursor: `col-resize` op een splitsbare balk, `not-allowed` op
  een niet-splitsbare, `default` elders. De gewone taak-tooltip staat uit in de modus.
- [ ] `npm run verify:gantt-boundaries` exit 0 — het gebaar mag uitsluitend door de coördinator
  gestart worden.
- [ ] Commit: `Splits: splitsgebaar in de Gantt`.

### Task 4: Browsertest

**Files:** Create `tests/browser/task-split.spec.ts` (volg de opzet van een bestaande Gantt-spec,
bv. `grep -ln "getTaskBarBounds\|bar" tests/browser/*.spec.ts`).

- [ ] Fixture via `window.__OPS__`: één taak van 10 werkdagen. Test 1: knop **Taak splitsen** aan ⇒
  meldingsblok zichtbaar; echte muis: down op de balk ter hoogte van dag 6, move drie dagkolommen
  naar rechts, up ⇒ `splitGaps` = `[{ afterMinutes: 2400, gapMinutes: 1440, source: 'user' }]`,
  `scheduleDuration` nog 10, één undo-stap (Ctrl+Z ⇒ `splitGaps` weg). Test 2: losse klik ⇒ pauze
  van 1 dag. Test 3: Esc ⇒ modus uit, blok weg. Test 4: mijlpaal ⇒ niets gewijzigd.
  De muispositie komt uit de canvasgeometrie die de brug al blootgeeft — geen pixel-asserties.
- [ ] `npm run test:browser -- task-split` exit 0 (de runner start zelf een bewaakte Vite).
- [ ] Commit: `Splits: browsertest voor de splits-modus`.

### Task 5: Poorten en kijkmoment

- [ ] `npm run typecheck && npm run lint && npm run test:planning && npm run verify:i18n && npm run verify:gantt-boundaries && npm run verify:text-roles && npm run verify:store-boundaries && npm run verify:cycles`
  — elk op exitcode, nooit parallel aan een andere suite.
- [ ] Push fast-forward naar `origin/t3code/issue-146-work`.
- [ ] De orchestrator start de dev-server losgekoppeld, controleert zelf visueel, en biedt
  kijkmoment 1 aan in de afronding-vorm met controlestappen.
