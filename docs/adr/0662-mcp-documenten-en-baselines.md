# De documenttools en het baselinebeheer van MCP

De AI-assistent kan documenten opsommen, maken, dupliceren en wisselen (`documentTools.ts`), maar geen document
sluiten en niet beslissen over opslaan: die tools zijn er bewust niet. Of een documenttool eerst op drift weigert,
hangt af van of ze de inhoud van het actieve document gebruikt. `planner_duplicate_document` doet dat en draait de
volle guard met drift, want na een tabwissel van de gebruiker zou ze stil de verkeerde planning kopiëren;
`planner_switch_document` is juist de bevestiging die drift oplost, en `planner_new_document` maakt een leeg
document. Alleen lezen (`ui.aiReadOnly`) blokkeert ook deze tools, hoewel ze de planning niet wijzigen: een nieuw
document of een wissel is een zichtbare wijziging van de werkomgeving van de gebruiker.

## Gevolgen

- `planner_list_documents` meldt `notCalculated` op `cpmResult == null` en niet op `scheduleStale`. Een verouderd
  document met een rekenresultaat is wel doorgerekend en kan een einddatum leveren; een document uit
  crashherstel staat bijvoorbeeld als verouderd gemarkeerd.
- `projectName` in het antwoord van `planner_duplicate_document` is het kale `project.name`, ook als het leeg is: een
  lege naam is een signaal waar de agent iets mee kan. De weergavenaam met terugval staat in `title`.
- `planner_delete_baseline` neemt één id per aanroep, anders dan `planner_delete_tasks`: een baseline is niet uit het
  huidige plan terug te bouwen, en wie haar verwijdert, verlegt de meetlat. Het antwoord leest daarna de actieve
  baseline uit de store, omdat de slice bij het verwijderen van de actieve terugvalt op de laatst overgebleven
  baseline; `planner_compare_baseline` meet daarna tegen een andere.
- `planner_activate_baseline` aanvaardt `baselineId: null`: dat zet de actieve baseline uit en behoudt de
  baselines, zoals in de app. `planner_rename_baseline` staat een dubbele naam toe, zoals de app, en meldt hem.
