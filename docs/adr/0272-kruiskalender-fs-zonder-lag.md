# FS zonder lag tussen twee kalenders: soms direct op de kalender van de opvolger

Bij FS met een lag in werktijd verschuift `forwardHour` de finish van de voorganger eerst op de lagkalender
(`shiftLagPred` op de kalender die `lagEngine` uit `lagCalendar` kiest) en zet de grens daarna op een werkmoment van de
opvolger (`finishStartLaggedStart`). Bij lag 0 kan die eerste stap al een werkdag overslaan die alleen de opvolger
kent, zoals een werkende zaterdag. In `OzBuild Workshop 14 End Para 29.mpp` begint de opvolger in MS Project op
zaterdag 08:00 en gaf OPS maandag (verslag T16c-M1 in `docs/superpowers/plans/2026-08-15-plan-mpp-datumgetrouwheid.md`,
gemeten toen de solver nog in dagen rekende). Daarom neemt `forwardHour` bij lag 0 een tweede route, direct
`se.nextWorkInstant` op de rauwe finish, als `calendarsAgreeOnSharedWorkdayBands` zegt dat de kalender van de
voorganger (`pe`, niet de lagkalender) en die van de opvolger op de landingsdag dezelfde werkblokken hebben. De
landingsdag is de kalenderdag van de rauwe voorgangerfinish. Verschillen de blokken die dag, dan blijft de gewone
route, zoals `msp-39` en `msp-04-m2-guard1-alleen-crosscalendar` in `cases-msp-pariteit.json` verwachten: met andere
blokgrenzen kan de rauwe finish binnen een blok van de opvolger vallen.

## Gevolgen

- De vergelijking gebruikt `effectiveBandsOn` van die ene datum, met werkende uitzonderingen en feestdagen (ADR 0222),
  niet de weekdagtabel (`msp-45`). Een verschil op een andere dag, zoals de zaterdag zelf, telt niet (`msp-38`). De
  blokken worden op begin gesorteerd vóór de vergelijking (`msp-43`). Werkt één van de twee kalenders die dag niet en
  de ander wel, dan zijn ze niet gelijk (`msp-44`); werken ze allebei niet, dan wel.
- Buiten de tweede route vallen: een eindmijlpaal of startmijlpaal als opvolger (`msp-41` voor de startmijlpaal), een
  opvolger in kalendertijd (`msp-42`) en een voorganger met `predEndsBeginOfDay`; een B1-relatie
  (`p6StartAtPredecessorFinishBoundary`, ADR 0029) keert eerder terug. Een voorganger die een expliciete eindmijlpaal
  is, valt er wel onder.
- `backwardHour` heeft geen tweede route. Bij FS met een lag in werktijd telt het eerst terug op de lagkalender
  (`shiftLagPred` op de kalender uit `lagEngine`) vanaf de late start van de opvolger en zet het resultaat daarna met
  `prevWorkInstant` op de voorgangerkalender; de uitzonderingen op die laatste stap staan in ADR 0271 en 0273.
