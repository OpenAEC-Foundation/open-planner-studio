# MPP lezen: de rekenuitvoer van MS Project als datums zoals opgeslagen

Een `.mpp` draagt ook wat MS Project zelf uitrekende: vroege en late datums en speling (de velden bij
`TaskFieldId.EarlyStart` in `fieldMap14.ts`). `readTasks` geeft dat als apart kanaal (`ImportResult.recordedTimes`,
herkomst `mpp`, via `buildRecordedTime`), alleen voor bladtaken (`leafRecordedTimes` in `readMPP`) en nooit als
invoer voor de solver, net als MSPDI (ADR 0255). Zonder `EARLY_START` of `EARLY_FINISH` is de start of het einde van de
taak uit ADR 0282 de vastlegging.

## Gevolgen

- MPP14 bewaart geen totale speling. `mppTotalSlackTenths` leidt haar af uit start- en finishspeling: bij een taak met
  een werkelijke start de finishspeling, anders het minimum van beide, en zonder een van de twee geen speling
  (`check-recorded-times-formats.ts`, 5-0d tot en met 5-0g). Dat dit MPXJ `MicrosoftSlackCalculator.calculateTotalSlack`
  volgt (de kleinste speling, want een `.mpp` kent geen `TotalSlackCalculationType`), komt uit het weggehaalde
  commentaar.
- Speling staat in tienden van een minuut. De lezer rekent haar om naar dagen: bij een kalendertijdtaak met een dag
  van 24 uur, op een uurkalender met `effHoursPerDay` van de taakkalender (zoals de XER-lezer, niet `MINUTES_PER_DAY`),
  en anders met de `hoursPerDay` van `parseProjectProperties` (`MINUTES_PER_DAY`, of 8, ADR 0283).
- Kritiek: een taak met een werkelijk einde of op 100 % of meer is niet kritiek; anders kritiek als de totale speling
  hoogstens de kritiekgrens is (ADR 0284); zonder totale speling legt de lezer geen kritiek vast. Volgens het weggehaalde
  commentaar is dat MPXJ `Task.calculateCritical`, zonder de uitzondering die MPXJ maakt voor handmatige taken met
  een duur, start of einde als tekst: die tekstvelden leest deze lezer niet.
