# Een wijzigende MCP-tool heeft één kern voor de losse aanroep en de batchstap

Een wijzigende `planner_*`-tool moet los werken en als stap van `planner_batch`, en die twee mogen niet uit elkaar
lopen. Elke tool bestaat daarom uit drie delen: de vormvalidatie (`parseX`, een string is de reden van weigering),
een synchrone kern zonder transactie (`xCore`, levert een `MutationOutcome`) en de `handler` (guards, backup en de
transactie via `runMutateTool`). `batchStep` gebruikt via `parsedBatchStep` dezelfde vormvalidatie en dezelfde kern.
Bij een bulktool zit de beslissing per item in één gedeelde classificatie (`classifyX`) die zowel het snelpad als de
kern voedt, zodat beide precies dezelfde weigeringen geven. Zo heeft elke mutatie één implementatie.

## Gevolgen

- Een bulktool weigert per item zacht (`itemRejections`): één fout item rolt de geldige items in dezelfde aanroep
  niet terug. Een fout in de aanroep als geheel, of een toestand die de classificatie had moeten uitsluiten, is hard
  (`McpStepError` in de kern, `toolError` in de handler).
- Lege-batch-snelpad: de handler classificeert eerst. Is er geen enkel uitvoerbaar item, dan antwoordt hij direct
  met de weigeringen (`okDirectGuarded`), zonder transactie en zonder backup. Hetzelfde geldt voor een tool zonder
  effect: `planner_clear_leveling` zonder nivelleeruitvoer en `planner_move_project` naar de datum waar het project
  al begint. Binnen een batch is dat snelpad overbodig, want de batch bezit de transactie al. Alleen
  `planner_move_project` draagt zijn pad zonder verschuiving ook in de kern: anders zou zo'n stap de hele batch laten
  terugrollen.
- `enrichOk` bouwt het antwoord na de transactie opnieuw op uit de verse store. Wat ook een batchstap moet melden
  (`anchorsClamped`, `hourMeasureTaskIds`, `statusDateNote` van `planner_update_project`), zet de kern zelf in
  `data`, want het batchpad kent geen `enrichOk`.
- Nooit `ok` zonder effect. Een update zonder velden, een onbekend id en een onbekende sleutel worden geweigerd. De
  reden noemt de sleutel en de geldige keuzes (de toegestane sleutels, de geldige enumwaarden), zodat de agent zich
  in één ronde kan verbeteren. Booleans die gedrag omzetten (`dryRun`, `shiftBaselines`, `cascade`) worden streng
  getoetst, want een andere waarde zou stil als `false` gelden.
- De schrijfkant gebruikt de veldnamen van de leeskant: `assignmentId`, `unitsPerDay` en `curve` zoals
  `planner_get_task` ze geeft, de resourcevelden zoals `planner_list_resources`, de kalendervelden zoals
  `planner_get_calendars`. Een agent stopt wat hij las zo rechtstreeks terug.
- De schemapoort toetst de binnenkant van array-items niet (recept `docs/recepten/mcp-tool.md`). De tool doet dat
  zelf, vóór elke mutatie, en geeft een leesbare weigering per item in plaats van een fout diep in de mutatie die de
  hele aanroep terugrolt. Een onbekende curve (`"bell"` in plaats van `"BELL"`) is zo'n geval.
