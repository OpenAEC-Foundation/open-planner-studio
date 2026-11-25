# P6 XML schrijven: duur, rest en lag in uren, met de maatrecords

`PlannedDuration`, `RemainingDuration` en `Lag` zijn in P6 XML uren. `writeP6XMLWithReport` schrijft ze als minuten
gedeeld door 60, en zet in een maatrecord (ADR 0361) wat de uren niet zeggen: de dagenmaat, een breuk in minuten of
kalendertijd. Een dag is daarbij de werktijd per dag van de kalender en niet de opgeslagen `HoursPerDay` (T13,
eigenaarsbesluit 2026-10-15, "1 d = echte werktijd per dag"), zodat de lezer met dezelfde maat terugrekent (ADR 0265).
Het voorbeeld uit het weggehaalde commentaar: 3 dagen op een kalender met 8 uur opgeslagen en blokken van 10 uur
werden met de opgeslagen uren 24 uur, en P6 plande daar 2,4 werkdagen. De helpers staan in `xmlDayMeasure.ts`; de
XER-writer volgt dezelfde lijn (regel `xer`).

## Gevolgen

- Een urentaak (`taskDurationUnit` is `hours`) schrijft de minuten van `taskMinutesForWrite` via `writeMinutes`: op de
  hele minuut, met een `OPS_ExactMinutes`-record bij een breuk (T14). Een andere taak schrijft `scheduleDuration`
  via `writeDays` met `dayMeasureMinutesPerDay(effectieve kalender, false)`: het product, afgerond op hele minuten,
  met een `OPS_DayMeasureDurations`-record bij een breuk in dagen (T21). Alleen een geldig record dat nog bij de duur
  en de kalender past, herstelt bij het lezen de oorspronkelijke maat (`readMeasure`, ADR 0265).
- Een taak in kalendertijd (`isElapsedTask`) telt in P6 als werktijd: een dagtaak met dezelfde werktijd per dag, een
  urentaak met haar minuten als uren. Haar record draagt dan altijd de eenheid, `ed` of `eu`, ook bij hele dagen of
  minuten (`withElapsedUnit`, review #585 r1 punt 3), zodat OPS de kalendertijd terugleest (ADR 0265). Dat P6 geen
  kalendertijd per activiteit kent, komt uit het weggehaalde commentaar en is niet nagegaan.
- De rest volgt dezelfde maat. Een urentaak met `remainingMinutes` schrijft die via `writeMinutes`; een urentaak zonder
  `remainingMinutes` maar met `remainingTime` schrijft `remainingTime` maal de werktijd per dag van haar kalender (in
  kalendertijd maal 1440 minuten), afgerond op de minuut en zonder record behalve de eenheid; een andere taak schrijft
  `remainingTime` via `writeDays` met dezelfde dag als haar duur. Zonder `remainingTime` (en bij een urentaak zonder
  `remainingMinutes`) staat er geen `RemainingDuration`. Dat P6 de rest op de activiteitkalender rekent, komt uit het
  weggehaalde commentaar en is niet nagegaan.
- De lag van een relatie komt uit `p6RelationshipLag`, die ook de XER-writer gebruikt, zodat de twee P6-formaten een
  lag op dezelfde manier schrijven. In deze volgorde:
  - een lag in procenten wordt vaste minuten: het percentage van de duur van de voorganger in minuten
    (`taskMinutesForWrite`, met 24 uur per dag bij een voorganger in kalendertijd en anders `effHoursPerDay` van haar
    kalender; een nulduur-mijlpaal telt 0), op de hele minuut, zonder record. De duur wordt niet eerst op hele dagen
    afgerond (spec alleen-uren I6);
  - een lag in minuten (`lagMinutes`) gaat ongewijzigd als uren; in kalendertijd met het record
    `[minuten, hele minuten, "eu"]`;
  - een lag in dagen gaat via `writeDays` met de werktijd per dag van de lagkalender (`lagWorkMinutesPerDay`, I7), met
    het record `[dagen, minuten]`, ook bij hele dagen, omdat een relatie geen eigen eenheidsveld heeft. In kalendertijd
    telt de dag op dezelfde manier en krijgt het record de eenheid `ed`. De dagen in het record zijn die van
    `dayMeasureRecord` en verklaren de geschreven minuten (aanval a06 na #600). Een lag van 0 dagen in werktijd geeft 0
    uur zonder record.
- Dat P6 geen lag in procenten en geen lageenheid per relatie kent, komt uit het weggehaalde commentaar en is niet
  nagegaan; de lagkalender is in P6 XML een projectoptie (`RelationshipLagCalendar` in `<ScheduleOptions>`, ADR
  0361). `p6Lag` meldt de procentlag en de lag in kalendertijd in de console; de XER-writer telt zijn verlies zelf.
- De lagrecords gaan per opvolger in één UDF (`OPS_DayMeasureLags`, `LagRecordCollector`), met als sleutel het
  `ObjectId` van de voorganger en het relatietype (`lagRecordKey`). De writer rekent daarom alle lags uit vóór hij de
  activiteiten schrijft. Een record komt alleen op een opvolger die als `<Activity>` gaat, en een sleutel die bij één
  opvolger twee keer voorkomt, vervalt voor beide relaties (`LagRecordCollector`). Een relatie waarvan de voorganger of
  opvolger niet in het bestand staat, slaat hij over. Het relatietype is het label van `P6_LINK_TYPE`
  (`check-p6xml-writer-p6.ts` 4c); dat dit de vorm van P6 en MPXJ is, komt uit het weggehaalde commentaar en is niet
  nagegaan.
