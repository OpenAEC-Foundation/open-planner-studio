# De promotie tot uurkalender en het register van gelezen blokken

Een lezer beslist pas over de uurmodus van een kalender als alle taken gelezen zijn (ADR 0320), maar de blokken
leest hij eerder, met de kalender. Hij legt ze daarom vast in een register op het kalenderobject
(`registerCalendarBands`, `getCalendarBands`), en de promotie leest ze daar terug (`promoteHourCalendar`,
`promoteHourCalendars`). Het register is een `WeakMap` op het `WorkCalendar`-object. Elke lezer maakt bij elke
leesbeurt nieuwe kalenderobjecten, dus twee leesbeurten delen geen sleutel en het register ruimt zichzelf op.
Registreren doen `ifcReader`, `mspdiReader`, `p6xmlReader`, `mppCalendars`, `xerReader` en `xerCalendarData`.

## Gevolgen

- `promoteHourCalendar` promoveert als de geregistreerde blokken afwijken (`deviates`) of als de lezer een signaal
  meegeeft; zonder een van beide geeft hij onwaar, ook bij een kalender die al `workTime` heeft. Heeft een
  kalender die promoveert al `workTime`, dan verandert hij niets en geeft hij waar terug. Anders zet hij `workTime`,
  `workDays` uit de dagen met blokken (alleen als er minstens één is) en `hoursPerDay` uit `deriveHoursPerDay` (ADR
  0323). Of een lezer daarna zijn eigen uren per dag uit het bestand terugzet, beslist de lezer: ADR 0043 (IFC, alleen
  in stap 1), 0252 (MSPDI) en 0283 (`.mpp`); in `p6xmlReader` (`fileHoursPerDay`) en in de tweede promotie van
  `xerReader` gebeurt dat ook.
- De blokken zijn de geregistreerde. Zonder registratie, of met `preferCanonicalWhenEmpty` onwaar en geregistreerde
  blokken zonder enige werkdag, maakt `synthBandsFromScalar` er één blok van `workStartHour` tot `workEndHour` van op
  elke dag in `workDays`. `ifcReader` geeft `preferCanonicalWhenEmpty` waar mee; `mspdiReader`, `p6xmlReader`,
  `mppCalendars`, `xerReader` en `xerCalendarData` onwaar. Het verschil raakt alleen een kalender met geregistreerde
  maar lege blokken die door een signaal promoveert: in IFC krijgt die lege blokken. Het weggehaalde commentaar noemde
  dit een bewust verschil tussen de formaten, zonder reden; wat dat in v2026.9.0 gaf, staat in knownbug 150.
- `promoteHourCalendars` loopt over alle kalenders die de lezer meegeeft, ook over kalenders die geen taak gebruikt,
  omdat afwijkende blokken alleen al genoeg zijn. Het geeft de sleutels terug waaronder de lezer de gepromoveerde
  kalenders kent.
