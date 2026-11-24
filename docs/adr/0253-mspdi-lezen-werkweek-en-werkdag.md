# MSPDI lezen: de werkweek, de enkelvoudige werkdag en de blokken van een kalender

`applyCalendarBody` zet uit de standaardwerkweek van een `<Calendar>` (`effectiveWeek`) de werkdagen, de blokken per
weekdag en de enkelvoudige werkdag (`workStartHour`, `workEndHour`, `hoursPerDay`), die het dagpad gebruikt en de
kalenderdialoog toont. De vormen die de lezer daarbij onderscheidt, toetst `check-mspdi-werktijd-minuten.ts`
(0402ScheduleMSP.xml, review PR #384). Hier staan de keuzes die een lezer zonder uitleg zou terugdraaien.

## Gevolgen

- Alleen `<Calendar><WeekDays><WeekDay>` met `DayType` 1 tot en met 7 is de eigen standaardweek (`readOwnWeek`). Een
  tijdelijke werkweek onder `<WorkWeeks>` heeft ook een `WeekDays`-ouder; zonder de controle op de grootouder werd de
  zaterdag van zo'n zomerrooster een werkdag van het hele jaar (`check-import-namen-werkweek.ts`, punt 2). De lezer
  leest `<WorkWeeks>` niet. Een afgeleide kalender krijgt per weekdag zijn eigen `<WeekDay>`, en anders die van zijn
  basis (`check-mspdi-feestdagen.ts` 10 en 11). Dat MS Project en MPXJ ook zo erven, komt uit het weggehaalde
  commentaar en is niet nagegaan.
- De enkelvoudige werkdag komt van de eerste werkdag met tijden in MS Project-volgorde, zondag eerst (de volgorde van
  `SCALAR_DAY_ORDER`), niet in bestandsvolgorde: de eigen writer zet maandag eerst, en dan koos een rondgang een
  andere dag. Ze komt uit de standaardweek en niet uit het eerste `<WorkingTime>` van de kalender, omdat dat van een
  uitzondering of een tijdelijke werkweek kan zijn.
- Twee gelijke blokken op elke werkdag (`opsDayWithBreak`) zijn alleen in een bestand van OPS (`opsFile`, ADR 0250)
  een dagkalender met pauze: de writer schrijft de effectieve blokken van een dagkalender. Een bestand van MS Project
  met 08:00–12:00 en 13:00–17:00 blijft een uurkalender, zoals de `.mpp`-lezer hem leest (§1). De pauzevelden komen
  er alleen bij als `seedScalarBands` zonder die velden andere blokken geeft: de standaard 07:00–16:00 met 8 uur komt
  zonder velden terug, een pauze om 12:30 met (§4).
- `hourShape` maakt de blokken afwijkend (`registerCalendarBands`) als `canonicalizeBands` een afwijking van de
  enkelvoudige werkdag ziet en het geen dagkalender met pauze is, of als `sharedWeekBlocks` `verschilt` geeft: één
  werkdag voor de hele week kan verschillende blokken per werkdag niet dragen (§1, "Weekend kort").
- Bij meer blokken op die werkdag zijn begin en einde de hele uren van het eerste en het laatste blok
  (`workDayFromBlocks`), en is `hoursPerDay` de meest voorkomende dagsom van de week zonder de pauze
  (`deriveHoursPerDay`); einde min begin zou de pauze meetellen.
- Bij één blok zijn begin, einde en uren per dag op de minuut, in de canonieke vorm (`canonicalExceptionBands`:
  00:00–00:00 wordt 0–24 uur, 22:00–06:00 wordt 22–30). Een kloktijd zonder `HH:MM`-vorm leest de terugval als het
  getal vóór de eerste `:` (`scalarHourFromClock`), omdat een oudere eigen export 07:30 als `7.5:00:00` schreef (§1).
  In die terugval telt een eindtijd op of vóór het begin 24 uur erbij: `00:00:00` als einde is middernacht na de
  start.
- Een werkende uitzondering krijgt haar blokken in dezelfde canonieke vorm (`canonicalExceptionBands`: een blok dat op
  of vóór zijn begin eindigt, krijgt 1440 minuten bij zijn einde). De IFC-lezer canoniseert bij het teruglezen, dus
  zonder die stap rekende F5 vóór en na een IFC-rondgang anders (Miraya.xml, `check-mspdi-uitzondering-hele-dag.ts`).
