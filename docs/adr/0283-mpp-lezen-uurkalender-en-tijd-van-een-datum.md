# MPP lezen: welke kalender een uurkalender wordt, en het eigen anker per kalender

`readTasks` promoveert een kalender tot uurkalender (`promoteCalendarsForHourMode`, via `promoteHourCalendar` in
`subdayIo.ts`) als zijn blokken afwijken (`mppCalendars.ts`) of als een taak op die kalender een signaal geeft, net als
bij MSPDI (ADR 0252); een andere kalender blijft zoals hij gelezen is. Daarom doet `readTasks` drie rondes: eerst een
ruwe scan van elke taak (`RawTaskScan`) met haar effectieve kalender, dan de signalen per kalender en de promotie, en
pas dan de taken. De promotie zet op de kalender `workTime` (de eigen blokken of blokken uit de enkelvoudige werkdag),
`workDays` en de uren per dag; dat raakt ook wat daarna met die kalender rekent, zoals `scheduleDuration` (ADR 0282) en
de speling in dagen (ADR 0285). Voor de datums van de taak geldt: op een gepromoveerde kalender houden ze hun tijd
(`formatInstant(…, 'hour')`, op de minuut), anders alleen de datum. Duur en rest zijn in elke stand minuten; de
lag volgt de regel van ADR 0282. Alleen een kalender uit de kalendersectie (`calendarByUniqueId`) kan promoveren: de
standaardkalender die `readCalendars` teruggeeft bij een ontbrekende of onleesbare kalendersectie niet.

## Gevolgen

- Het signaal van een taak: een duur waarvoor `isSubDayMinutes` waar is met de uren per dag van de kalender van vóór
  de promotie, of een `SCHEDULED_START`, `SCHEDULED_FINISH`, `ACTUAL_START` of `ACTUAL_FINISH` met een tijd die
  afwijkt van het anker (`hasNonAnchorTime`). Het handmatige paar van ADR 0282 telt niet mee. Dat de werkelijke datums
  meetellen, komt uit review ronde 3 van PR #559 (deel B): anders kapte de lezer een werkelijk einde om 11:00 af tot de
  datum en maakte de laadnormalisatie er het blokeinde van.
- Het anker is het eigen startuur van de kalender (`mppAnchorClock`: `workStartHour` als heel uur, van vóór de
  promotie), niet de vaste 08:00 van de MSPDI-lezer. Een tijdstempel in een `.mpp` kent geen keuze tussen "alleen een
  datum" en "een echte tijd", dus de vraag is of de tijd afwijkt van het begin van de dag van deze kalender. Bij een
  ander startuur dan 8 kunnen de twee lezers daardoor verschillen voor een taak die precies op dat startuur ligt;
  `check-mpp-import.ts` ("ankerdivergentie") toetst dat geval met een kalender die om 09:00 begint: de `.mpp`-kant houdt
  de kalender zonder `workTime`, dezelfde taak in MSPDI niet. Een kalender die op een half uur begint: knownbug 2310.
- De effectieve kalender van een taak is de kalender uit `CALENDAR_UNIQUE_ID` als die naar een gelezen kalender wijst,
  en anders de projectkalender. -1 of een ontbrekend veld betekent geen eigen kalender. Alleen een gevonden kalender
  geeft de taak een `calendarId`.
- `readMPP` leest de kalenders vóór de taken; de promotie verandert dezelfde kalenderobjecten, dus de projectkalender
  en `resourceCalendars` zijn na `readTasks` gepromoveerd waar dat gebeurde. `resourceCalendars` bevat elke kalender
  behalve de projectkalender, dus ook de eigen kalenders van taken (`taskCalendar` zoekt daar).
- `MINUTES_PER_DAY` uit de Props geldt alleen als hij groter is dan 0 en hoogstens 1440. Dan wordt hij de uren per dag
  van de projectkalender (`calendarHoursPerDayOverride`, in `readCalendars`), ook na de promotie, zoals
  `<MinutesPerDay>` bij MSPDI; alleen als die projectkalender in de kalendersectie is gevonden onder het unique-id dat
  `readCalendars` als projectkalender aanwijst, dus niet bij een terugvalkalender; die houdt de uren per dag uit haar blokken. De `hoursPerDay` van
  `parseProjectProperties` is bij een geldige waarde `MINUTES_PER_DAY / 60`, ook als de kalender haar niet krijgt, en bij een
  ongeldige of ontbrekende waarde 8; dan blijven ook de uren per dag uit de blokken staan. Een corrupte waarde geeft
  zo geen absurde dag.
