# De draftprimitieven van de MCP-transactie: geen eigen undo-stap, en een fout waar de store stil terugvalt

De MCP-tools wijzigen de planning met de methoden van `draft` in `createMcpTransactions.ts`. De meeste zijn de
tegenhanger van een store-actie en delen waar het kan haar lichaam (`assignmentMutations.ts`, `splitMutations.ts`,
`projectPatch.ts`, `writeLevelingResult`). Geen ervan roept `beginUndoable`, `finishMutation` of `runCPM` aan: de
transactie neemt één momentopname vooraf en rekent aan het eind (ADR 0240). Zo blijft een batch van veel
stappen één undo-stap. Een methode werkt daarom alleen binnen de `run` van haar eigen factory:
de `Proxy` om de draft vraagt bij elke aanroep eerst de lease op, vóór de methode een id maakt of de store raakt, en
gooit buiten zo'n `run` (`cases-draft.ts`, de draft buiten zijn eigen run). Een draftprimitief zet `scheduleStale`
niet: bij een datawijziging rekent `run` zelf door, behalve met `keepsRecordedDates`, en daar mag de vlag niet aan
(regel `state`, *datums zoals opgeslagen*).

Waar de store-actie een fout in de invoer stil laat passeren, door niets te doen of door door te gaan zoals
`taskSlice.addTask` bij een onbekende ouder, gooit de draftmethode in de regel een herkenbare fout; de uitzonderingen
staan hieronder. Een batch die naar een ouder wijst die niet bestaat, is een fout, en geen taak die toch stil wordt
aangemaakt. De throw bereikt `run`, die alles terugdraait. De tools toetsen hun invoer vooraf
(`state/mcpValidation.ts` en de classificatie per tool, ADR 0100) en weigeren daar met een leesbare reden; de throw
in de draft is het laatste vangnet.

## Gevolgen

- `draft.addTask` gooit bij een opgegeven `parentId` die niet bestaat, vóór er iets gemuteerd is.
  `taskSlice.addTask` maakt de taak dan wel aan.
- `draft.updateTaskFields`, `draft.patchTaskFields` en `draft.deleteTask` doen bij een onbekend id niets, zoals de
  store: een patch zonder effect is geen fout in de structuur.
- Een inhoudelijke weigering is een terugkeerwaarde, geen throw: een duur korter dan het gedane werk
  (`McpDurationProgressOutcome` met `refused`), een split die `taskSplitRefusal` weigert (`SplitRefusal`) en een
  relatie die `relationVerdict` weigert (`null` uit `draft.addSequence`). De tool beslist wat ze ermee doet:
  `planner_update_tasks` weigert dat ene item, `planner_set_task_splits` geeft een `VALIDATION`-fout.
- `draft.addSequence` doet de kringtoets van de store (`relationAddVerdict` in `sequenceSlice.ts`) niet.
  `planner_add_dependencies` toetst een kring vooraf over de bestaande en alle nieuwe relaties samen
  (`validate.noCycle` in `mcpValidation.ts`), en een kring die toch de eindberekening haalt, geeft `cpmResult.error`
  en draait de transactie terug.
- `draft.updateResource` gooit bij een ongeldige `maxUnits`, waar `resourceSlice.updateResource` dat ene veld uit de
  patch haalt en de rest doorvoert. In het paneel is dat gemak tijdens het tikken; via de bridge zou juist het veld
  verdwijnen dat de aanroeper wilde zetten. Een sleutel met `undefined` verwijdert het veld (ADR 0101).
  `draft.updateAssignment` houdt wel de regel van de store: `acceptedAssignmentPatch` haalt een ongeldige
  `unitsPerDay` uit de patch en een `curve` in dezelfde patch gaat door.
- `draft.setProject` laat de no-op-toets van `projectSlice.setProject` (`projectChanges`) weg: `run` meet zelf of
  er per saldo iets veranderde (ADR 0240).
- `draft.removeResource` geeft de verwijderde toewijzingen, de geraakte taken en de ploegleden die hun ploeg
  verloren terug, gemeten vóór het verwijderen, zodat de tool kan melden wat er meeging. Een cascade die het antwoord
  niet noemt, leest als "er gebeurde verder niets".
