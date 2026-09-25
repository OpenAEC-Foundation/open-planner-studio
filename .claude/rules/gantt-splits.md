---
paths:
  - "src/engine/renderer/**"
  - "src/components/canvas/**"
  - "src/components/task-grid/**"
  - "src/engine/scheduler/split*.ts"
  - "src/components/task-sections/TaskSplitsSection.tsx"
  - "src/services/mcp/tools/splitFields.ts"
  - "src/state/slices/taskSlice.ts"
---

<!-- Verplaatst uit CLAUDE.md (2026-09): laadt alleen wanneer Claude een bestand leest dat op `paths` past. Inhoud overgenomen; kruisverwijzingen wijzen naar het betreffende rules-bestand. -->

### Rendering: Gantt-tijdlijn in Canvas 2D, taakraster in de DOM

De Gantt-tijdlijn wordt imperatief op een `<canvas>` getekend via `src/engine/renderer/` (`GanttRenderer`): balken, relaties, tijdschaal en hit-testing horen daar. De taakrijen links van de tijdlijn zijn juist het gedeelde DOM-raster `FullTaskGrid`, via `GanttTaskGrid`; het volledige lint-tabblad **Tabel** gebruikt dezelfde kern. React beheert daarnaast de omringende chrome, panelen en dialogen.

**Taken splitsen (issue #146)** is één bewerkmodel met drie oppervlakken. `src/engine/scheduler/splitEdit.ts` (puur) vertaalt `Task.splitGaps` (de H1-as, waar elk gat meetelt in de positie van het volgende — zie `splitWalk.ts`) naar STUKKEN werk/pauze/werk en terug, en bevat alle bewerkingen (`splitAt`, `setGapLength`, `setWorkLength`, `removeGap`) plus `canSplitTask`; geen oppervlak rekent zelf op `afterMinutes`/`gapMinutes`. Het ENE schrijflichaam is `applyTaskSplits` in `src/state/splitMutations.ts` (contour verhuist mee, eigen `scheduleFinish` direct bijgewerkt, laag 3/4 gewist), met `taskSplitRefusal` als gedeelde weigering. Twee aanroepers: `taskSlice.setTaskSplits` (undo met `coalesceKey` per sleepgebaar, `markScheduleStale`, meldt verloren MSP-sturing zelf) en de MCP-draft `draft.setTaskSplits` (transactie bezit undo en herberekening; verloren sturing gaat via de lease naar `envelope.timephasedGuidanceLost`). Oppervlakken: de splits-modus (`ui.showSplitMode`, knop **Taak splitsen**) met `useSplitGesture` en het stuk-/randslepen in `useBarDrag` in de Gantt, de sectie `TaskSplitsSection` in het eigenschappenpaneel, en de MCP-tool `planner_set_task_splits` (`splitFields.ts`). Een gebruikersgat draagt `source: 'user'`; bewerken adopteert nivelleergaten van die taak. Een niet-wélgevormde gatenlijst (overlap, gat op/voorbij het werktotaal) is **alleen-lezen** — nooit stil normaliseren, alleen opheffen. MSPDI/P6 kennen een split alleen als contour: zonder contour meldt de export het verlies (`exportSplitsLostNotice`).
