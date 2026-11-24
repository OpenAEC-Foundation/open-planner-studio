# Een taakbewerking telt op haar uitkomst

`updateTask` is de patchroute voor één taak: onder meer het paneel, Taak bewerken en de extensie-API
(`api.data.updateTask`) schrijven erdoor. Taak bewerken stuurt bij OK zonder wijziging alle velden terug
(`state/taskDialogSave.ts`). We beslissen daarom op de uitkomst en niet op de invoer: `updateTask` voegt de patch samen
(`mergeTaskUpdate`), normaliseert de datums en vergelijkt met de taak (`sameValue`). Is er per saldo niets veranderd,
dan maakt hij geen undo-stap en laat hij het document ongemoeid. Wanneer een gevolgregel vuurt (laag 3 en 4
ontkoppelen, nivelleergaten wissen, duurgevolgen), beslist `taskTriggerChanges` in `utils/taskDefaults.ts` op de
waarde en niet op een meegestuurde sleutel; het taakraster en de MCP-draft gebruiken dezelfde functie. Tests:
`check-value-based-triggers.ts`, `check-task-trigger-changes.ts` en `task-dialog-no-op.spec.ts`.

## Gevolgen

- `time` wordt samengevoegd met de bestaande tijd (`mergeTaskTime`) en niet vervangen. Een gedeeltelijk tijdobject,
  zoals de extensie-API het kan geven, zou anders verplichte velden wissen.
- Een taak heeft een start nodig. Het raster weigert een lege start al (`required` in `taskEditPlan.ts`);
  `updateTask` is het vangnet onder paneel, Taak bewerken en extensie-API: bij een onleesbare `scheduleStart` houdt hij
  de bestaande start en voert hij de rest van de patch uit.
- Zet de patch `isMilestone` aan waar `milestoneRefusal` weigert, dan weigert `updateTask` de hele patch met een
  melding. Raster en MCP gebruiken dezelfde `milestoneRefusal`. Een halve patch, zoals duur 0 zonder de
  mijlpaalvlag, zou erger zijn.
- Een nieuwe duur korter dan het gedane werk wordt geweigerd vóór de undo-stap (`durationEditRefusal`, zie de regel
  `taaktypes`).
- De volgorde in `updateTask` is een besluit. `routeFixedWorkDurationToHours` draait vóór de no-op-toets, zodat ook die
  de minuten ziet. Een kalenderwissel in de patch gaat vóór de momentopname van een duurwijziging, zodat die op de
  nieuwe kalender rekent. `hourInputFinishBasis` wordt vóór de kalenderwissel gelezen, anders ziet
  `reconcileHourInputFinish` geen wijziging. `reconcileHourInputFinish` draait na `clearLevelingGaps`, anders telt het
  einde nivelleergaten mee die deze bewerking wist; `setTaskCalendar` houdt dezelfde volgorde aan.
- `updateTask(id, { workRule })` en `setTaskWorkRule` delen `settleRuleChange`. Ze verschillen in wanneer de planning
  verouderd raakt: zie `finishMutation` in elk van beide.
- In de modus *datums zoals opgeslagen* laat een patch die alleen velden uit `DATE_NEUTRAL_TASK_FIELDS`
  (`state/taskDateChanges.ts`) verandert de modus staan. Meldt `settleRuleChange` een maatwijziging
  (`durationUnitChanged`), dan geldt de patch als planning. Test: `check-recorded-dates.ts`, onderdeel 9D.
- `updateTask` werkt `childIds` niet bij; een ouderwissel gaat via `moveTask` (ADR 0151).
- Splitsen loopt niet door `updateTask` maar door `setTaskSplits` met het gedeelde lichaam `applyTaskSplits` (regel
  `gantt-splits`): een splitbewerking neemt de nivelleergaten van de taak over, terwijl `updateTask` bij een wijziging
  van de tijdbasis `clearLevelingGaps` aanroept.
- Bij `setTaskSplits` geeft een onbekend taak-id de weigerreden `not-editable`; er is geen eigen reden voor.
- Bij externe relaties vergelijkt `updateExternalLink` na datumnormalisatie (`sameExternalLink`) en doet niets als de
  relatie gelijk blijft; `removeExternalLink` doet niets als er geen relatie weggaat.
- Meldingen staan buiten de Immer-producer, want `notify` doet zelf een `set()`.
