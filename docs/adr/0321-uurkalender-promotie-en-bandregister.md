# De promotie tot uurkalender en het register van gelezen blokken

Een lezer leest de blokken met de kalender, maar een signaal van een taak (ADR 0320, punt (c)) kent hij pas als de
taken gelezen zijn. Hij legt de blokken daarom vast in een register op het kalenderobject
(`registerCalendarBands`, `getCalendarBands`), en de promotie leest ze daar terug (`promoteHourCalendar`,
`promoteHourCalendars`), ook als die al bij het lezen van de kalender valt. Het register is een `WeakMap` op het
`WorkCalendar`-object. Elke lezer maakt bij elke
leesbeurt nieuwe kalenderobjecten, dus twee leesbeurten delen geen sleutel en het register ruimt zichzelf op.
Registreren doen `ifcReader`, `mspdiReader`, `p6xmlReader`, `mppCalendars`, `xerReader` en `xerCalendarData`.

## Gevolgen

- Wanneer een lezer promoveert, verschilt per formaat:
  - IFC (`ifcReader.ts`): al bij het lezen van de kalender bij `IsHourCalendar = .T.`, of bij seconden of de oude
    bandvorm in de kloktijd zonder `IsHourCalendar = .F.`; anders na de taken bij afwijkende blokken of een signaal,
    niet bij een scalair gemarkeerde kalender (ADR 0043). Uitzondering op de seconden: een kalender zonder
    `IsHourCalendar = .T.` met één wekelijks tijdvak, zoals `07:30:01` tot `16:00:00`, zonder de oude bandvorm en
    zonder afwijking blijft scalair (`scalarSeconds`); die voorwaarde gaat voor en sluit ook de promotie na de taken
    uit (ADR 0043, stap 1).
  - MSPDI (`mspdiReader.ts`): na de scan van de taakgegevens bij afwijkende blokken, bij werkdagen met verschillende
    blokken (`sharedWeekBlocks`, ook bij één blok per dag) of bij een signaal; in een bestand van OPS blijft een
    dagkalender met pauze (`opsDayWithBreak`) zonder signaal een dagkalender (ADR 0253 en 0252).
  - P6 XML (`p6xmlReader.ts`): na de scan van de taakgegevens bij afwijkende blokken of een signaal; werkdagen met
    elk één blok maar andere tijden promoveren niet, en in een export van OPS blijft een dagkalender met pauze onder
    voorwaarden een dagkalender (`registerP6Bands`, ADR 0262 en 0264).
  - `.mpp` (`mppCalendars.ts`, `promoteCalendarsForHourMode`): na de scan van de taakgegevens bij de uitkomst van
    `canonicalizeBands` of een signaal, zonder vergelijking tussen weekdagen (knownbug 2325, issue #1228; ADR 0283).
  - XER: eerst in `decodeXerCalendarData` en de kalenderlus van `xerCalendarData.ts`, bij het lezen van de kalender,
    bij elk expliciet klokblok in de weekdagen van `clndr_data` (`DaysOfWeek`, `hasExplicitClockBands`), dus ook bij
    één blok van 08:00 tot 16:00 zonder taaksignaal; een klokblok dat alleen onder `Exceptions` staat, telt daar niet.
    Daarna in `xerReader.ts`, na het lezen van de activiteitrijen, bij een kloktijd in een taakdatum uit de vaste
    veldlijst voor `hourSignalCalendarIds` in `readXerProject` (een kloktijd die alleen in `early_start_date` staat,
    telt niet), of bij blokken met een pauze die `inferBlankCalendarBands` uit de geplande tijden afleidt. Beide
    promoties zetten daarna de uren per dag terug die de kalender vóór de promotie had.
- `promoteHourCalendar` promoveert als de geregistreerde blokken afwijken (`deviates`) of als de lezer een signaal
  meegeeft; zonder een van beide geeft hij onwaar, ook bij een kalender die al `workTime` heeft. Heeft een
  kalender die promoveert al `workTime`, dan verandert hij niets en geeft hij waar terug. Anders zet hij `workTime`,
  `workDays` uit de dagen met blokken (alleen als er minstens één is) en `hoursPerDay` uit `deriveHoursPerDay` (ADR
  0323). Of een lezer daarna zijn eigen uren per dag uit het bestand terugzet, beslist de lezer: ADR 0043 (IFC, alleen
  in stap 1), 0252 (MSPDI) en 0283 (`.mpp`); in `p6xmlReader` (`fileHoursPerDay`) en in beide promoties van XER
  (`xerCalendarData` en `xerReader`) gebeurt dat ook.
- De blokken zijn de geregistreerde. Zonder registratie, of met `preferCanonicalWhenEmpty` onwaar en geregistreerde
  blokken zonder enige werkdag, maakt `synthBandsFromScalar` er één blok van `workStartHour` tot `workEndHour` van op
  elke dag in `workDays`. `ifcReader` geeft `preferCanonicalWhenEmpty` waar mee; `mspdiReader`, `p6xmlReader`,
  `mppCalendars`, `xerReader` en `xerCalendarData` onwaar. Het verschil raakt alleen een kalender met geregistreerde
  maar lege blokken die door een signaal promoveert: in IFC krijgt die lege blokken. Het weggehaalde commentaar noemde
  dit een bewust verschil tussen de formaten, zonder reden; wat dat in v2026.9.0 gaf, staat in knownbug 150.
- `promoteHourCalendars` loopt over alle kalenders die de lezer meegeeft, ook over kalenders die geen taak gebruikt,
  omdat afwijkende blokken alleen al genoeg zijn. Het geeft de sleutels terug waaronder de lezer de gepromoveerde
  kalenders kent.
