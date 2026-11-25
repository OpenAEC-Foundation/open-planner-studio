# Werkdagen wisselen in een uurkalender

Bij een uurkalender rekent de motor met het werkdagmasker (`workDays`) voor de dagtelling en met de blokken
(`workTime`) voor de uren. Zet een werkdagknop alleen `workDays`, dan verdween die werkdag na opslaan en heropenen.
Daarom gaan bij een uurkalender de blokken mee: `workDayTogglePatch` voor één werkdagknop, `workDaysSetPatch` voor de
knop *Ma–vr* in het kalendervenster en voor MCP `planner_update_calendar` met alleen `workDays` (ADR 0105). Een
afwijkende `hoursPerDay` blijft daarbij staan (`docs/ifc-round-trip.md`, "Uren per dag bij een blokkenkalender").

## Gevolgen

- De beginstand (`WorkTimeSessionStart`: `workTime` en `hoursPerDay`) is de kalender zoals het kalendervenster hem in
  deze sessie opende, of zoals de laatste preset hem zette. `CalendarDialog` bewaart hem per kalender in zijn eigen
  state, niet in de store; één MCP-aanroep is één sessie. De regel van de uren per dag wordt één keer op de
  beginstand bepaald, zodat alle wissels in een sessie samen als één wissel tellen en de klikvolgorde niets uitmaakt.
- `hoursPerDayFollowsBlocks` is waar zonder `workTime` in de beginstand, en waar als die blokken geen dagsom hebben
  (geen enkel blok, `deriveHoursPerDay` geeft `NaN`). Een dagkalender krijgt zijn uren per dag uit begin, einde en
  pauze, en een week zonder blok heeft niets om van af te wijken; zo maakt een wissel nooit zelf een afwijking. Anders
  is hij alleen waar als `hoursPerDayDiffers` onwaar is (ADR 0323). `hoursPerDayForBlocks` geeft dan de modale dagsom
  van de nieuwe blokken, of zonder enig nieuw blok de oude waarde; volgt hij niet, dan blijft de oude waarde.
- `workDayTogglePatch` zet bij een dagkalender, of bij een dag buiten 1 tot en met 7, alleen `workDays`. Bij een
  uurkalender krijgt een dag die uit gaat lege blokken, en een dag die aan gaat, in deze volgorde: (1) zijn eigen
  blokken uit de beginstand, als die er zijn (een korte vrijdag komt zo als korte vrijdag terug); (2) een kopie van de
  eerste werkdag met blokken (`firstBlockedDay`, zondag eerst); (3) de eerste werkdag met blokken van de beginstand;
  (4) de blokken uit de enkelvoudige werkdag (`seedScalarBands` met begin, einde, uren per dag en pauze); (5) als dat
  niets geeft, `STANDARD_DAY_BLOCKS`. Zo krijgt een dag die aan gaat altijd minstens één blok. Toetsen:
  `check-werkdag-einde.ts` §6, §6b, §6c en §6e, en `check-urenperdag-dagwissel.ts` §1.
- `STANDARD_DAY_BLOCKS` is 07:00 tot 12:00 en 13:00 tot 16:00: de effectieve blokken van een nieuwe kalender
  (`createDefaultCalendar`: 07:00 tot 16:00, 8 uur, en `seedScalarBands` legt het uur pauze op 12:00) en van de knop
  *Ma–vr* bij een kalender zonder blokken (`applyWeekdaysPreset` in `CalendarForm`), dus een werkdag die de planner
  kent.
- `workDaysSetPatch` zet eerst de dagen aan en daarna de andere uit, zodat een dag die aan gaat nog van een bestaande
  werkdag kan kopiëren. De uren per dag komen uit de beginstand, of zonder sessie uit de kalender van vóór de zet, dus
  de hele zet is één wissel. Toetsen: `check-urenperdag-dagwissel.ts` §2 en `check-werkdag-einde.ts` §6d.
