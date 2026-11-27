# XER: de vastgelegde rekenuitvoer zoals ze in het bestand staat

`readXerRecordedTimes` (`xerRecordedTimes.ts`) leest de zes kolommen van bak 4 (regel `xer`) als weergave. Een taak
krijgt een vastlegging alleen met een leesbare `early_start_date` én `early_end_date`. De lezer corrigeert daarna niets: ook een vroeg einde vóór de vroege start blijft staan. Reden uit het
weggehaalde commentaar, gemeten op het corpus en niet nagegaan: voor een voltooide activiteit is dat de vorm van de
bron. In `rehab-2.xer` (P3-uitvoer) staat bij 2.036 voltooide taken de vroege start op de statusdatum en het vroege
einde op het einde van de werkdag ervoor; Roads zet bij voltooide taken start en einde gelijk. Geen van beide is een
werkelijke datum; welke datum de weergave toont, kiezen `shownStart`/`shownFinish` (`utils/taskDates.ts`). Een toets op de volgorde gooide 29 % van de vastlegging van `rehab-2.xer` weg.

## Gevolgen

- `isCritical` is een afleiding en geen gelezen kolom: totale speling in uren tegen de drempel van
  `ctx.criticalDefinition` (standaard 0), dezelfde definitie die de solver krijgt (ADR 0396). Onder longest-path is
  hij `undefined`, want uit een speling volgt niet welke keten P6 als langste markeerde.
- Zonder een omrekenbare totale speling (leeg, of een kalender zonder positieve minuten per dag) is `isCritical` ook
  `undefined`, en geen `false`: anders zegt de tabel "niet vastgelegd" terwijl CSV en MCP een harde `false` naar buiten
  dragen.
