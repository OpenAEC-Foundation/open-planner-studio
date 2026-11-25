# De vastlegging van "datums zoals opgeslagen" zegt alleen wat het bestand zei

Openen rekent altijd door, en daarna is niet meer te zien wat het bestand vastlegde. `captureRecordedDates`
(`src/engine/scheduler/recordedDates.ts`) legt daarom per taak vast wat het bestand zei, met als regel: nooit iets
beweren wat het bestand niet zegt. Een verzonnen datum of een verzonnen 0 ziet er in de modus uit als een
opgeslagen waarde. Bij IFC is de aanwezigheidsregistratie van de lezer (`ImportResult.recordedFields`) de enige
bron voor "dit stond er", want `parseDateFromIFC` leest een `$`-slot als vandaag (ADR 0042). De functie leest
`task.time` van de taken die ze krijgt; `applyLoadedProject` (`fileSlice.ts`) geeft haar daarom de taken van vóór
de berekening bij het laden, die `prepareLoadedPayload` niet verandert omdat die op een kloon rekent
(`cloneTasksForSolve`).

## Gevolgen

- Krijgt de functie `recordedTimes` (ook een leeg object), dan is dat het antwoord, beperkt tot de id's die in
  `tasks` staan, en raadpleegt ze `recordedFields` niet, ook niet voor taken zonder record. Zo worden de twee
  kanalen nooit per taak gemengd. `readIFC` levert bij een XER-bronarchief beide (ADR 0048); dan telt alleen
  `recordedTimes`. Op deze route voegt de functie alleen bij een hammock `hammockDuration` toe; een record krijgt
  hier geen `summaryProgress` en geen spelingminuten (de bronlezers vullen geen minuten). Toets:
  `check-recorded-dates.ts` §1B.
- Zonder `recordedTimes` kiest de functie per taak met een entry in `recordedFields` één laag voor `start` en
  `finish`: beide slots `earlyStart` en `earlyFinish` aanwezig, dan die; anders, als `opts.scheduleLayer` niet
  `false` is, beide slots `scheduleStart` en `scheduleFinish`; anders geen uitspraak (de taak staat niet in
  `times` en telt niet mee in `total`). Een half paar wordt nooit met de andere laag aangevuld: zo'n combinatie
  heeft het bestand nooit gezegd en kan een einde vóór de start geven. Een taak zonder `IfcTaskTime` heeft een lege
  lijst en valt dus weg. Toets: `check-recorded-dates.ts` §1 (1p tot en met 1u).
- `recordedDatesSource` (`documentActivation.ts`) geeft `scheduleLayer: false` voor de herkomsten `ifc` en
  `ifc-own`, omdat `ScheduleStart`/`ScheduleFinish` daar invoer is en geen rekenuitvoer. De andere aanroepers
  (`lateDatesInFile` in `externalSource.ts` en de vastlegging voor de minutenomzetting in `applyLoadedProject` en in
  het crashherstel van `documentSlice.ts`) geven geen opties mee en gebruiken de standaard `true`.
- `lateStart`, `lateFinish`, `totalFloat`, `freeFloat` en `isCritical` komen elk alleen mee als hun eigen slot
  aanwezig is, los van de gekozen laag. De spelingminuten komen alleen mee als het slot van hun dagen-as aanwezig is
  én de taak minuten draagt; de IFC-lezer neemt die uit `OPS_Analysis.ExactFloat` en leidt ze nergens af
  (`docs/ifc-round-trip.md`, Speling).
- Een verzameltaak (`isSummaryTask`) krijgt op deze route `summaryProgress`: voortgang, status en de werkelijke
  datums die ze draagt. Zie ADR 0332 voor wat de modus daarmee doet.
- `RecordedTime` heet `start`/`finish` en niet `earlyStart`/`earlyFinish`, omdat de waarde ook uit de
  schedule-slots kan komen. `_assertRecordedTimeCompleet` eist dat elk ander veld van `TaskTimeComputed` een plek in
  `RecordedTime` heeft, zodat een nieuw rekenveld niet stil buiten de vastlegging blijft.
