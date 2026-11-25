# De belasting boekt op de plaatsing van de taak, dagslots alleen zonder werkblokken

`computeResourceLoad` en `computeHistogramReport` (`src/engine/scheduler/ResourceLoad.ts`) boeken een toewijzing op
de plaatsing van haar taak: `taskLoadPlacement` op de kalender van de taak (`createTaskEngineCache`), één keer per
taak per aanroep (`taskPlacementCache`), en per toewijzing `assignmentLoadOnPlacement`. De nivelleerder gebruikt
dezelfde twee functies voor elke kandidaat (ADR 0162). Zo delen histogram en nivelleerder één verdeling, zoals de
spec alleen uren vraagt (`docs/superpowers/specs/2026-10-20-alleen-uren-design.md`, §3.11). Een kalender zonder
opgeslagen werkblokken krijgt voor de engine afgeleide blokken uit haar scalaire velden (`calendarForEngine` in
`utils/effectiveWorkTime.ts`); beslissend is `engine.isHourMode` na die afleiding. Is die onwaar, dan geeft
`taskLoadPlacement` `null` en boekt `dayslotLoad` de dagslots van ADR 0311 op de werkdagen van `taskWorkDayIsos`. De
nivelleerder heeft dezelfde tak met `dayslotLoad`, maar bereikt die niet meer (knownbug 507). Een onleesbare start
geeft een lege plaatsing, dus geen belasting.

## Gevolgen

- De maat van de plaatsing komt uit het rekenprofiel van het project (`LoadOptions`, spec §3.14), zoals bij de solver;
  `runCPM` geeft `input.schedulingOptions` mee en `recomputeResourceLoad` `effectiveSchedulingOptions(project)`
  (`scheduleSlice.ts`). Het argument is verplicht, ook in `HistogramInput.schedulingOptions`. Volgens het weggehaalde
  commentaar telde een P6- of MSP-project bij een stille terugval op het OPS-profiel als OPS: een dagtaak over een
  korte vrijdag landde dan helemaal op vrijdag, terwijl de solver op maandag eindigt.
- Een taak die niet onder `placementFollowsSpan` (`workPlacement.ts`) valt, krijgt haar actuele duur vanaf
  `earlyStart`; een verouderd `earlyFinish` begrenst de plaatsing niet. `check-resource-load-splits.ts` toetst via
  `computeResourceLoad` dat zo'n taak na haar duur geen last krijgt als `earlyFinish` later ligt, en dat een taak in
  kalendertijd (deel c) en een voltooide taak (deel d) niet voorbij `earlyFinish` boeken.
- `taskWorkDayIsos` op de dagslotroute neemt bij kalendertijd en bij een voltooide taak (`isPinnedComplete`) de
  werkdagen van `earlyStart` tot en met `earlyFinish` zonder splits (`enumerateWorkDays`): bij kalendertijd telt
  `scheduleDuration` kalenderdagen, en bij een voltooide taak komt het einde uit de werkelijke datums. Elke andere taak
  krijgt daar `enumerateTaskWorkDays` vanaf `earlyStart`, met de splits, ook een taak die op de plaatsing haar
  berekende spanne volgt (`placementFollowsSpan`; ADR 0162).
- `ResourceLoadResult.hours` is per resource de geboekte eenheden maal de uren per dag van de taakkalender. Op een
  plaatsing komt het werk uit `assignmentPlacementWork`, dat een rest van het bronwerk buiten de afgeronde spanne
  (`PlacementDay.residueMinutes`) meetelt; de belasting telt die rest niet. De kolom Totaal in het resourcepaneel
  rekent voor een werk- of materiaalresource deze uren maal tarief (`resourceCostTotals`), omdat de uren per dag van
  de projectkalender afwijken bij een taak op een eigen kalender (`check-resource-cost-hours.ts`); voor een
  kostenresource telt ze de bedragen op haar toewijzingen op (`costAmount`).
- `DailyLoad` heeft een sleutel voor elke dag die een toewijzing boekt, ook met 0 eenheden, en voor geen andere dag.
- `computeReliableResourceLoad` geeft `null` als de berekening een fout gaf (`cpmResult.error`), omdat de taakdatums
  dan geen geldige planning zijn. Zonder berekening (`cpmResult` is `null`) rekent ze op de datums die er staan.
