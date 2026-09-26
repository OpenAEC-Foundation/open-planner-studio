---
paths:
  - "src/engine/work/**"
  - "src/types/workRule.ts"
  - "src/state/calendarTasks.ts"
  - "src/state/taskTypesNotice.ts"
  - "src/state/taskTypesVisibility.ts"
  - "src/state/gridTransaction.ts"
  - "src/state/runtime/createMcpTransactions.ts"
  - "src/state/slices/taskSlice.ts"
  - "src/state/slices/resourceSlice.ts"
  - "src/components/task-sections/TaskWorkRuleField.tsx"
  - "src/components/task-sections/TaskAssignmentsSection.tsx"
  - "src/utils/taskDefaults.ts"
  - "tests/planning/check-work-*"
  - "tests/mcp/cases-work-rule.ts"
  - "tests/browser/work-rule.spec.ts"
---

<!-- Verplaatst uit CLAUDE.md bij de merge van de rules-structuur in PR #170 (taaktypes-etappe). Laadt alleen
wanneer Claude een bestand leest dat op `paths` past. De contour-kant staat in de `contour`-rule. -->

### Werkregels (taaktypes): duur, inzet en werk als driehoek

Spec: `docs/superpowers/specs/2026-09-04-spec-taaktypes-opgeslagen-werk.md`. `Task.workRule` ∈
FIXED_DURATION_RATE (standaard, het gedrag van vóór de etappe) | FIXED_DURATION_WORK | FIXED_WORK |
FIXED_RATE, anders `Project.defaultWorkRule`. De pure kern `src/engine/work/workTriangle.ts` werkt op de
RESTERENDE toestand (werk = restduur × inzet; W en I opgeslagen, R afgeleid en naar boven afgerond op hele
dagen/minuten); de brug `src/engine/work/workRuleApply.ts` (`captureTriangle` vóór de mutatie → `settle…`
erna) is op vier plekken bedraad: `taskSlice.updateTask`/`setTaskWorkRule`,
`resourceSlice.assignResource`/`updateAssignment`/`unassignResource`/`moveAssignment`/`removeResource`/
`setAssignmentWork`, `gridTransaction.ts` en de MCP-tweeling in `createMcpTransactions.ts`.

Een duur die uit de driehoek komt (inzet/werk/resource erbij-eraf onder FIXED_WORK/FIXED_RATE) zet
`scheduleStale` en loopt door `settleDurationAftermath` (contour + importsplits herschalen, Z8-venster en
bevroren walks wissen), precies als een duurbewerking; op een gestarte taak wordt de rest dan expliciet
geschreven (`remainingTime`/`remainingMinutes`) zodat niets drift. Een voortgangsbewerking is géén
duurbewerking (de poort is de totale werkduur). Verandert het restwerk van een toewijzing mét contour, dan
zakt de contourhoogte mee (`reconcileContourWork`, "vorm blijft, hoogte zakt"). Materiaalresources sturen
de duur nooit.

Een **kalenderwissel** (taak-/projectkalender of andere uren per dag in een kalender) verandert de
slotgrootte en loopt daarna óók door de regel (`applySlotChange`/`settleCalendarChange`: Vast werk/Vaste
inzet ⇒ duur; Vaste duur en werk ⇒ inzet; standaard ⇒ werk volgt, byte-identiek); de contour-as herschaalt
daarbij van de oude naar de nieuwe werkminuten (ook zonder dagverandering), en een project-/kalender-
wijziging die duren verandert meldt hoeveel (`notifyWorkRuleDurationsChanged`). Alle aanroepers delen
`captureCalendarChange` → mutatie → `settleCalendarChange` (store, raster — als EIGEN stap vóór de rest van
de paste —, MCP-tweeling, projectkalender, kalenderinhoud, en de hele bibliotheek via
`captureCalendarLibraryChange`/`settleCalendarLibraryChange` in `state/calendarTasks.ts`:
`commitCalendarLibrary` — de kalenderdialoog, dé UI-route voor uren per dag — en `removeCalendar`); de
contourhoogte wordt daarin tegen het werkelijke werk per toewijzing verzoend, niet tegen een regelvlag.
Drie randpaden die de slot óók kunnen wijzigen (`setCalendar`, `resolveDeviation`, de `workTime`-
verwijdering in de MCP-kalendertool) zijn bewust NIET bedraad — zie `docs/TODO.md`.

Een duurbewerking op een taak met EXPLICIETE restduur schuift die rest mee met Δ, geklemd op 0
(`carryRemainingThroughDurationEdit`). Schrijft de brug de rest expliciet — Δ-regel of kalenderwissel op een
gestarte taak — dan volgt `completion` daaruit als 1 − rest ÷ duur (`syncCompletionToRemaining`, dezelfde
formule als een restbewerking in het raster; eigenaarsbesluit 2026-09-06), zodat Gantt-balk, solver en
rapportage één waarheid delen — eigenaarsbesluiten 2026-09-05/06, spec §6.4/§6.5, meetlat 32–36.

Regressie: `tests/planning/check-work-triangle.ts` (kern + meetlat `work-triangle-cases.json`),
`check-work-rule-mapping.ts` (MSP/P6/XER-vertaling) en `check-work-rule-store.ts` (store/raster/MCP). Via de
MCP-bridge: `planner_update_tasks`/`planner_add_tasks` `fields.workRule`, `planner_manage_assignments`
`update.remainingWorkMinutes` en `planner_update_project` `defaultWorkRule` (`tests/mcp/cases-work-rule.ts`).

UI: zichtbaar wanneer de instelling **Toon werkregels en werk** (Planning → Berekenen; `ui.showTaskTypes`,
`ops-showTaskTypes`, default uit) aan staat óf het document zelf taaktypedata draagt (`taskTypesVisible` in
`DOCUMENT_FIELDS`, afgeleid bij laden via `hasTaskTypeData`); gemeld wordt dat alleen bij opgeslagen werk,
een projectstandaard of een eigen regel (`taskTypesNeedNotice`, E4 — een uit het importveld afgeleide regel
ontsluit stil), één keer per document (`taskTypesNotice.ts`); selector `taskTypesUnlocked`
(`src/state/taskTypesVisibility.ts`). Dan: `TaskWorkRuleField` in paneel en dialoog, de kolom **Werk
(rest)** met slotjes in `TaskAssignmentsSection`, en de rasterkolommen `task.workRule` en
`assignment.remainingWork` (alleen `available` wanneer ontsloten; `TaskColumnContext.taskTypesUnlocked`).
Gids: `public/docs/{nl,en}/gids-taaktypes.md`; browserspec `tests/browser/work-rule.spec.ts`.
