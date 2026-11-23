# Nivelleren: venster, zoekgrens en de reden van een conflict

Vindt `findSlot` geen venster en geen onderbroken plaatsing (ADR 0165), dan blijft de taak op haar eerste kandidaat
staan met haar conflictdagen en één reden (`LevelingReason`); het nivelleervenster kiest op die reden de uitleg. De
nivelleerder onderscheidt daarvoor het venster van de zoekgrens. Het venster is een keuze van de planner: smoothing,
een uitloopplafond (`overrunCeilingDays`) of het strengste van beide (`windowLimit`); een plafond van 0 en smoothing
geven hetzelfde venster (`check-leveler-ceiling.ts`, geval 1). De zoekgrens is een rekengrens (`scanLimit`, verlengd
door `horizonIso` en begrensd door `HARD_SCAN_CAP`). Dat een rekengrens op is, zegt niets over capaciteit; daarom
bestaat er naast de capaciteitsredenen een eigen reden, `NO_WINDOW_IN_HORIZON`.

In de lus van `findSlot` staat de toets van het volgende moment tegen het venster vóór de toets tegen de zoekgrens,
omdat het venster een keuze van de planner is en de zoekgrens een rekengrens. De eerste kandidaat toetst `findSlot`
vóór die grenscontrole, dus ook als hij al na het venster ligt.

De reden beschrijft de kandidaten die de scan heeft gezien, niet wat er verderop nog past. Volgorde en voorwaarden
staan in `reasonFor` en `findSlot`. Dat de reden kan afwijken van wat verderop wel past, staat in knownbug 1982
(de zoekgrens) en 1984 (de volgorde).

## Gevolgen

- `RESIDUAL_FULL` gaat in `reasonFor` vóór `CEILING_TOO_TIGHT`: in de omgekeerde volgorde won met een plafond altijd
  `CEILING_TOO_TIGHT`, ook als alleen andere documenten de pool bezetten (ADR 0163).
- `CEILING_UNREACHABLE` bestaat alleen met een uitloopplafond, en kijkt alleen naar de eerste kandidaat tegenover het
  venster (`findSlot`; `check-leveler-ceiling.ts`, geval 3).
- Een resource met capaciteit 0 op een werkdag is een capaciteitsprobleem, geen kalenderprobleem: `calendarOk` kijkt
  naar de kalender van de resource (`isResWorkDay`), niet naar `capacityOf` (`check-leveler-seam.ts`, geval 1). Een
  dag zonder vraag van de taak telt niet als haar conflict, ook als een andere taak die dag overboekt
  (`check-leveler-seam.ts`, geval 3).
- Een scan met onderbrekingen die op de zoekgrens leeg loopt, geeft die uitputting door aan `findSlot` (ADR 0165);
  anders ging ze verloren en koos `reasonFor` een capaciteits- of plafondreden.
