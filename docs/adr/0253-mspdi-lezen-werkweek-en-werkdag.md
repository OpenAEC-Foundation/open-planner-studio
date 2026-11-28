# MSPDI lezen: de werkweek, de enkelvoudige werkdag en de blokken van een kalender

`applyCalendarBody` zet uit de standaardwerkweek van een `<Calendar>` de werkdagen, de blokken per weekdag en de
enkelvoudige werkdag (`workStartHour`, `workEndHour`, `hoursPerDay`), die het dagpad gebruikt en de kalenderdialoog
toont. `check-mspdi-werktijd-minuten.ts` toetst de vormen (0402ScheduleMSP.xml, review PR #384). Hier staan de keuzes
die een lezer zonder uitleg zou terugdraaien.

## Gevolgen

- Alleen `<Calendar><WeekDays><WeekDay>` is de eigen standaardweek (`readOwnWeek`): een tijdelijke werkweek onder
  `<WorkWeeks>` heeft ook een `WeekDays`-ouder, en zonder de controle op de grootouder werd de zaterdag van zo'n
  zomerrooster een werkdag van het hele jaar (`check-import-namen-werkweek.ts`, punt 2). Een afgeleide kalender krijgt
  per weekdag zijn eigen `<WeekDay>` en anders die van zijn basis (`effectiveWeek`; `check-mspdi-feestdagen.ts` 10 en
  11). MPXJ erft ook per weekdag van de basis (`ProjectCalendar.setParent` en
  `getDayType`).
- De enkelvoudige werkdag komt van de eerste werkdag met tijden na sortering op `dayType` (zondag eerst), niet in
  bestandsvolgorde: de eigen writer zet maandag eerst, en dan koos een rondgang een andere dag. Ze komt uit de
  standaardweek, niet uit het eerste `<WorkingTime>` van de kalender, omdat dat van een uitzondering of een tijdelijke
  werkweek kan zijn.
- Dezelfde twee blokken op elke werkdag, met een pauze ertussen binnen de dag (`opsDayWithBreak`), zijn alleen in een
  bestand van OPS (`opsFile`, ADR 0250) een dagkalender met pauze, omdat de eigen writer de effectieve blokken van een
  dagkalender schrijft. Een bestand van MS Project met 08:00–12:00 en 13:00–17:00 blijft een uurkalender, zoals de
  `.mpp`-lezer hem leest (§1). Of de pauze eigen velden krijgt, beslist `seedScalarBands`: alleen als de afleiding
  zonder pauzevelden andere blokken geeft (§4: de standaard 07:00–16:00 komt zonder velden terug, een pauze om 12:30
  met).
- Blokken die afwijken van één enkelvoudige werkdag (`canonicalizeBands`), en werkdagen met verschillende blokken
  (`sharedWeekBlocks`), maken de kalender een uurkalender, behalve die dagkalender met pauze, omdat één werkdag voor
  de hele week ze niet kan dragen (§1).
- Bij meer blokken op die werkdag komen begin, einde en uren per dag uit `workDayFromBlocks` en `deriveHoursPerDay`,
  netto: einde min begin zou de pauze meetellen. Bij één blok staan ze in de canonieke vorm van
  `canonicalExceptionBands` (§1: nachtblok en 24 uur). De terugval voor een kloktijd zonder `HH:MM`-vorm
  (`scalarHourFromClock`) bestaat omdat een oudere eigen export 07:30 als `7.5:00:00` schreef (§1); daarin is een
  eindtijd op of vóór het begin de volgende dag, omdat `00:00:00` als einde middernacht na de start is.
- Een werkende uitzondering krijgt haar blokken ook in de canonieke vorm van `canonicalExceptionBands`, omdat de
  IFC-lezer bij het teruglezen canoniseert en F5 anders vóór en na een IFC-rondgang verschilde (Miraya.xml,
  `check-mspdi-uitzondering-hele-dag.ts`).
