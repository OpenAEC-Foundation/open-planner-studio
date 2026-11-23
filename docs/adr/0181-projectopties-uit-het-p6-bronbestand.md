# Projectopties uit een P6-bestand: geen verzonnen anker en een smalle poort

De lezers van `.xer` en P6 XML vullen drie projectopties uit het bronbestand (beide via `deriveXerScheduleOptions` in
`src/services/xer/xerScheduleOptions.ts`); Projectinstellingen toont ze alleen-lezen onder *Instellingen uit het
bronbestand*: `useExpectedFinishDates`, `useProjectEndDateForFloat` en `p6CompletedLateFromRemainingWindow` (A21).
Wat ze doen, staat in de gids `ref-rekenopties-en-conventies.md` en in de ADR's 0012, 0027 en 0028. Hier staan de
keuzes in de lezer die een lezer zonder uitleg zou terugdraaien, en de grens van het bewijs.

## Gevolgen

- `useProjectEndDateForFloat` aan zonder `PROJECT.plan_end_date`: de XER-lezer laat `project.endDate` leeg en
  verzint geen einde uit het laatste geplande taakeinde (`readXER`, de berekening van `projectEnd`). Een verzonnen
  anker maskeert fouten aan de vroege kant. De solver rekent dan op het netwerkeinde (ADR 0012). Heeft het bestand
  ook geen enkele doeleinddatum op een taak, dan zet `deriveXerScheduleOptions` de optie uit en meldt dat als
  terugval; de bronwaarde blijft in `retainedSource`.
- A21 is gemeten op één bestand, `rehab-2.xer` (P3-uitvoer), onder Retained Logic (ADR 0027). De rest van het
  corpus beschermt alleen de poort van de B3-route (`explainP6CompletedDataDateWindowResolved` in
  `p6CompletedTargetWindow.ts`, met de eisen die ADR 0027 noemt). Die poort is een samenhang in de meting, geen
  mechanisme van P6: in `cases-p6-verified.json` geval 09 (een open voorganger met een voltooide opvolger) houdt de
  voltooide opvolger in P6 haar werkelijke datums als late datums, tegen de regel van A21 in. Verruim de poort dus
  niet zonder meting.
- Omdat alleen Retained Logic gemeten is, laat `deriveXerScheduleOptions` A21 alleen aan als `declaresRetainedLogic`
  waar is: `sched_retained_logic` leeg of Y, en `sched_progress_override` leeg of N. In elk ander geval zet hij A21
  uit.
- `startToStartLagFrom` komt uit `SCHEDOPTIONS.sched_lag_early_start_flag`: N geeft `actualStart`, Y of leeg
  `earlyStart`. Bron voor de twee varianten: Oracle P6 Help, *Calculate Start-to-Start lag from*
  (https://docs.oracle.com/cd/G18294_01/p6help/en/99348.htm). De achterwaartse kant van `actualStart` is niet tegen
  P6 gemeten (knownbug 1966). Het is een projectoptie en geen conventie, omdat de keuze per bestand verschilt.
- `criticalDefinition.thresholdHours` bewaart een P6-drempel in bronuren en gaat voor `threshold` als beide gezet
  zijn (`computeScheduleResults` in `scheduleAnalysis.ts`).
