# MSPDI lezen: welke kalender een uurkalender wordt en wanneer 08:00 een anker is

Of een kalender een uurkalender wordt, beslist `promoteHourCalendars` (`subdayIo.ts`) met een signaal per kalender
dat `readMSPDI` uit de taken haalt (`cSignalCalIds`): een taak op die kalender met een duur korter dan een dag
(`isSubDayMinutes`), of met een `Start`, `Finish`, `ActualStart` of `ActualFinish` met een eigen tijd
(`xmlTimeSignal`). De werkelijke datums tellen mee omdat de kalender anders scalair bleef, de lezer een werkelijk einde
om 11:00 afkapte tot de datum en de laadnormalisatie er het blokeinde van maakte (review ronde 3 van PR #559,
`check-import-datum-zonder-tijd.ts`). In een export met een geldige lijst `OPS_LiteralCalendars` (tijdregel `opsLiteral`) beslist die lijst in
plaats van de datums, want daar draagt elke datum een echte tijd, ook op een scalaire kalender; een nummer in de lijst
dat geen kalender van het bestand is, telt niet.

## Gevolgen

- De tijdregel komt uit `xmlTimeRule`: met de definitie `OPS_LiteralCalendars` `opsLiteral`, anders met de definitie
  van de duureenheid of de vingerafdruk `isLegacyOpsMspdi` `opsAnchor` (ADR 0250), anders `foreign`. Taakdatums,
  werkelijke datums, constraint- en deadlinedatum, de vastgelegde datums en de baselinedatums lezen allemaal via
  dezelfde `parseTaskDate` (`xmlTaskDate`, met `isHour` van de taakkalender); de statusdatum via
  `statusDateFromXml`. Bewijs: `check-uren-f5b-adapters.ts` (5) tot en met (12); spec alleen-uren §1.3, I8.
- Na de promotie haalt `readMSPDI` de pauzevelden (`simpleBreakStartMinute`, `simpleBreakDurationMinutes`) weg van een
  kalender in `hourModeCalIds`: een uurkalender rekent met zijn blokken, en die dragen de pauze al
  (`check-mspdi-werktijd-minuten.ts` §4d). Alleen `applyCalendarBody` zet die velden (ADR 0253).
- `<MinutesPerDay>` geldt alleen voor de projectkalender (`projectFileHoursPerDay`): `readCalendars` zet hem op
  `hoursPerDay` van die kalender, en `readMSPDI` zet hem na de promotie terug. De opgeslagen uren per dag mogen
  afwijken van de blokken en gaan ongewijzigd terug bij export; de blokken rekenen en tonen (eigenaarsbesluit
  2026-10-15, `check-urenperdag-heropenen.ts`). Een bibliotheekkalender, ook een afgeleide, houdt de uren per dag die
  `applyCalendarBody` en de promotie uit zijn blokken halen.
