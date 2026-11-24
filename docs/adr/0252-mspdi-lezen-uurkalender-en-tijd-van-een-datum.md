# MSPDI lezen: welke kalender een uurkalender wordt en wanneer 08:00 een anker is

Een kalender wordt een uurkalender (`promoteHourCalendars` in `subdayIo.ts`) als zijn blokken afwijken (ADR 0253) of
als een taak op die kalender een signaal geeft (`cSignalCalIds` in `readMSPDI`): een duur waarvoor `isSubDayMinutes`
waar is, of een `Start`, `Finish`, `ActualStart` of `ActualFinish` waarvoor `xmlTimeSignal` waar is; in een export met
een geldige lijst `OPS_LiteralCalendars` geeft in plaats van die datums elke taak op een kalender uit die lijst het
signaal. De tijdregel (`xmlTimeRule`) is `opsLiteral` met de definitie `OPS_LiteralCalendars`, `opsAnchor` met de
definitie van de duureenheid of de vingerafdruk `isLegacyOpsMspdi` (ADR 0250), en anders `foreign`; alleen bij
`opsAnchor` beslist de kalender van de taak of een tijd telt (`xmlTaskDate`). Reden: de writers van die bestanden
schreven een datum zonder tijd als 08:00 (spec alleen-uren §1.3, I8); in elk ander bestand is een tijd echt
(`check-uren-f5b-adapters.ts` (5) tot en met (12)).

## Gevolgen

- Dat ook de werkelijke datums een signaal geven, komt uit review ronde 3 van PR #559: een werkelijk einde om 11:00
  werd afgekapt tot de datum. `check-import-datum-zonder-tijd.ts` (ronde 3) toetst dat zo'n tijd behouden blijft; in
  een vreemd bestand houdt de tijdregel die tijd ook zonder promotie, dus die toets bewaakt het signaal zelf niet.
- Na de promotie haalt `readMSPDI` de pauzevelden weg van elke kalender in `hourModeCalIds`, omdat de blokken van een
  uurkalender de pauze al dragen. `check-mspdi-werktijd-minuten.ts` §4d eist een uurkalender zonder pauzevelden.
- `<MinutesPerDay>` geldt alleen voor de projectkalender (`projectFileHoursPerDay`), en `readMSPDI` zet hem na de
  promotie terug: de opgeslagen uren per dag mogen afwijken van de blokken en gaan ongewijzigd terug bij export, de
  blokken rekenen en tonen (eigenaarsbesluit 2026-10-15, `check-urenperdag-heropenen.ts`).
