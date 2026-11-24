# De draftprimitieven van de MCP-transactie: geen eigen undo-stap, en een fout waar de store stil doorgaat

De methoden van `draft` in `createMcpTransactions.ts` zijn de interne laag onder de toolkernen en draaien binnen `run`
(ADR 0240). Geen ervan roept `beginUndoable`, `finishMutation` of `runCPM` aan, zodat een `planner_batch` met veel
stappen één undo-stap blijft; waar het kan delen ze het lichaam van de store-actie (`assignmentMutations.ts`,
`splitMutations.ts`, `projectPatch.ts`, `writeLevelingResult`). Een draftmethode zet `scheduleStale` niet: rekenen is
aan `run`. De `Proxy` om de draft vraagt bij elke aanroep eerst de lease van de eigen factory op, vóór de methode een id
maakt of de store raakt, en gooit buiten een `run` van die factory. Toets: `cases-draft.ts`, "contextdraft buiten zijn
eigen actieve run …" (zonder lopende `run` roept hij `draft.addTask` aan; de toets eist een fout en een ongewijzigde
documentinhoud). Dat de controle vóór het maken van een id staat, toetst hij niet.

Waar de store-actie een fout in de invoer stil laat passeren, gooit de draftmethode in de regel een fout, die `run` laat
terugdraaien. Een batch die naar een ouder wijst die niet bestaat, is een fout, en geen taak die toch wordt aangemaakt:
`draft.addTask` gooit, `taskSlice.addTask` maakt haar aan. De publieke tools toetsen hun invoer vooraf
(`state/mcpValidation.ts` en de classificatie per tool, ADR 0100); de throw in de draft is het laatste vangnet.

## Gevolgen

- `draft.updateTaskFields`, `draft.patchTaskFields` en `draft.deleteTask` doen bij een onbekend id niets, zoals de
  store: een patch zonder effect is geen fout in de structuur.
- Een inhoudelijke weigering is een terugkeerwaarde, geen throw: `refused` in `McpDurationProgressOutcome`, een
  `SplitRefusal` uit `draft.setTaskSplits` en `null` uit `draft.addSequence`. Wat er dan gebeurt, beslist de publieke
  tool: `planner_update_tasks` weigert bij `refused` de `fields` van dat item en verwerkt een `progress` in hetzelfde
  item nog; `planner_set_task_splits` geeft een `VALIDATION`-fout.
- `draft.addSequence` doet de kringtoets van de store (`relationAddVerdict` in `sequenceSlice.ts`) niet.
  `planner_add_dependencies` toetst een kring vooraf over de bestaande en de nieuwe relaties samen (`validate.noCycle`),
  en een kring die toch de eindberekening haalt, geeft `cpmResult.error` en laat `run` terugdraaien.
- `draft.updateResource` gooit bij een ongeldige `maxUnits`, waar `resourceSlice.updateResource` dat veld uit de patch
  haalt en de rest doorvoert. In het paneel is dat gemak tijdens het tikken; via de bridge zou juist het veld verdwijnen
  dat de aanroeper wilde zetten. `draft.updateAssignment` houdt wel de regel van de store (`acceptedAssignmentPatch`).
- `draft.setProject` laat de no-op-toets van `projectSlice.setProject` (`projectChanges`) weg: `run` meet de uitkomst
  zelf.
- `draft.removeResource` geeft terug wat er meeging (toewijzingen, taken, ploegleden), gemeten vóór het verwijderen,
  zodat de tool het kan melden. Een cascade die het antwoord niet noemt, leest als "er gebeurde verder niets".
