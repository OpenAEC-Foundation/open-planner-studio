# FS zonder lag tussen twee kalenders: de opvolger eerst als de landingsdag gelijk is

Bij FS zonder lag normaliseert de lagstap de finish van de voorganger eerst op de lagkalender, standaard die van de
voorganger, en pas daarna op de kalender van de opvolger. Werkt de opvolger op een dag die de voorganger niet kent
(een werkende zaterdag), dan duwt die eerste stap de grens al voorbij die dag. In `OzBuild Workshop 14 End Para
29.mpp` staat de opvolger in MS Project op zaterdag 08:00 en kwam OPS op maandag uit (verslag T16c-M1 in
`docs/superpowers/plans/2026-08-15-plan-mpp-datumgetrouwheid.md`, gemeten toen de solver nog in dagen rekende).
`forwardHour` normaliseert de grens daarom direct op de kalender van de opvolger (`se.nextWorkInstant`) als
`calendarsAgreeOnSharedWorkdayBands` zegt dat de twee kalenders op de landingsdag dezelfde werkblokken hebben. De
landingsdag is de kalenderdag van de rauwe voorgangerfinish. Verschillen de blokken op die dag, dan blijft de
voorganger eerst, zoals `msp-04-m2-guard1-alleen-crosscalendar` en `msp-39` in `cases-msp-pariteit.json` verwachten:
met andere blokgrenzen kan het moment van de voorgangerfinish binnen een blok van de opvolger vallen.

## Gevolgen

- De vergelijking gebruikt `effectiveBandsOn` van die ene datum, met werkende uitzonderingen en feestdagen
  (ADR 0222), niet de weekdagtabel (`msp-45`). Een verschil op een andere dag, zoals de zaterdag zelf, telt niet: dat
  is juist het verschil dat de opvolger eerst moet laten zien (`msp-38`). De blokken worden op begin gesorteerd vóór de
  vergelijking, zodat dezelfde blokken in een andere volgorde gelijk zijn (`msp-43`). Werkt één van de twee kalenders
  die dag niet en de ander wel, dan zijn ze niet gelijk (`msp-44`); werken ze allebei niet, dan wel.
- De tak geldt alleen voor twee gewone taken met een lag in werktijd: niet voor een eindmijlpaal of startmijlpaal als
  opvolger (`msp-41`), niet voor een opvolger in kalendertijd (`msp-42`, zie knownbug 2307), niet voor een voorganger
  met `predEndsBeginOfDay` (ADR 0271), en niet bij `p6StartAtPredecessorFinishBoundary` (B1, ADR 0029), dat eerder
  terugkeert. Het bewijs dekt alleen twee gewone taken.
- `backwardHour` heeft geen tegenhanger: de achterwaartse FS-tak heeft geen tweede normalisatie op de andere
  kalender die zo'n tak zou overslaan, maar zet de grens met `prevWorkInstant` op de voorgangerkalender. Voorwaarts
  zet `forwardPass` de vroege start daarna nog met `snapSuccessorEarlyStart` op de kalender van de opvolger, ongeacht
  welke tak de grens gaf.
