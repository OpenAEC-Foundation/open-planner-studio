# MPP lezen: welke kalender een uurkalender wordt, en het eigen anker per kalender

Een kalender wordt een uurkalender als zijn blokken afwijken (`mppCalendars.ts`) of als een taak op die kalender een
signaal geeft, net als bij MSPDI (ADR 0252). `readTasks` doet daarom drie rondes: eerst een ruwe scan van elke taak
(`RawTaskScan`) met haar effectieve kalender, dan de signalen per kalender en `promoteCalendarsForHourMode`, en pas dan
de taken, omdat de promotie pas na alle taken vaststaat. De uurkalender beslist daarna alleen over de datums: op een
uurkalender houden ze hun tijd (`formatInstant(…, 'hour')`), anders alleen de datum. Duur, rest en lag zijn in elke
stand de urenmaat (ADR 0282).

## Gevolgen

- Het signaal van een taak: een duur waarvoor `isSubDayMinutes` waar is met de uren per dag van de kalender van vóór
  de promotie, of een `SCHEDULED_START`, `SCHEDULED_FINISH`, `ACTUAL_START` of `ACTUAL_FINISH` met een tijd die
  afwijkt van het anker (`hasNonAnchorTime`). Het handmatige paar van ADR 0282 telt niet mee. Dat de werkelijke datums
  meetellen, komt uit review ronde 3 van PR #559 (deel B): anders kapte de lezer een werkelijk einde om 11:00 af tot de
  datum en maakte de laadnormalisatie er het blokeinde van.
- Het anker is het eigen startuur van de kalender (`mppAnchorClock`: `workStartHour` als heel uur, van vóór de
  promotie), niet de vaste 08:00 van de MSPDI-lezer. Een tijdstempel in een `.mpp` kent geen keuze tussen "alleen een
  datum" en "een echte tijd", dus de vraag is of de tijd afwijkt van het begin van de dag van deze kalender. Gevolg:
  bij een ander startuur dan 8 verschillen de twee lezers voor een taak die precies op dat startuur ligt
  (`check-mpp-import.ts`, "ankerdivergentie", met een kalender die om 09:00 begint). Een kalender die op een half uur
  begint: knownbug 2310.
- De effectieve kalender van een taak is de kalender uit `CALENDAR_UNIQUE_ID` als die naar een gelezen kalender wijst,
  en anders de projectkalender. -1 of een ontbrekend veld betekent geen eigen kalender. Alleen een gevonden kalender
  geeft de taak een `calendarId`.
- `readMPP` leest de kalenders vóór de taken; de promotie verandert dezelfde kalenderobjecten, dus de projectkalender
  en `resourceCalendars` zijn na `readTasks` gepromoveerd. `resourceCalendars` bevat elke kalender behalve de
  projectkalender, dus ook de eigen kalenders van taken (`taskCalendar` zoekt daar).
- `MINUTES_PER_DAY` uit de Props geldt alleen als hij groter is dan 0 en hoogstens 1440. Dan wordt hij de uren per dag
  van de projectkalender (`calendarHoursPerDayOverride`, in `readCalendars`), ook na de promotie, zoals
  `<MinutesPerDay>` bij MSPDI. Anders blijven de uren per dag uit de blokken staan, en is de `hoursPerDay` van
  `parseProjectProperties` 8. Een corrupte waarde geeft zo geen absurde dag.
