# Resources, belasting en kalenders lezen

`planner_list_resources` en `planner_get_calendars` geven de velden die de schrijftools aannemen, met dezelfde
namen (ADR 0100, 0101 en 0104), plus een paar afgeleide velden die de agent anders zelf zou moeten tellen. Waar de
schrijfkant iets weigert, laat de leeskant de reden al zien, zodat de agent die niet pas bij de weigering ontdekt.

## Gevolgen

- Per resource telt `planner_list_resources` de toewijzingen (`assignmentCount`), de taken met een toewijzing
  (`assignedTaskCount`) en de som van `unitsPerDay` (`totalUnitsPerDay`, op twee decimalen). Een kostenresource
  (`type: 'COST'`, #815) telt geen inzet; de som van haar `costAmount` staat als `totalCostAmount`, ook op twee
  decimalen. Toetsen: `cases-read.ts`, "list_resources: paginering + toewijzings-samenvatting kloppen" (de twee
  aantallen van de eerste resource) en `cases-resource-crud.ts`, "20d: leestools: …" (300 als `totalCostAmount`,
  geen `totalCostAmount` op een werkresource, en het histogram weigert het id van een kostenresource).
- Een resource met een herkomststempel krijgt een blok `library`: de naam van het bedrijf (`null` als het onbekend
  is), `status` uit `onOpenStatusForResource` en `lockedFields`, dat `RESOURCE_DIFF_FIELDS` is als
  `isResourceFieldLocked(status)` waar is, en anders leeg. Dat zijn dezelfde functies als het slot in het
  resourcepaneel en de weigering van `planner_manage_resources` (ADR 0103). `status: null` geeft geen slot; dat is
  zo als het stempel niet bij de bibliotheek van het project hoort of de bibliotheek niet geladen is. Toets:
  `cases-bibliotheek.ts`, "list_resources toont de herkomst en precies welke velden op slot zitten" (een resource
  uit de bibliotheek met `in-sync` en de vijf velden; een eigen resource zonder blok).
- Een kostenresource heeft geen belasting en dus geen histogram: `planner_get_resource_histogram` weigert haar id.
  De vensters en de capaciteit per venster staan in ADR 0314.
- `planner_get_calendars` geeft de projectkalender (`calendar`) en de kalenderlijst van het document (`calendars`)
  samen, één keer per id, de projectkalender eerst, elk als volledige `WorkCalendar` plus `isProjectDefault`, `usedByTasks` en
  `usedByResources`. Bij de projectkalender tellen ook de taken en resources zonder `calendarId` mee: ze rekenen
  op de projectkalender (`resolveCalendar`). Toets: `cases-read.ts`, "get_calendars: projectkalender met volledige
  definitie, …" (werkdagen, feestdagen en uren per dag gelijk aan de store, en alle taken, ook verzameltaken, in
  `usedByTasks`). Wat van die lezing terug te schrijven is, staat in ADR 0104.
