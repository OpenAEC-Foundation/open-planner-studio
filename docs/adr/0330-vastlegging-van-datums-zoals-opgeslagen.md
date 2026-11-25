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
  kanalen nooit per taak gemengd. Bij een XER-bronarchief levert `readIFC` naast `recordedFields` ook
  `recordedTimes` (ADR 0048) zodra de reconstructie voor het bronproject iets oplevert (`recordedTimesByProject`);
  dan telt alleen `recordedTimes`. Levert ze niets, dan is de herkomst `ifc-own` of `ifc` en geldt `recordedFields`.
  Op de route met `recordedTimes` voegt de functie alleen bij een hammock `hammockDuration` toe; een record krijgt
  hier geen `summaryProgress` en geen spelingminuten (de bronlezers vullen geen minuten). Toets:
  `check-recorded-dates.ts` §1B.
- Zonder `recordedTimes` kiest de functie per taak met een entry in `recordedFields` één laag voor `start` en
  `finish`: beide slots `earlyStart` en `earlyFinish` aanwezig, dan die; anders, als `opts.scheduleLayer` niet
  `false` is, beide slots `scheduleStart` en `scheduleFinish`; anders geen uitspraak (de taak staat niet in
  `times` en telt niet mee in `total`). Een half paar wordt nooit met de andere laag aangevuld: zo'n combinatie
  heeft het bestand nooit gezegd en kan een einde vóór de start geven. Een taak zonder `IfcTaskTime` heeft een lege
  lijst en valt dus weg. Toets: `check-recorded-dates.ts` §1 (1p tot en met 1u); dat een volledig vroeg paar voorgaat
  op een volledig schedule-paar, toetsen 1v en 1w.
- Een slot telt in `recordedFields` als aanwezig als het in `IfcTaskTime` staat en geen `$` is (`recordedSlotsOf` in
  `ifcReader.ts`). Een afwezig slot en `$` vallen weg; een lege tekst `''` telt als aanwezig.
- `recordedDatesSource` (`documentActivation.ts`) geeft `scheduleLayer: false` voor de herkomsten `ifc` en
  `ifc-own`, omdat `ScheduleStart`/`ScheduleFinish` daar invoer is en geen rekenuitvoer. De andere aanroepers
  (`lateDatesInFile` in `externalSource.ts` en de vastlegging voor de minutenomzetting in `applyLoadedProject` en in
  het crashherstel van `documentSlice.ts`) geven geen opties mee en gebruiken de standaard `true`. Een eigen IFC
  (`ifc-own`) zonder bronformaat (`recordedSourceFormat`) krijgt van `recordedDatesSource` geen bron en dus geen
  automatische activering bij het laden; alleen het crashherstel van een bewaarde modus laat het toe (`captureAllowed`).
  Bij het openen van zo'n bestand van vóór het minutenmodel kan de minutenomzetting wel datums vastleggen voor
  *Ongedaan maken* (`minuteModelTransition` in `applyLoadedProject`, `fileSlice.ts`): in
  `check-minute-model-transition.ts` geeft Ongedaan maken na de laadroute de opgeslagen datum terug, in de modus.
- `lateStart`, `lateFinish`, `totalFloat`, `freeFloat` en `isCritical` komen elk alleen mee als hun eigen slot
  aanwezig is, los van de gekozen laag. De spelingminuten komen alleen mee als het slot van hun dagen-as aanwezig is
  én de taak minuten draagt. De IFC-lezer (`applyTaskTimeRecords` in `ifcReader.ts`) neemt ze rechtstreeks uit een
  slot met een tijddeel: `TotalFloat='PT6H'` zonder pset geeft 360 minuten. `OPS_Analysis.ExactFloat` is de andere
  route en telt alleen als het slot een duur zonder tijddeel is waarvan de dagen gelijk zijn aan de afgeronde dagen
  van het record (`docs/ifc-round-trip.md`, Speling).
- Een verzameltaak (`isSummaryTask`) krijgt op deze route `summaryProgress`: voortgang, status en de werkelijke
  datums die ze draagt. Zie ADR 0332 voor wat de modus daarmee doet.
- `RecordedTime` heet `start`/`finish` en niet `earlyStart`/`earlyFinish`, omdat de waarde ook uit de
  schedule-slots kan komen. `_assertRecordedTimeCompleet` eist dat elk ander veld van `TaskTimeComputed` een plek in
  `RecordedTime` heeft, zodat een nieuw rekenveld niet stil buiten de vastlegging blijft.
- `recordedFields` heeft als slotnamen `keyof TaskTimeComputed | keyof TaskTimeInput` en geen `string`, zodat een
  hernoemd rekenveld een compileerfout geeft in plaats van een `has.has(...)` die stil nooit meer waar is; de
  scheduler importeert daarvoor niet het slottype uit `ifcTaskSlots.ts` in de services-laag.
