# Kritiek pad, baselinevergelijking en vertraging lezen

`planner_get_critical_path`, `planner_compare_baseline` en `planner_analyze_delay` geven een oordeel over de hele
planning, en een agent neemt dat oordeel over in wat hij de planner vertelt. Ze zeggen daarom wat onbekend is in
plaats van een nul of een lege lijst te geven, en ze geven het opleveringseffect als één getal, zodat de agent het
niet zelf uit taakdelta's optelt.

## Gevolgen

- `criticalTasks` volgt `cpmResult.criticalPath`, dat de solver in zijn rekenvolgorde opbouwt (`order` in
  `scheduleAnalysis.ts`); de beschrijving noemt dat de topologische volgorde. `drivingRelations` geeft alleen de
  bepalende relaties waarvan beide eindpunten kritiek zijn. Toets: `cases-read.ts`, "get_critical_path:
  driving-relaties hebben BEIDE eindpunten kritiek" (een benchmark van 500 taken; per relatie beide eindpunten in
  `criticalTasks`, en `pathsMode: 'merged'` zonder `criticalPaths`). Wat `null` en `[]` betekenen: ADR 0403.
- Gescheiden parallelle ketens bestaan alleen met `floatPaths.enabled` en `method: 'FREE_FLOAT'`: alleen dan pelt
  `scheduleAnalysis.ts` ketens af, en anders is `criticalPaths` één lijst, gelijk aan `criticalPath`. Het antwoord
  zegt welke stand geldt (`pathsMode`); alleen bij `parallel` komen `criticalPaths` (als WBS-codes) en
  `criticalPathIds` mee. Een keten reconstrueren in de stand `merged` laat de tool aan de client. Geen toets dekt de
  stand `parallel`. Een grens in "datums zoals opgeslagen": knownbug 2329.
- Speling staat in werkdagen van de taakkalender, ook bij een urentaak (`CPMSolver.signedFloat`: gemeten werkdagen
  voor een taak die in werkdagen telt, anders werkminuten gedeeld door uren per dag maal 60); een taak in
  kalendertijd (ELAPSEDTIME) telt in dagen van 24 uur (`signedElapsedSpan`). De zin `FLOAT_UNIT_NOTE` staat in de
  beschrijving van `planner_get_task` en `planner_get_critical_path`, want zonder eenheid leest een agent
  `freeFloat: 0.5` als een half uur (council-ronde 3 op #836). Toets: `cases-uurkalender.ts`, "speling van een
  uurtaak staat in werkdagen: …" (4 uur naast een taak van 8 uur; de toets eist 0.5 en de zin in beide
  beschrijvingen).
- Zonder actieve baseline weigeren `planner_compare_baseline` en `planner_analyze_delay` met `VALIDATION`, en de
  weigering noemt de bestaande baselinetools (`planner_save_baseline`, `planner_activate_baseline`,
  `planner_list_baselines`), zodat de agent een weg heeft. Geen toets houdt die namen tegen de registry.
- De delta's komen uit `computeVariance` met een `CalendarEngine` op de projectkalender, dus in werkdagen van de
  huidige projectkalender, ook voor een taak op een andere kalender. De beschrijving zegt daarom dat na een
  kalenderwijziging de richting telt en niet de grootte. `planner_compare_baseline` geeft alleen de taken waarvan de
  status niet `onSchedule` is. Toets: `cases-read.ts`, "compare_baseline: levert alleen afwijkers + projectEndDelta".
- `planner_analyze_delay` geeft als kritieke schuivers de afwijkende taken die op het huidige kritieke pad liggen,
  elk met haar eigen delta. Het opleveringseffect is `projectEndDelta` alleen, nooit de som van die delta's: in een
  keten schuift elke taak mee, en de som telt dezelfde vertraging per taak opnieuw. Zonder doorgerekend projecteinde
  in de baseline is het `null` met `projectEndDeltaAvailable: false` en een `note`, onbekend en niet 0. Toetsen:
  `cases-read.ts`, "analyze_delay: projectEndDelta = opleveringseffect, …" (A → B → C, A vijf werkdagen langer; de
  toets eist 5 en een som van de delta's die daarvan verschilt) en "analyze_delay: baseline zonder projecteinde …"
  (de toets eist `null` en een `note`).
