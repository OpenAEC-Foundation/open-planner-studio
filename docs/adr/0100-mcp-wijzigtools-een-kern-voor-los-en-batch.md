# Een wijzigende MCP-tool heeft één kern voor de losse aanroep en de batchstap

Een wijzigende `planner_*`-tool moet los werken en als stap van `planner_batch`, en die twee mogen niet uit elkaar
lopen. De tools in `calendarResourceTools.ts` en `resourceTools.ts` bestaan daarom uit drie delen: de vormvalidatie
(`parseX`, een string is de reden van weigering), een synchrone kern zonder transactie (`xCore`, levert een
`MutationOutcome`) en de `handler` (guards, backup en de transactie via `runMutateTool`). `batchStep` gebruikt via
`parsedBatchStep` dezelfde vormvalidatie en dezelfde kern. Bij een bulktool zit de beslissing per item in één
gedeelde classificatie (`classifyX`) die zowel het snelpad als de kern voedt, zodat beide dezelfde weigeringen geven.
Zo heeft elke mutatie één implementatie.

## Gevolgen

- Een bulktool weigert per item zacht (`itemRejections`): één fout item rolt de geldige items in dezelfde aanroep
  niet terug. Een fout in de aanroep als geheel, of een toestand die de classificatie had moeten uitsluiten, is hard
  (`McpStepError` in de kern, `toolError` in de handler).
- Een aanroep zonder effect maakt geen undo-stap. De transactie zelf laat een aanroep zonder datawijziging ongemoeid;
  daarvóór antwoordt de handler direct (`okDirectGuarded`, zonder transactie en backup) als er geen enkel uitvoerbaar
  item is, bij `planner_clear_leveling` zonder nivelleeruitvoer en bij `planner_move_project` naar de datum waar het
  project al begint. In een batch bezit de batch de transactie en is dat snelpad overbodig; alleen
  `planner_move_project` draagt zijn pad zonder verschuiving ook in de kern, anders zou zo'n stap de batch laten
  terugrollen.
- Het antwoord van een losse aanroep bouwt `enrichOk` na de transactie opnieuw op uit de verse store, met de
  waarschuwingen (zoals `cappedTaskIds`, geërfde feestdagen, verwijderde toewijzingen, verouderde nivellering) en het
  projecteinde. Een batchstap geeft alleen de `data` van de kern, zonder die waarschuwingen. Wat ook een batchstap moet
  melden (`anchorsClamped`, `hourMeasureTaskIds`, `statusDateNote` van `planner_update_project`), zet de kern zelf in
  `data`.
- Wat de validatie afdwingt, verschilt per tool en staat in de code van die tool. Onbekende sleutels worden geweigerd
  met de lijst van wat wel mag in `planner_manage_resources` (per actie), `planner_update_calendar` (per item) en
  `planner_update_project`; de schemapoort weigert alleen onbekende sleutels op het hoogste niveau bij de twee tools
  met `additionalProperties: false` (`planner_manage_resources`, `planner_update_project`).
  `planner_manage_assignments` kent geen lijst: een onbekende sleutel in een actie wordt genegeerd (knownbug 962).
  Een wijziging zonder velden wordt geweigerd door `planner_manage_resources` (`update`), `planner_update_calendar`
  (een bestaand id zonder inhoudsveld), `planner_manage_assignments` (`update` zonder inzet, curve of werk, of zonder
  `costAmount` bij een kostenresource) en `planner_update_project`.
- Een weigering noemt de geldige keuzes waar de tool ze kent (de toegestane sleutels, de geldige enumwaarden), zodat
  de agent zich in één ronde kan verbeteren. Booleans die gedrag omzetten (`dryRun`, `constrainToFloat`,
  `shiftBaselines`, `cascade`) worden streng getoetst, want een andere waarde zou stil als `false` gelden.
- De schrijfkant gebruikt de veldnamen van de leeskant: `assignmentId`, `unitsPerDay` en `curve` zoals
  `planner_get_task` ze geeft, de resourcevelden zoals `planner_list_resources`, de kalendervelden zoals
  `planner_get_calendars` (zie ADR 0104 voor wat daarvan overdraagbaar is).
- De schemapoort toetst de binnenkant van array-items niet (de diepte-regel in `docs/recepten/mcp-tool.md`). De tool
  doet dat zelf, vóór elke mutatie, en geeft een leesbare weigering per item in plaats van een fout in de mutatie die de
  hele aanroep terugrolt. Een onbekende curve (`"bell"` in plaats van `"BELL"`) is zo'n geval.
