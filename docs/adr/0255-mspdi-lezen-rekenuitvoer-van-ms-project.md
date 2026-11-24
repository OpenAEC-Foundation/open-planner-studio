# MSPDI lezen: de rekenuitvoer van MS Project als datums zoals opgeslagen

MSPDI draagt ook wat MS Project zelf uitrekende: vroege en late datums, speling en kritiek. `readMSPDI` geeft dat als
apart kanaal (`ImportResult.recordedTimes`, herkomst `mspdi`) en nooit als invoer voor de solver, en alleen voor
bladtaken (`leafRecordedTimes`); wat het kanaal in de app doet, staat in de regel `state` (Datums zoals opgeslagen,
issue #63). Zonder `EarlyStart` of `EarlyFinish` zijn `Start` en `Finish` de vastlegging
(`check-recorded-times-formats.ts` 2f). Zonder leesbare start of einde krijgt de taak geen vastlegging, en een andere
as die het bestand niet heeft, blijft weg (`buildRecordedTime`).

## Gevolgen

- `TotalSlack` en `FreeSlack` staan in tienden van een minuut. De lezer rekent ze om naar dagen met de werktijd per
  dag van de taakkalender (`effHoursPerDay`), niet met `<MinutesPerDay>`, zoals de XER-lezer: de werktijd rekent en
  toont (eigenaarsbesluit 2026-10-15, "een dag"). `check-urenperdag-heropenen.ts` toetst `TotalSlack` op een kalender
  met blokken van 10,5 uur en `<MinutesPerDay>` 480.
- `Critical` telt alleen als `1` of `0`; elke andere waarde laat de kritiek weg.
