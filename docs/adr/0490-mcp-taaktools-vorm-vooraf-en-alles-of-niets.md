# De taaktools van MCP: de vorm vooraf, en per tool alles of niets of per item

De wijzigende tools in `src/services/mcp/tools/taskTools.ts` (`planner_add_tasks`, `planner_update_tasks`,
`planner_delete_tasks`, `planner_move_task`, `planner_add_dependencies`, `planner_remove_dependencies` en
`planner_set_task_splits`) volgen de indeling van ADR 0100: een vormvalidatie (`parseAddTasks`, `parseUpdateTasks`,
`parseIdList`, `parseMoveTask`, `parseAddDeps`, `parseSetTaskSplits`), een synchrone kern zonder transactie en een
`handler`. Elke handler doet zijn vormvalidatie vóór `runMutateTool`, dus vóór de AI-backup en de transactie: een
aanroep die op zijn vorm sneuvelt, maakt geen backup en geen undo-stap. Toetsen: `cases-mutate-tasks.ts`, "add_tasks:
dubbele tempId …" (de toets eist `VALIDATION`, een ongewijzigde momentopname en geen nieuwe undo-stap) en
`cases-taskfields.ts`, "knownbug 82: add_tasks weigert een expliciete duur op een nieuwe ouder …" (geen nieuwe
geschiedenisstap).

## Gevolgen

- In een batch maakt `parsedBatchStep` (`helpers.ts`) van een vormfout een `McpStepError` met `VALIDATION`, zodat de
  hele batch terugrolt. Toets: `cases-taskfields.ts`, "batch: mijlpaal + duration > 0 rolt de HELE batch terug …" (de
  eerste stap maakt een taak, de tweede een mijlpaal met duur; de toets eist `VALIDATION` en het aantal taken van
  vóór de batch).
- De kern geeft haar `data` en haar `itemRejections` (een `MutationOutcome`). Een losse aanroep die de transactie
  doorloopt, bouwt haar antwoord daarna opnieuw op met `enrichOk`: verse datums (`freshDates`, bij de tools die ze
  geven) en `projectEnd` uit de store na de transactie. Een batchstap geeft die niet, omdat de planning daar pas na
  de laatste stap doorrekent, of tussendoor met `recomputeMidBatch` (ADR 0240); `planner_batch` zet de `data` per stap
  in `steps[].data` en verzamelt de zachte weigeringen van alle stappen in `rejections`, met het stapnummer erbij.
  Neemt een losse aanroep het snelpad (hieronder), dan komt `projectEnd` uit de berekening die er al stond
  (`projectEndInfo`), zonder transactie en dus zonder eindberekening.
- Alles of niets geldt voor `planner_add_tasks` en `planner_set_task_splits`, de twee tools in `ATOMIC_ITEM_TOOLS`
  (`schemaValidate.ts`). Het antwoord van `planner_add_tasks` is de volledige koppeling van `tempId` naar id
  (`created`); een half geslaagde aanroep laat de aanroeper met een koppeling die hij niet kan gebruiken.
  `planner_set_task_splits` vervangt de hele lijst onderbrekingen van één taak: een onbekende taak is `NOT_FOUND`,
  elke andere weigering (van `planTaskSplits` of `draft.setTaskSplits`) `VALIDATION`. `planner_move_task` gaat over
  één taak en weigert hard (ADR 0493). De andere vier weigeren een fout item zacht (`itemRejections`), voor de fouten
  die hun classificatie toetst (voor de relaties: ADR 0494). Daarnaast faalt elke aanroep die de transactie doorloopt
  hard als de transactie zelf faalt, ook een aanroep met alleen geldige items: een fout in de kern of een eindberekening
  met een fout draait alles terug (ADR 0240).
- Het snelpad zonder transactie en backup (`okDirectGuarded`, ADR 0100) beslist op wat vooraf vaststaat. Bij
  `planner_update_tasks` is dat `classifyUpdate`: de taak bestaat, en `fields` (`resolveFieldsPatch`) of de vorm van
  `progress` (`parseProgress`) is aanvaardbaar. Een item dat pas in de kern wordt geweigerd, zoals een voortgang die
  `applyProgressUpdate` weigert of een duur korter dan het gedane werk, telt als uitvoerbaar: dan loopt de aanroep door
  `runMutateTool`, met de backupstap (`ensureBackup`), en zonder datawijziging maakt de transactie geen undo-stap
  (ADR 0240). Bij `planner_delete_tasks` en `planner_remove_dependencies` neemt het snelpad een aanroep waarin geen
  enkel id bestaat, bij `planner_add_dependencies` een aanroep zonder kandidaat na `classifyDeps`. In een batch is er
  geen snelpad (ADR 0100).
- `planner_set_task_splits` draait de guards (`guardNonTransactional`: pauze, alleen lezen, open dialoog, drift) vóór
  `planSplitsFor`, en `planSplitsFor` vóór `runMutateTool`. Een geblokkeerde bridge geeft dan haar eigen fout, een plan
  wordt niet gekeurd tegen de taken van een ander document dan het anker, en een geweigerd plan maakt geen backup. De
  kern (`setTaskSplitsCore`) keurt het plan in de transactie opnieuw met `planSplitsFor`. Dat is ook de enige keuring
  van het plan in een batchstap, die niet langs de handler gaat; in de losse aanroep ligt de backup, een `await`,
  tussen de twee keuringen. Bij de andere tools komt de vormvalidatie vóór de guards; een ongeldige aanroep krijgt daar
  ook met een gepauzeerde bridge `VALIDATION`. `parseAddTasks` leest daarbij de store (kalenders, eigen taaktypen) van
  het actieve document.
- `planner_undo` en `planner_redo` lopen niet door de transactie (ADR 0240), wel eerst door
  `guardNonTransactional`. Ze roepen `undo` of `redo` van de store aan op de gedeelde sessiegeschiedenis van het
  actieve document. Die doen niets als er geen toepasbare stap is, zonder melding; `historyStep` zet daarom `undone`
  of `redone` op de uitkomst van "de diepte vóór de aanroep (`historyDepthsForActiveScope`) is groter dan 0", geeft
  beide dieptes van daarna mee, en bij `false` een `reason`. Toetsen: `cases-stille-noops-taken.ts`, de gevallen K5.
