# Capaciteit op de resourcekalender, en de reden van een overbezette dag

`computeResourceLoad` (`src/engine/scheduler/ResourceLoad.ts`) rekent de capaciteit van een resource op haar eigen
kalender (`resolveCalendar`: haar `calendarId`, zonder of bij een onbekende id de projectkalender), niet op de
taakkalender: op een werkdag `maxUnitsOn`, op een andere dag 0. Een dag is overbezet als
`exceedsCapacity(belasting, capaciteit)` waar is (`capacityTolerance.ts`): de belasting ligt meer dan de marge
`CAPACITY_EPS` boven de capaciteit. Boekt een taak op haar eigen kalender belasting op een dag die de resourcekalender
geen werkdag noemt, dan is die dag dus overbezet zodra die belasting boven de marge komt; een geboekt slot met 0
eenheden geeft geen conflict. Dat is bewust: de resource kan daar niet werken, dus het conflict is echt.
`overallocatedReasons` geeft alleen voor een overbezette dag een reden: `non-working-day` als de resourcekalender
die dag geen werkdag heeft (`isWorkDay`, dezelfde vraag als voor de capaciteit), en anders `over-capacity`. De reden
komt uit een eigen verzameling niet-werkdagen per resource en niet uit capaciteit 0, omdat een stap in
`availabilitySteps` naar 0 op een werkdag ook capaciteit 0 geeft en dan `over-capacity` is.
`check-resource-load-reasons.ts` toetst beide redenen, deel d de stap naar 0.

## Gevolgen

- Een toewijzing aan een resource-id dat niet in `resources` staat, kan via een import binnenkomen
  (`payloadFromImport` filtert de toewijzingen niet op bekende resources). Ze krijgt
  capaciteit 0 en de reden `over-capacity`: voor haar is geen kalender opgezocht, dus er is geen grond voor
  `non-working-day` (`check-resource-load-reasons.ts`, deel e).
- `capacity` heeft alleen sleutels voor de dagen in `load` van die resource. Het histogramrapport telt de capaciteit
  van een venster zelf (ADR 0314).
- Niet mee tellen: toewijzingen van een kostenresource (`costResourceIds`, issue #815) en toewijzingen op een onbekende
  taak, een samenvattingstaak (`isLeafTask`) of een mijlpaal. `resourceSlice.assignResource` weigert een
  samenvattingstaak, en een mijlpaal behalve voor een kostenresource; de filter vangt een oud bestand op.
- Materiaal telt mee voor de overbezetting. De nivelleerder laat materiaal en kostenresources weg (`resourceIsLevelable`
  in `levelResources`).
- `maxUnitsOn` geeft zonder `availabilitySteps` de vlakke `maxUnits`. Met stappen geeft ze de stap met de grootste
  `from` op of vóór de datum, bij gelijke `from` de laatste in de lijst, en vóór de eerste stap `maxUnits`; de lijst
  hoeft niet gesorteerd te zijn. Ze vindt die stap in één doorloop over de lijst, zonder per aanroep te kopiëren en te
  sorteren, omdat ze per resource per dag draait; de uitkomst is die van een stabiele sortering op `from`. Dezelfde
  functie gebruiken de nivelleerder, het histogramrapport en de bibliotheekbezetting (`occupancy.ts`,
  `distribute.ts`). `mspdiAvailability.ts` roept haar niet aan: `normalizedSteps` bereikt dezelfde voorrang zelf, met
  een eigen controle van datum en waarde, één stap per dag via `Map.set` en een sortering op `from`.
- De stappen volgen de capaciteit met ingangsdatum van P6 (`availabilitySteps` in
  `docs/superpowers/specs/2026-07-03-resources-design.md`: "P6 Units-and-Prices-model, effective-dated"). De
  XER-lezer leest ze uit de `RSRCRATE`-rijen van een resource, met de ingangsdatum uit `start_date` en de capaciteit
  afgeleid uit `max_qty_per_hr` (`xerResources.ts`).
