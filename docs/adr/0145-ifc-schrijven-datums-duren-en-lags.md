# Hoe de IFC-writer taakdatums, duren en lags schrijft

De vorm van een gebroken dag, de records in `DayMeasureDurations`, `ExactMinutes`, `ExactFloat` en `DayMeasureLags`,
en wat v2026.9.0 ervan leest, staan in *Dagenmaat met een breuk, lagmaat en speling* in `docs/ifc-round-trip.md`. De
lijst van taakslots staat in `ifcTaskSlots.ts`; writer en lezer gebruiken dezelfde lijst, zodat de plek van een slot
niet kan uiteenlopen. Hier staan de keuzes daaromheen die een lezer zonder uitleg zou terugdraaien.

## Gevolgen

- De eenheid van de taak bepaalt de vorm, niet de kalender: een dagtaak schrijft `P…D` (werkdagen) en het daganker,
  een urentaak `PT…H…M…S` (werkminuten) en de echte tijd van de dag. Een uurkalender maakt van een dagtaak geen
  urentaak. Eén formatter per taak (`taskDateTimeFormatter`) geldt voor de taakslots en voor de planomvang.
- Een datum van een dagtaak zonder tijd krijgt het anker `T07:00:00` (`IFC_TIME_ANCHOR`, gedeeld met de lezer), bij
  een urentaak `T00:00:00`. Een tijd zonder seconden krijgt `:00`, want `IfcDateTime` vraagt seconden.
- Krijgt `ifcDuration` toch een niet-heel aantal dagen, dan rondt `ifcDayNumber` het af op 6 decimalen. De fijnste kalender (24 uur) heeft 1440 minuten per dag; de afrondfout is hooguit
  5·10⁻⁷ dag, 0,0007 minuut, dus dagen × uren per dag × 60 geeft na teruglezen dezelfde minuut. Zo komt er geen
  float-ruis (`0.30000000000000004`) en geen exponent (`1e-7`) in het bestand. Hele dagen en niet-eindige waarden
  blijven ongewijzigd.
- Een negatieve duur heeft het minteken vóór de P (`-P0Y0M2D`), zoals ISO 8601 het schrijft. Beide lezers, ook die
  van v2026.9.0, lezen het voorloopteken.
- `StatusTime` staat alleen op een taak met een werkelijk begin of einde, en is dan de statusdatum van het project.
  Een taak zonder werkelijke datums houdt de voortgangsslots op `$`.
- De rest van een urentaak komt uit `remainingMinutes`, die van een dagtaak uit `remainingTime`.
- `IFCLAGTIME` volgt het schema: `LagValue` op plek 4, `DurationType` (`.WORKTIME.` of `.ELAPSEDTIME.`) op plek 5.
  Oudere versies hadden die twee omgewisseld; de lezer kent beide (ADR 0050). Een relatie zonder lag (nul dagen,
  geen procent, nul minuten) krijgt geen `IFCLAGTIME`.
- Een procentlag is `IFCRATIOMEASURE` met decimale punt: 50 % is `0.5`, 100 % is `1.`. Zo beschrijft IFC 4.3 "start
  als de voorganger voor de helft klaar is".
- Een lead krijgt het voorloopteken (`-P2D`). Niet elke andere tool leest dat teken; de eigen round-trip behoudt het.
- Toetsen: `check-ifc-dagenmaat.ts`, `check-ifc-real-values.ts`, `check-ifc-roundtrip.ts`.
