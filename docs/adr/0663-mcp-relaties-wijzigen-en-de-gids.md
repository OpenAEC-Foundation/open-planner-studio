# Relaties wijzigen via MCP en de planningsgids

`planner_update_dependencies` (`dependencyTools.ts`) wijzigt een relatie op haar plek, zodat haar id blijft en het
één undo-stap is. De kern (`updateDependenciesCore`) schrijft met `store.setState` binnen de transactie en niet via de
store-actie `updateSequence`: die neemt een eigen undo-stap en geeft bij een botsing met een bestaande relatie alleen
`false` terug, zonder reden. De tool weigert zo'n botsing zelf per item (`classifyDepUpdates`).

## Gevolgen

- De weigering van een relatie tussen een taak en een eigen voorouder geldt alleen voor een eindpunt dat de aanroep
  verandert. Een bestaande relatie met zo'n eindpunt, bijvoorbeeld uit een import, moet nog van type en lag te
  wijzigen zijn, en verhangen weg van een voorouder blijft het herstelpad. Daar staat geen tweede toets onder: de kern
  schrijft de eindpunten zelf.
- Een procentlag van 0 (`"+0%"`) wordt een gewone daglag 0 (`parseLag` in `sequenceFields.ts`). De leeskant toont
  `lagPercent: 0` als geen lag, dus die waarde zou niet terug te schrijven zijn.
- `planner_get_planning_guide` (`guideTools.ts`) gaat niet door `runReadTool` en dus niet door de dialoogguard: ze leest
  de planning niet, en ze is juist nuttig terwijl er een dialoog openstaat. De skill `goed-plannen` houdt haar
  Nederlandse naam, omdat oudere versies van de app hem onder dat pad installeren.
