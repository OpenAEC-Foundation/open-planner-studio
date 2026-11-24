# P6 XML lezen: de rekenuitvoer van P6 als datums zoals opgeslagen

P6 XML draagt ook wat P6 zelf uitrekende: vroege en late datums, speling en kritiek. `readP6XmlProject` geeft dat per
activiteit als apart kanaal (`ImportResult.recordedTimes`, herkomst `p6xml`, via `buildRecordedTime`) en nooit als
invoer voor de solver: `task.time` krijgt de geplande datums (`check-recorded-times-formats.ts` 1e). Wat het kanaal in
de app doet, staat in de regel `state` (Datums zoals opgeslagen, issue #63).

## Gevolgen

- Een vastlegging vraagt een vroege start en een vroeg einde: `EarlyStartDate` en `EarlyFinishDate`, en elk zonder die
  uit `StartDate` en `FinishDate` (1f). Ontbreekt na die terugval een van de twee, dan levert de lezer voor die
  activiteit geen vastlegging, ook als late datums, speling of kritiek er staan (`buildRecordedTime`, 1g). Met beide
  datums neemt hij de late datums, de speling en de kritiek op die het bestand draagt; een ontbrekende as blijft weg
  (1c). Alle datums lezen met de tijdregel van de taak (ADR 0264).
- De lezer neemt `TotalFloat` en `FreeFloat` als uren en rekent ze om naar dagen met `effHoursPerDay` van de
  effectieve kalender van de taak, zoals de XER-lezer (`readXerRecordedTimes`), omdat de werktijd rekent en toont
  (eigenaarsbesluit 2026-10-15, "een dag"); op een uurkalender is dat de werktijd van de blokken en niet de opgeslagen
  `HoursPerDay` (`check-urenperdag-heropenen.ts` §3: 105 uur speling op blokken van 10,5 uur is 10 dagen).
- `IsCritical` telt als kritiek bij `true` of `1` en als niet kritiek bij `false` of `0`; bij elke andere waarde legt
  de lezer geen kritiek vast. `check-recorded-times-formats.ts` 1b toetst `false`.
