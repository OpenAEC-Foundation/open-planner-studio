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
- De kern geeft alleen haar `data`. De verse datums (`freshDates`, bij de tools die ze geven) en `projectEnd` komen
  alleen in het antwoord van de losse aanroep, via `enrichOk` na de transactie: binnen een batch rekent de planning pas aan het eind door, of
  tussendoor met `recomputeMidBatch` (ADR 0240), dus datums per stap zouden daar oud zijn.
- Alles of niets geldt voor `planner_add_tasks` en `planner_set_task_splits`, de twee tools in `ATOMIC_ITEM_TOOLS`
  (`schemaValidate.ts`). Het antwoord van `planner_add_tasks` is de volledige koppeling van `tempId` naar id
  (`created`); een half geslaagde aanroep laat de aanroeper met een koppeling die hij niet kan gebruiken.
  `planner_set_task_splits` vervangt de hele lijst onderbrekingen van één taak: een onbekende taak is `NOT_FOUND`,
  elke andere weigering (van `planTaskSplits` of `draft.setTaskSplits`) `VALIDATION`. `planner_move_task` gaat over één taak en weigert hard
  (ADR 0493). De andere vier weigeren per item zacht (`itemRejections`); bij `planner_add_dependencies` maakt alleen
  een kring de hele aanroep ongedaan (ADR 0494).
- Het snelpad zonder transactie en backup (`okDirectGuarded`, ADR 0100) beslist op wat vooraf vaststaat. Bij
  `planner_update_tasks` is dat `classifyUpdate`: de taak bestaat, en `fields` (`resolveFieldsPatch`) of de vorm van
  `progress` (`parseProgress`) is aanvaardbaar. Een item dat pas in de kern wordt geweigerd, zoals een voortgang die
  `applyProgressUpdate` weigert of een duur korter dan het gedane werk, telt als uitvoerbaar: dan loopt de aanroep door
  `runMutateTool`, met de backupstap (`ensureBackup`), en zonder datawijziging maakt de transactie geen undo-stap
  (ADR 0240). Bij `planner_delete_tasks` en `planner_remove_dependencies` neemt het snelpad een aanroep waarin geen
  enkel id bestaat, bij `planner_add_dependencies` een aanroep zonder kandidaat na `classifyDeps`.
- `planner_set_task_splits` draait de guards (`guardNonTransactional`: pauze, alleen lezen, open dialoog, drift) vóór
  `planSplitsFor`. Een geblokkeerde bridge geeft dan haar eigen fout, en een plan wordt niet gekeurd tegen de taken
  van een ander document dan het anker. Bij de andere tools komt de vormvalidatie vóór de guards; een ongeldige
  aanroep krijgt daar ook met een gepauzeerde bridge `VALIDATION`. `parseAddTasks` leest daarbij de store (kalenders,
  eigen taaktypen) van het actieve document.
- `planner_undo` en `planner_redo` lopen niet door de transactie (ADR 0240), wel eerst door
  `guardNonTransactional`. Ze roepen `undo` of `redo` van de store aan op de gedeelde sessiegeschiedenis van het
  actieve document. Die doen niets als er geen toepasbare stap is, zonder melding; `historyStep` zet daarom `undone`
  of `redone` op waar alleen als de diepte vóór de aanroep (`historyDepthsForActiveScope`) groter dan 0 was, geeft
  beide dieptes van daarna mee en anders een `reason`. Toetsen: `cases-stille-noops-taken.ts`, de gevallen K5.
