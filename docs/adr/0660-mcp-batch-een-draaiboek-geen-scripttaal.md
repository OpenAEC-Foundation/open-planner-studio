# planner_batch: een draaiboek zonder scripttaal, met een eigen schemapoort per stap

`planner_batch` (`src/services/mcp/tools/batchTool.ts`) neemt een vaste lijst stappen `{ tool, args }` en geen
scripttaal met lussen of expressies. Een scripttaal zou een tweede, zwakkere sandbox naast het extensiesysteem zijn,
met een undo- en beveiligingsgedrag dat niemand overziet; wie wil programmeren, gebruikt een extensie. Verwijzingen
tussen stappen lopen alleen via tempId's die een eerdere stap in `created` teruggeeft.

## Gevolgen

- De schemapoort (`validateToolArgs`) draait in de stappenloop (`executeSteps`), na `resolveTempIds`, en niet vooraf in
  `checkExclusions`. Vooraf zou een `tmp-…`-verwijzing nog op een id-plek staan en een schema dat daar meer eist dan
  een string, valselijk weigeren; en een ongeldige stap hoort in het rapport per stap, net als een onbekende tool.
- Een tempId moet met `tmp-` of `tmp_` beginnen (`TEMP_ID_PATTERN`, `helpers.ts`), en onder de sleutels van
  `NO_REWRITE_KEYS` (namen, notities, codes en andere vrije tekst) herschrijft `resolveTempIds` niets, ook niet dieper
  in die tak. Zonder die twee grenzen zou een `add_tasks` met `tempId: 'Fundering'` van een latere naam "Fundering"
  stil een taak-id maken.
- `planner_list_documents` staat in `BLOCKED_STEP_NAMES`, hoewel het alleen leest: het beschrijft andere documenten dan
  het document van de batch, die de batch niet doorrekent, dus de cijfers zouden vers lijken terwijl ze dat niet zijn.
  Als losse aanroep werkt de tool gewoon.
- Een batch met een lees- of nivelleerstap rekent een verouderde planning vóór de transactie door (ADR 0240, onder de voorwaarden van
  `ensureFreshScheduleForRead`), ook als
  die stap na een mutatie staat. Alleen doorrekenen bij een leesstap vóór de eerste mutatie scheelt soms één
  berekening, maar dan leest [mutatie zonder effect, leesstap] oude datums: zonder effect draait `recomputeMidBatch`
  niet, en binnen de transactie kan niet meer zonder undo-stap worden bijgerekend (`cases-undo-noop.ts`).
