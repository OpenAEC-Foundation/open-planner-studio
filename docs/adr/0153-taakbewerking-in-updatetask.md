# Een taakbewerking telt op haar uitkomst

`updateTask` is de patchroute voor één taak: onder meer het paneel, Taak bewerken en de extensie-API
(`api.data.updateTask`) schrijven erdoor. Taak bewerken stuurt bij OK zonder wijziging alle velden terug
(`state/taskDialogSave.ts`). We beslissen daarom op de uitkomst en niet op de invoer:
`updateTask` voegt de patch samen (`mergeTaskUpdate`), normaliseert de datums en vergelijkt met de taak
(`sameValue`). Is er per saldo niets veranderd, dan is de aanroep een no-op: geen undo-stap, geen gewijzigd document,
geen gevolgregel en geen melding. De gevolgregels (laag 3 en 4 ontkoppelen, nivelleergaten wissen, duurgevolgen)
vuren alleen op een waarde die echt verandert, niet op een meegestuurde sleutel (`taskTriggerChanges` in
`utils/taskDefaults.ts`, gedeeld met het taakraster en de MCP-draft). Tests: `check-value-based-triggers.ts`,
`check-task-trigger-changes.ts` en `task-dialog-no-op.spec.ts`.

## Gevolgen

- `time` wordt samengevoegd met de bestaande tijd en niet vervangen. Een gedeeltelijk tijdobject, zoals de extensie-API
  het kan geven, zou anders verplichte velden wissen.
- Een taak heeft een start nodig. Het raster weigert een lege start al (`required` in `taskEditPlan.ts`);
  `updateTask` is het vangnet onder paneel, Taak bewerken en extensie-API: bij een onleesbare `scheduleStart`
  (bijvoorbeeld `''` uit een leeggemaakt datumveld) houdt hij de bestaande start en voert hij de rest van de patch
  gewoon uit.
- Zet de patch `isMilestone` aan op een samenvattingstaak of een taak met toewijzingen die een mijlpaal niet mag
  dragen (`hasMilestoneBlockingAssignments`), dan weigert `updateTask` de
  hele patch met een melding (`milestoneRefusal`), zoals raster en MCP. Een halve patch, zoals duur 0 zonder de
  mijlpaalvlag, zou erger zijn.
- Een nieuwe duur korter dan het gedane werk van een lopende taak wordt geweigerd vóór de undo-stap
  (`durationEditRefusal`, zie de regel `taaktypes`).
- Een duur in werkdagen onder vast werk gaat naar de urenbron (`routeFixedWorkDurationToHours`) vóór de no-op-toets,
  zodat ook die de minuten ziet.
- Een kalenderwissel in de patch gaat eerst en apart (`captureCalendarChange` en `settleCalendarChange`); de
  momentopname voor een duurwijziging in dezelfde patch komt daarna, zodat die op de nieuwe kalender rekent. De basis
  van het ingevoerde einde (`hourInputFinishBasis`) wordt vóór de kalenderwissel gelezen, anders ziet
  `reconcileHourInputFinish` geen wijziging en blijft het einde op de oude kalender staan.
- `reconcileHourInputFinish` draait na `clearLevelingGaps`, anders telt het einde nivelleergaten mee die deze
  bewerking wist. `setTaskCalendar` volgt dezelfde volgorde.
- `workRule` gaat niet door de kale samenvoeging maar door `settleRuleChange`, zodat `updateTask(id, { workRule })`
  hetzelfde doet als `setTaskWorkRule`. Een gezette regel ontsluit de werkregels in de interface
  (`taskTypesVisible`).
- In de modus *datums zoals opgeslagen* laat een patch die alleen datumneutrale velden verandert
  (`DATE_NEUTRAL_TASK_FIELDS` in `state/taskDateChanges.ts`) de modus staan en de planning onveranderd. Maakt een
  werkregel een dagenmaat-taak urenmaat (`durationUnitChanged`), dan is dat planning en gaat de modus uit. Test:
  `check-recorded-dates.ts`, onderdeel 9D.
- `updateTask` werkt `childIds` niet bij; een ouderwissel gaat via `moveTask` (ADR 0151).
- Splitsen loopt niet door `updateTask` maar door `setTaskSplits` met het gedeelde lichaam `applyTaskSplits`
  (regel `gantt-splits`), omdat de gevolgregels van `updateTask` bij een tijdbasiswijziging de nivelleergaten wissen.
- Een onbekend taak-id geeft bij `setTaskSplits` de weigerreden `not-editable`; de aanroepers lossen het id zelf op
  vóór ze hier komen.
- Externe relaties volgen dezelfde regel: `updateExternalLink` vergelijkt na datumnormalisatie en doet niets als de
  relatie gelijk blijft; `removeExternalLink` doet niets als er niets weg is. Een echte wijziging aan een externe
  relatie maakt de planning verouderd.
- Meldingen staan buiten de Immer-producer, want `notify` doet zelf een `set()`.
