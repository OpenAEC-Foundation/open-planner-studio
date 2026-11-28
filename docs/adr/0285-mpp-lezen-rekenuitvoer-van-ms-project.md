# MPP lezen: de rekenuitvoer van MS Project als datums zoals opgeslagen

Een `.mpp` draagt ook wat MS Project zelf uitrekende: vroege en late datums en speling (de velden bij
`TaskFieldId.EarlyStart` in `fieldMap14.ts`). `readTasks` geeft dat als apart kanaal (`ImportResult.recordedTimes`,
herkomst `mpp`), en `readMPP` alleen voor bladtaken (`leafRecordedTimes`); het is geen invoer voor de solver, net als
bij MSPDI (ADR 0255).

## Gevolgen

- De vastlegging van een taak bouwt `buildRecordedTime` uit de waarden van het bestand, vóór `resolveMissingScheduleDates`
  ontbrekende plandatums aanvult. De start is `EARLY_START`, anders de start uit `resolveScheduleField` (ADR 0282); het
  einde evenzo met `EARLY_FINISH`. Zonder bruikbare start of einde in het bestand krijgt de taak geen vastlegging,
  ook als ze daarna wel plandatums krijgt.
- MPP14 bewaart geen totale speling. `mppTotalSlackTenths` leidt haar af uit start- en finishspeling: bij een taak met
  een werkelijke start de finishspeling, ook als de startspeling ontbreekt; anders het minimum van beide, en dan zonder
  een van de twee geen speling
  (`check-recorded-times-formats.ts`, 5-0d tot en met 5-0g). Dit volgt MPXJ `MicrosoftSlackCalculator.calculateTotalSlack`
  (de kleinste speling, want de `.mpp`-lezer van MPXJ zet geen `TotalSlackCalculationType`).
- Speling staat in tienden van een minuut. De lezer rekent haar om naar dagen: bij een kalendertijdtaak met een dag
  van 24 uur, op een gepromoveerde kalender (ADR 0283) met `effHoursPerDay` van die kalender (zoals de XER-lezer, niet
  `MINUTES_PER_DAY`), en anders met de `hoursPerDay` van `parseProjectProperties` (`MINUTES_PER_DAY`, of 8).
- Kritiek in de vastlegging: een taak met een werkelijk einde of op 100 % of meer krijgt `isCritical: false`, ook
  zonder totale speling, en ook als ze op 100 % zonder werkelijk einde en met een rest bij import lopend blijft
  (`runningAtFullIds`, ADR 0282); een andere taak krijgt `isCritical` als ze een totale speling heeft (kritiek als die
  hoogstens de kritiekgrens van ADR 0284 is) en anders geen `isCritical`. Dat is
  MPXJ `Task.calculateCritical`, zonder de uitzondering die MPXJ maakt voor handmatige taken met een duur, start of
  einde als tekst: die tekstvelden leest deze lezer niet.
