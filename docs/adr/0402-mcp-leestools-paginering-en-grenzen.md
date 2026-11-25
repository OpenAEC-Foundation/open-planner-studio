# Paginering en grenzen van de leestools

`planner_list_tasks` en `planner_list_resources` pagineren altijd: `limit` is een geheel getal van 1 tot en met 1000,
standaard 50, `offset` een geheel getal vanaf 0, en het antwoord draagt `total`, `has_more` en `next_offset`, dat
`null` is zodra er niets meer volgt (`paginate`, `requirePageArgs`). `planner_get_critical_path`,
`planner_compare_baseline` en `planner_analyze_delay` geven zonder `limit` en `offset` hun hele lijst, en antwoorden
dan zonder paginavelden; met minstens één van de twee pagineren ze met dezelfde regels en velden (`optionalPage`,
#818). Zo heeft de assistent van de site, die een leesantwoord boven 30.000 tekens weigert
(`SITE_APP_MAX_RESPONSE_CHARS` in `siteAppTools.ts`), een uitweg die werkt. `planner_get_project_overview` heeft
bewust geen paginering; de uitweg is `planner_list_tasks` (knownbug 851).

## Gevolgen

- Het schema zegt `number`, de handler eist een geheel getal. Daarom zegt de beschrijving "integer"
  (`optionalPageNote`, en in de beschrijving van `planner_list_tasks`).
- Op het kritieke pad loopt de pagina over `criticalTasks`; een bepalende relatie staat op de pagina van haar
  opvolger, zodat elke relatie op precies één pagina staat. `criticalPaths` blijft op elke pagina compleet
  (knownbug 851). Toets: `cases-read.ts`, "optionele limit/offset: …" (een keten van 12 taken in pagina's van 5;
  de toets eist dat zonder pagina geen `total` en `has_more` meekomen, dat de pagina's samen de hele lijst zijn, dat
  elke relatie op één pagina staat, dat alleen `offset` met standaard 50 pagineert, en `VALIDATION` bij `limit: 0` en
  bij een onbekende sleutel).
- Het histogram geeft zonder niet-lege `resourceIds` en zonder venster (`van`/`tot`) een samenvatting per resource in plaats van
  vensters, want een eerste aanroep over een groot project zou anders per resource honderden rijen geven. De
  samenvatting rekent in dagvensters, zodat `peakDate` de dag van de hoogste dagbelasting is, en verbergt geen piek:
  `peakLoad`, `peakDate`, `overallocatedDayCount`, `loadSum`, `capacitySum` en de spanne, met `detailAvailable: true`
  en een hint. Toets: `cases-read.ts`, "get_resource_histogram: ongescopt …" (2500 taken; de toets eist per resource
  de velden zonder `buckets`, minstens één piek boven 0 en minder dan 20 KB).
- Met niet-lege `resourceIds` of een venster geeft het histogram vensters per resource, tot `MAX_HISTOGRAM_BUCKETS` (10.000):
  het aantal vensters keer het aantal gevraagde resources, of alle resources zonder `resourceIds`. Dat is ruim genoeg
  voor 25 resources een jaar in dagen of 190 resources een jaar in weken. Daarboven `VALIDATION` met de uitweg
  (kleiner venster, minder resources, een grovere `bucket` of niets voor de samenvatting). De grens wordt getoetst na
  het doorrekenen van de planning en vóór `computeHistogramReport`. Toets: `cases-read.ts`, "get_resource_histogram:
  detail boven 10000 buckets …" (1900 tot en met 2100 in dagen over alle resources geeft `VALIDATION` met de grens en
  de uitweg; één resource een jaar in dagen geeft 365 vensters).
