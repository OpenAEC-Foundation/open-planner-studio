# De leestools geven een compact antwoord in de vorm die de schrijftools aannemen

De leestools in `src/services/mcp/tools/readTools.ts` geven JSON die over de bridge gaat, en het overzicht en de
lijsten groeien met het project mee. Een optioneel veld komt daarom alleen mee als het iets zegt. Op de rijen van
`planner_get_project_overview` en `planner_list_tasks` staan `prog` (boven 0), `crit` (waar, of `null` als het
onbekend is, ADR 0403) en `ms` alleen bij een waarde, en in de lijst ook `summary` en `ext`; op een geneste rij van
het overzicht staan `depth`, `parent` en `parentId`, een wortel heeft diepte 1. In `planner_get_task` staan de
importvelden, de werkregel, de P6-velden, de constraints en de optionele velden van een toewijzing alleen als ze
gezet zijn. Wat een leestool laat zien, moet een agent zonder omzetting aan een schrijftool kunnen geven: elke rij
draagt het `id` waarop de wijzigende tools sleutelen, en de notatie van relaties en onderbrekingen komt uit dezelfde
module als die de schrijfkant leest. Een tweede kopie van die notatie in de leestool kan uit de pas lopen met wat de
schrijfkant aanneemt.

## Gevolgen

- Het overzicht geeft elke relatie één keer, bij haar voorganger, als `→<wbs van de opvolger> <type><lag> #<seq-id>`
  (`relShort`). Zo staat de hele relatiegraaf in één antwoord, met de id's die `planner_update_dependencies` en
  `planner_remove_dependencies` nemen; zonder id zou de agent alsnog `planner_get_task` per taak moeten vragen.
  Toets: `cases-read.ts`, "get_project_overview: elke taak aanwezig; …" (A → B met FS+2d en een losse C; de toets
  eist één relatie in alle `rels` samen, de notatie met `#<seq-id>` en het `id` op de rij).
- De rijen van het overzicht staan in boomvolgorde (`flattenOrder`), met `depth` en `parentId`: `parent` is de
  WBS-code van de ouder, en die is bij vrije of dubbele codes niet eenduidig. `parent` blijft staan voor bestaande
  clients. Dat de store na een P6- of IFC-import met de samenvattingen begint, komt uit het weggehaalde commentaar en
  is niet nagegaan. Toets: `cases-read.ts`, "get_project_overview: rijen in boomvolgorde met depth en parentId …"
  (R, S1, a; de toets eist die volgorde, diepte 1, 2 en 3, geen `depth` op de wortel, `parentId` als id en `parent`
  als WBS-code).
- Relatietype en lag komen uit `seqAbbrev` en `lagLabel` in `sequenceFields.ts`, waar ook `normalizeSeqType` en
  `parseLag` staan, die ze aannemen. De onderbrekingen van `planner_get_task` komen uit `interruptionsOf` in
  `splitFields.ts`, naast `planTaskSplits` van `planner_set_task_splits`. Een gatenlijst die het bewerkmodel niet
  draagt, geeft geen `interruptions` maar `splitsEditable: false`, naast de rauwe `splitGaps`. Bekende grenzen:
  knownbug 354 (minutenlag) en 2472 (een onderbreking op een deel van een eenheid).
- Zes importvelden zijn leesbaar, ook al weigert `fields` van `planner_update_tasks` ze (`REJECT_HINTS` in
  `taskFields.ts`): `manuallyScheduled`, `splitGaps`, `levelingDelayMinutes`, `mspTaskType`, `effortDriven` en
  `timephasedContours`. Anders kan een agent een geïmporteerd project niet inspecteren. Toets: `cases-read.ts`,
  "get_task: .mpp-importvelden …" (gezet: elk veld aanwezig met zijn waarde; niet gezet: geen van de zes).
- Dat een leestool een verouderde planning eerst doorrekent, staat in de beschrijving van `planner_get_project_info`
  en in `MCP_INSTRUCTIONS` (`dispatcher.ts`), niet in die van elke leestool (#818). De site krijgt alleen de
  tooldefinities (`siteAppToolDefinitions`, ook `mcp-tools.json`) en geen `MCP_INSTRUCTIONS`, daarom staat de zin
  ook in een tooltekst. De uitzonderingen meldt de envelop: `scheduleNote` in "datums zoals opgeslagen" en tijdens
  een bewerking, `scheduleError` bij een rekenfout (`buildEnvelope` en `runReadTool` in `runtime.ts`). Hoe het
  doorrekenen werkt, staat in `docs/recepten/mcp-tool.md`. `planner_list_resources` en `planner_get_calendars`
  geven alleen invoer en rekenen niet door (zonder `FRESH`).
