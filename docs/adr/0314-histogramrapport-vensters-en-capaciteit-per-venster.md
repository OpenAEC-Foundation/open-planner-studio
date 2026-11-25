# Het histogramrapport: dezelfde verdeling, eigen vensters en capaciteit per venster

`computeHistogramReport` (`src/engine/scheduler/ResourceLoad.ts`; aangeroepen door de MCP-tool
`planner_get_resource_histogram` en het rapport `resourceLoading.ts`; `resourceAssignments.ts` leest de toewijzingen
zelf) rekent een eigen ronde naast `computeResourceLoad`. De verdeling deelt hij: dezelfde filter (geen
kostenresource, geen mijlpaal, geen samenvattingstaak), de contourkoppeling zonder kostentoewijzingen
(`contourSiblings`), één plaatsing per taak en `assignmentDaily` (ADR 0312), zodat de bijdragen per toewijzing
(`causes`) optellen tot de dagbelasting. Zelf doet hij de vensters per dag, ISO-week of maand, en de capaciteit van
een venster over alle werkdagen van dat venster op de resourcekalender (`enumerateWorkDays` maal `maxUnitsOn`), ook
de onbelaste. Met alleen de belaste dagen, zoals `computeResourceLoad` capaciteit geeft, valt de capaciteit van een
week te laag uit (`tests/mcp/cases-histogram.ts`, eis 4: capaciteit 2 per dag, vijf werkdagen, twee belaste dagen,
capaciteit 10).

## Gevolgen

- Een venster geeft de som van de belasting (`load`) en de hoogste dag (`peakDayLoad`, vanaf 0), zodat een piek van
  één dag niet in de weeksom verdwijnt (eis 3). `overallocatedDays` is per dag, ook in een week- of maandvenster: op
  een belaste dag de belasting tegen `maxUnitsOn` op een werkdag van de resourcekalender en 0 op een andere dag, met
  `exceedsCapacity`. `causes` staat er alleen bij een venster met een overbezette dag en noemt de toewijzingen met een
  bijdrage groter dan 0 op die dagen (eis 1 en 2).
- Het rapport heeft een regel per resource uit `resourceIds`, in de volgorde van `resources`, en zonder lijst of met
  een lege lijst (`resourceIds: []`) voor alle resources; een kostenresource krijgt geen regel (`resourceHasLoad`).
- `histogramWindows` neemt voor een ontbrekende `from` de vroegste `earlyStart` en voor een ontbrekende `to` het
  laatste `earlyFinish` van de taken. `loadSpan` (de eerste en de laatste dag met belasting groter dan 0) verbreedt
  alleen een ontbrekende grens, omdat bij een verouderde planning de belasting voorbij het oude `earlyFinish` kan
  lopen (ADR 0312); een meegegeven grens blijft staan. `check-f3b-production-compat.ts` toetst dat het automatische
  dagvenster na een duurwijziging ook dinsdag toont terwijl het oude `earlyFinish` maandag is. De vensters tegelen de
  spanne zonder gat en zonder overlap: een dag, een week van maandag tot en met zondag (`getWeekStart`) of een
  kalendermaand. Een week- of maandvenster is altijd volledig, ook bij een meegegeven grens: met `from` 3 juni en `to`
  4 juni 2026 geeft `histogramWindows` het weekvenster 1 tot en met 7 juni, en belasting en capaciteit tellen dan over
  die hele week. De lussen stoppen na 100.000 week- of maandvensters en na 1.000.000 dagvensters. `windowIndexOf`
  zoekt binair en rekent op die volgorde.
- `readTools.ts` begrenst alleen het detailpad (een `van`, een `tot` of een niet-lege `resourceIds` meegegeven): vóór
  het rekenen schat het het aantal vensters met `histogramWindows` zonder `loadSpan`, vermenigvuldigt dat met het
  aantal resources (de lengte van `resourceIds`, of anders alle resources) en weigert boven `MAX_HISTOGRAM_BUCKETS`
  (10.000).
- `enumerateWorkDays` geeft de werkdagen van begin tot en met einde, met een eigen grens `MAX_DAYS` van 200.000,
  dezelfde waarde als `CalendarEngine.MAX_DAYS` (ADR 0220). Omdat de lus de teller pas na een dag ophoogt en stopt bij
  `++guard > MAX_DAYS`, bekijkt ze hoogstens 200.001 kalenderdagen.
