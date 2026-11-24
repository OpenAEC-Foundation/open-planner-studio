# Een grens voor een taak in kalendertijd gaat niet naar werktijd

Een taak in kalendertijd (`isElapsedTask`: `durationType` `ELAPSEDTIME` en geen nulduurmijlpaal) loopt op de klok
en heeft geen werkmoment. Normaliseert de relatiewiskunde een grens voor zo'n taak naar werktijd, dan schuift de taak
zonder reden naar het volgende of vorige werkblok. Daarom geeft ze voor een opvolger in kalendertijd (`succElapsed`)
bij SS, FF en SF de grens zonder die normalisatie, en achterwaarts bij FS met een lag in werktijd voor een
voorganger in kalendertijd (`predElapsed`) de grens zonder `prevWorkInstant`. `isElapsedTask` toetst de duur via `isZeroDurationMilestone`,
niet de kale `isMilestone`: een mijlpaal met duur in kalendertijd telt mee (`msp-30` in `cases-msp-pariteit.json`).

## Gevolgen

- SS naar een opvolger in kalendertijd met een effectieve lag van 0 (`resolveEffectiveLagDays`) houdt het rauwe
  startmoment van de voorganger, ook buiten werkblokken (`msp-28`). De lag zelf telt nog in de lagkalender; alleen de
  normalisatie op de kalender van de opvolger vervalt.
- Achterwaarts bij FS zou `prevWorkInstant` de late finish van een voorganger in kalendertijd naar de vorige werktijd
  terugtrekken; de grens is daar het ongesnapte moment (`msp-19`).
- FS voorwaarts kent die uitzondering niet: ook een opvolger in kalendertijd krijgt het volgende werkmoment van haar
  kalender (`se.nextWorkInstant`), met een lag in kalendertijd (knownbug 155) en met een lag in werktijd
  (knownbug 2307).
- Een lag in kalendertijd telt in klokminuten vanaf het anker, zonder lagkalender. Bij FS naar een eindmijlpaal blijft
  het moment na zo'n lag staan als de lag nul klokminuten is of als het een geldig eindmoment van de opvolger is
  (`snapOnOrBefore` geeft hetzelfde moment). Hier telt de kloktijd: anders dan in `finishStartLaggedStart` maakt nul
  werkminuten tussen ma 16:00 en di 08:00 die twee momenten niet gelijk.
