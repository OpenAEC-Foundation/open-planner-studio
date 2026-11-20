# Twee soorten nivelleervertraging, twee regels

Een taak kan op twee manieren een nivelleervertraging dragen. `levelingDelay` (hele werkdagen) zet alleen de
`ResourceLeveler`; die wordt altijd toegepast, ook op een wortel, omdat de opgeslagen `scheduleStart` niets van de
nivellering weet (anders blijft "B" in `lvl-basic-conflict` ongenivelleerd). `levelingDelayMinutes` en
`levelingDelayElapsed` komen alleen uit LEVELING_DELAY van een `.mpp`-bestand; die worden alleen toegepast als de
vroege start door een voorganger bepaald is. Voor een `.mpp`-wortel is `scheduleStart` al het eindantwoord van MS
Project, inclusief nivellering, en nog eens toepassen telt dubbel (`mpp14barstyle.mpp`). Een door een voorganger
bepaalde start is vers berekend en kent de vertraging nog niet (MS Project: haalbare start plus vertraging). Van de
19 `.mpp`-taken met `levelingDelayMinutes` in het corpus hebben er 14 een voorganger; de vijf zonder zijn precies
`mpp14barstyle.mpp`. Een wortel met constraint en vertraging komt niet voor en volgt de wortelregel
(`msp-53-z6-anker-regel-wortel-met-constraint`).

## Gevolgen

- Na een vertraging in werktijd her-snapt de start met `snapSuccessorEarlyStart`: een vertraging die op een
  blokeinde eindigt (di 16:00) start op het volgende blokbegin (wo 08:00), anders gaf de blokeinde-regel voor een
  rauw wortelanker een taak met duur nul (`bg140-*` in `cases-hours-blokgrenzen.json`). Dat geldt ook als een
  dagenvertraging samen met haar minutenwaarde is vastgelegd.
- Een vertraging in kalendertijd op een taak in werktijd is een kale klokoptelling; de taak snapt daarna naar een
  werkmoment (`msp-48-z6-elapsed-delay`). Een kalendertijdtaak zelf blijft ongesnapt
  (`msp-51-z6-invariant-elapsed-opvolger-hele-dagen-delay`).
- De late start trekt de vertraging niet af (`subDuration`): de late finish komt los van de eigen vroege start
  binnen, en een aftrek daar zou de vertraging dubbel in de totale speling tellen. Wel verschuift de achterwaartse
  doorgifte de late datums van een vertraagde opvolger met haar vertraging terug voordat ze op de voorganger drukken
  (`shiftByLevelingDelay` met teken −1), net zoals een relatie-lag symmetrisch telt. Zonder die spiegel toont de
  voorganger in een keten P → A (vertraging) → S zoveel speling als de vertraging, terwijl ze kritiek is.
