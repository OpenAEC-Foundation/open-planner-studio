# MSPDI lezen: de rekenuitvoer van MS Project als datums zoals opgeslagen

MSPDI draagt ook wat MS Project zelf uitrekende: vroege en late datums, speling en kritiek. `readMSPDI` geeft dat als
apart kanaal (`ImportResult.recordedTimes`, herkomst `mspdi`, via `buildRecordedTime`) en nooit als invoer voor de
solver, en alleen voor bladtaken (`leafRecordedTimes`); wat het kanaal in de app doet, staat in de regel `state`
(Datums zoals opgeslagen, issue #63). Zonder `EarlyStart` of `EarlyFinish` zijn `Start` en `Finish` de vastlegging
(`check-recorded-times-formats.ts` 2f).

## Gevolgen

- `TotalSlack` en `FreeSlack` staan in tienden van een minuut. De lezer rekent ze om naar dagen met `effHoursPerDay`
  van de taakkalender, zoals de XER-lezer, omdat de werktijd rekent en toont (eigenaarsbesluit 2026-10-15, "een dag").
  Op een uurkalender is dat de werktijd van de blokken en niet `<MinutesPerDay>`: `check-urenperdag-heropenen.ts` §3
  leest 105 uur speling op blokken van 10,5 uur als 10 dagen. Op een scalaire kalender is het de opgeslagen
  `hoursPerDay`; voor de projectkalender is dat `<MinutesPerDay>` als het bestand hem draagt (ADR 0252).
- `Critical` telt alleen als `1` (kritiek) of `0` (niet kritiek); bij elke andere waarde, ook `true` en `false`, legt
  de lezer geen kritiek vast. `check-recorded-times-formats.ts` toetst `0` en een afwezig veld.
