# Taken splitsen — etappe 4 (sectie "Onderbrekingen" in het eigenschappenpaneel) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** In het eigenschappenpaneel een sectie **Onderbrekingen**: één regel per pauze (na n
werkdagen · n werkdagen pauze · van–tot · verwijderen), plus "Onderbreking toevoegen". Exacte
invoer naast de muis, dezelfde data als de Gantt. Eindigt in **kijkmoment 3**.

**Architecture:** Nieuwe sectie `src/components/task-sections/TaskSplitsSection.tsx` naast
`TaskDependenciesSection` (zelfde `ui-card-header`/`dependency-row`-stijl, `Trash2`/`Plus`-iconen).
Alle rekenwerk via `splitEdit.ts` (`toSplitPieces`, `setGapLength`, `setWorkLength`, `removeGap`,
`splitAt`, `canSplitTask`, `splitUnitMinutes`) en `taskSlice.setTaskSplits`. Van–tot-datums uit
`computeSplitSegments` (`splitWalk.ts`) op de effectieve taakkalender, weergegeven met
`useDisplayDate`. Spec §4; eigenaarsregels: geen losse bijschriften — een mededeling alleen als
gekleurd blok (`badge`-patroon van `TaskTimephasedNotice`), tekst via de zes rollen.

**Werkafspraken:** poorten op exitcode; geen `npm run verify`/`npm test`; nooit twee suites tegelijk;
`PATH` met nvm node v24; niet pushen; de dev-server op 3028 met rust laten; Nederlands.

---

### Task 1: De sectie

**Files:** Create `src/components/task-sections/TaskSplitsSection.tsx`; Modify
`src/components/panels/TaskPropertiesPanel.tsx` (mount direct ná `TaskDependenciesSection`);
`task.json` in ALLE 14 locales (sleutels onder `properties.splits.*`: `title` "Onderbrekingen",
`after` "na", `pause` "pauze", `add` "Onderbreking toevoegen", `remove` "Onderbreking verwijderen",
`readOnly` "Deze onderbrekingen komen uit het bronbestand in een vorm die hier niet bewerkt kan
worden.", `removeAll` "Alle onderbrekingen opheffen", `leveling` "nivellering", `unitDays`
"werkdagen", `unitHours` "uren").

- [ ] Zichtbaarheid: renderen als `task.splitGaps?.length` óf `canSplitTask(...) === null`. Bij een
  taak zonder pauzes: alleen de kop en de knop **Onderbreking toevoegen**.
- [ ] Per pauze i (uit `toSplitPieces`): `<input type="number">` "na" = som werk vóór de pauze in
  eenheden (dagen bij een dagtaak, uren bij een uurtaak — `splitUnitMinutes`), `<input type="number">`
  pauzelengte in eenheden, alleen-lezen van–tot (segment i+1 begint / eindigt, uit
  `computeSplitSegments`), verwijderknop (`removeGap`). Wijzigen van "na": dat is `setWorkLength`
  op werkstuk i met (nieuw − som eerdere werkstukken); wijzigen van de pauze: `setGapLength`;
  commit op blur/Enter via `setTaskSplits` (elke commit één undo-stap, geen coalesce). Een
  geweigerde bewerking (`ok: false`) zet de invoer terug op de huidige waarde.
- [ ] Kenmerk *nivellering* als `badge badge--gray` naast een `source: 'leveling'`-pauze.
- [ ] **Onderbreking toevoegen:** `splitAt` halverwege het langste werkstuk (gesnapt), pauze 1 eenheid;
  geweigerd (te kort) ⇒ knop uitgeschakeld.
- [ ] Niet-bewerkbaar (`canSplitTask` ⇒ `'not-editable'`): één `badge badge--gray`-blok met `readOnly`,
  invoervelden `disabled`, alleen de knop **Alle onderbrekingen opheffen** (`setTaskSplits(id, null)`).
  Andere weigeringen (mijlpaal, verzameltaak, …) ⇒ sectie niet renderen.
- [ ] Tekstgroottes via rollen (`!text-small` zoals de relatie-sectie). `data-ops-split-row={i}` op
  elke regel en `data-ops-split-add` op de knop, voor de test.
- [ ] `npm run typecheck`, `npm run lint`, `npm run verify:i18n`, `npm run verify:text-roles` exit 0.
  Commit: `Splits: sectie Onderbrekingen in het eigenschappenpaneel`.

### Task 2: Browsertest

**Files:** `tests/browser/task-split.spec.ts` (uitbreiden).
- [ ] Taak 5|3|5, paneel open (`showPropertiesPanel: true`, `rightPanelCollapsed: false`, taak
  geselecteerd): regel 0 toont "na" 5 en pauze 3 en de datums do 06-11 – wo 06-17 in de
  ingestelde notatie; pauze op 5 zetten + Enter ⇒ `gapMinutes` 2400; "na" op 4 ⇒ `afterMinutes`
  1920 en `scheduleDuration` 9; verwijderknop ⇒ `splitGaps` weg; **Onderbreking toevoegen** op een
  ongesplitste 10-daagse taak ⇒ één pauze van 1 dag na 5 dagen; Ctrl+Z per stap.
- [ ] `npm run test:browser -- task-split` exit 0. Commit: `Splits: browsertest voor de paneelsectie`.

### Task 3: Poorten
- [ ] `typecheck`, `lint`, `test:planning`, `verify:i18n`, `verify:text-roles`, `verify:store-boundaries`,
  `verify:cycles`, `verify:docs` — elk exit 0, sequentieel.
