# Een grens voor een taak in kalendertijd gaat niet naar werktijd

Een taak in kalendertijd (`isElapsedTask`: `durationType` `ELAPSEDTIME` en geen nulduurmijlpaal) loopt op de klok
en heeft geen werkmoment (ADR 0016). Zou de relatiewiskunde een grens voor zo'n taak naar werktijd normaliseren, dan
schoof de taak zonder reden naar een werkblok. Daarom slaat ze voor een opvolger in kalendertijd (`succElapsed`) bij
SS, FF en SF de normalisatie op de kalender van de opvolger over, en achterwaarts bij FS met een lag in werktijd voor
een voorganger in kalendertijd (`predElapsed`) de normalisatie met `prevWorkInstant`. `isElapsedTask` toetst de duur
via `isZeroDurationMilestone`, niet de kale `isMilestone`: een mijlpaal met duur in kalendertijd telt mee, zoals in
ADR 0016.

## Gevolgen

- SS naar een opvolger in kalendertijd met een effectieve lag van 0 (`resolveEffectiveLagDays`) bewaart het gekozen
  startanker van de voorganger: haar vroege start, of bij `predStartsNextDay` het werkmoment strikt daarna
  (ADR 0271). `msp-28` in `cases-msp-pariteit.json` bewaakt dit voor een gewoon rauw anker op zaterdag.
- Achterwaarts bij FS zou `prevWorkInstant` de late finish van een voorganger in kalendertijd naar de vorige werktijd
  terugtrekken (`msp-19`).
- FS voorwaarts kent die uitzondering niet: de grens voor een opvolger in kalendertijd gaat door `se.nextWorkInstant`,
  bij een lag in kalendertijd (knownbug 155) en bij een lag in werktijd (knownbug 2307).
- Een lag in kalendertijd telt in klokminuten vanaf het anker, zonder lagkalender. Bij FS naar een eindmijlpaal blijft
  het moment na zo'n lag staan als de lag nul klokminuten is of als het een eindmoment van de opvolgerkalender is
  (`snapOnOrBefore` geeft hetzelfde moment). Hier telt de kloktijd: anders dan in `finishStartLaggedStart` maakt nul
  werkminuten tussen ma 16:00 en di 08:00 die twee momenten niet gelijk.
