# Hoe de IFC-writer taakdatums, duren en lags schrijft

Welke vorm een duur, rest, werkelijke duur, lag of speling krijgt (hele dagen `P{n}D`, een breuk als `PT…` met een
record in `DayMeasureDurations`, `ExactMinutes`, `ExactFloat` of `DayMeasureLags`), en wat v2026.9.0 ervan leest,
staat in *Dagenmaat met een breuk, lagmaat en speling* in `docs/ifc-round-trip.md`; dat is het contract. De lijst van
taakslots staat in `ifcTaskSlots.ts`; writer en lezer gebruiken dezelfde lijst, zodat de plek van een slot niet kan
uiteenlopen. Hier staan de keuzes daaromheen die een lezer zonder uitleg zou terugdraaien.

## Gevolgen

- De eenheid van de taak bepaalt de maat, niet de kalender: een urentaak schrijft werkminuten (`PT…H…M…S`) en de
  echte tijd van de dag, een dagtaak de dagenmaat volgens het contract hierboven. Een dagtaak van 2,5 dag op een
  kalender van acht uur gaat dus als `PT20H0M0S` met een record, en bij een breuk in alleen de rest gaan duur en rest
  allebei als `PT…` (`dayTaskWritesMinutes`). Een uurkalender maakt van een dagtaak geen urentaak. Eén formatter per
  taak (`taskDateTimeFormatter`) geldt voor de taakslots en voor de planomvang.
- Een datum van een dagtaak zonder tijd krijgt het anker `T07:00:00` (`IFC_TIME_ANCHOR`, gedeeld met de lezer), bij
  een urentaak `T00:00:00`. Een tijd zonder seconden krijgt `:00`, want `IfcDateTime` vraagt seconden. Of een datum met
  zijn echte tijd het bestand ingaat, beslist `minuteModelWriteView` per kalender (*Letterlijke kalender blijft
  letterlijk* in `docs/ifc-round-trip.md`).
- Krijgt `ifcDuration` toch een niet-heel aantal dagen, dan rondt `ifcDayNumber` het af op 6 decimalen. De fijnste
  kalender (24 uur) heeft 1440 minuten per dag; de afrondfout is hooguit 5·10⁻⁷ dag, 0,0007 minuut, dus dagen × uren
  per dag × 60 geeft na teruglezen dezelfde minuut. Zo komt er geen float-ruis (`0.30000000000000004`) en geen
  exponent (`1e-7`) in het bestand. Hele dagen en niet-eindige waarden blijven ongewijzigd. In de merge met een vreemd
  deel kan een bronvorm met meer cijfers blijven staan (`ifcDurationExact`, ADR 0146).
- Een negatieve duur heeft het minteken vóór de P (`-P0Y0M2D`), zoals ISO 8601 het schrijft. Beide lezers, ook die
  van v2026.9.0, lezen het voorloopteken.
- `StatusTime` staat alleen op een taak met een werkelijk begin of einde, en dan alleen als het project een
  statusdatum heeft; het is die statusdatum. Werkelijke duur, rest en voltooiing hebben elk hun eigen voorwaarde
  (`writeTask` en `IFC_TASKTIME_SLOTS`).
- De rest van een urentaak komt uit `remainingMinutes` als die gezet is, anders uit `remainingTime`.
- `IFCLAGTIME` volgt het schema: `LagValue` op plek 4, `DurationType` (`.WORKTIME.` of `.ELAPSEDTIME.`) op plek 5.
  Oudere versies hadden die twee omgewisseld; de lezer kent beide (ADR 0050). Een relatie krijgt een `IFCLAGTIME` als
  `lagDays` niet 0 is, `lagPercent` een eindig getal is of `lagMinutes` een eindig getal ongelijk aan 0.
- Een procentlag is `IFCRATIOMEASURE` met decimale punt: 50 % is `0.5`, 100 % is `1.`. Zo beschrijft IFC 4.3 "start
  als de voorganger voor de helft klaar is". Een procent gaat voor minuten en dagen.
- Een lead krijgt het voorloopteken (`-P2D`). Niet elke andere tool leest dat teken; de eigen round-trip behoudt het.
- Toetsen: `check-ifc-dagenmaat.ts`, `check-ifc-real-values.ts`, `check-ifc-roundtrip.ts`.
