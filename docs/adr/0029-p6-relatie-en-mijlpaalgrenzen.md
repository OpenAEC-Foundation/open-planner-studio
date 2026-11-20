# P6 kent grenzen op een blokeinde die de gewone normalisatie zou wegduwen

Een P6-kalender is uurprecies, en P6 laat een relatie of mijlpaal op een blokeinde staan waar de gewone
normalisatie naar het volgende blokbegin zou gaan. Een reeks conventies volgt dat, elk alleen op een kalender met
eigen werkblokken: B1 (`p6RelationFinishBoundary`), B2 (`p6BackwardLagFinishBoundary`), A15
(`p6ZeroDurationUsesPlannedBoundary`), A17 (`p6FinishMilestoneBoundaryWindow`), C7
(`p6FinishFinishStartMilestoneLateFinish`) en C12 (`p6FinishNotBeforeFinishFinishBound`). De regel per conventie
staat in de gids `ref-rekenopties-en-conventies.md`.

## Gevolgen

- B1: alle solverpaden en de relatiewiskunde zien alleen de effectieve relaties. Staat de conventie uit, dan haalt
  de constructor de relatievlag `p6StartAtPredecessorFinishBoundary` weg, zodat een losse vlag geen P6-gedrag
  aanzet. Dat beschermt niet tegen een vervalst bestand: de conventie reist bewust mee in `OPS_SchedulingProfile`,
  en wie een IFC met de conventie aan opent, kiest die semantiek. De late start van zo'n opvolger is een gewoon
  blokbegin (Hotel HCSWB1Z1240, LS 03-04 08:00); de finishgrens voor de voorganger legt de gewone FS-terugrekening.
- B2: een positieve lag in werktijd is in P6 een grensafstand. Trekt de late pass hem af vanaf een exact blokeinde
  en komt ze precies op het eerste blokbegin van een dag, dan wordt het het vorige blokeinde (wo 17:00 min twee
  werkdagen is ma 17:00, niet di 08:00). Bij FF zonder lag blijft een grens op een blokeinde die grens. Alleen de
  projectie van de relatie krijgt deze regel; de duuraftrek en de kalenderprimitieven blijven gewoon.
- A15: P6 bewaart TT_Mile als één type, maar de geplande grens maakt het verschil: staat de mijlpaal gepland op een
  blokeinde, dan blijft de finish van de voorganger geldig; op een blokbegin start ze op het volgende werkmoment.
  Een gewone activiteit (TT_Task, TT_Rsrc) met duur 0 en een omgekeerd gepland venster (finish vóór start) is een
  grenspaar: start op het volgende blokbegin, finish op de vorige kalenderdag op de klok van het geplande finishanker,
  ook als die dag niet werkt (hb-intel toont zondag 17:00 naast maandag 08:00 op een vijfdaagse kalender;
  `prevWorkInstant` zou naar vrijdag gaan). Achterwaarts is LF de finishrand en LS het eerste startmoment op of na
  die grens.
- A17: een eindmijlpaal met een omgekeerd gepland venster houdt dat venster zolang de netwerkuitkomst exact op het
  geplande startanker staat; latere relatiedruk wint. Een verbonden open eindmijlpaal zonder opvolger is een
  zelfstandig contracteindpunt: haar vroege datums zijn ook haar late en drukken terug op haar keten, ook als een
  andere taak het latere projecteinde bepaalt. Niet met `useProjectEndDateForFloat` (dan blijft dat projecteinde de
  grens) en niet voor een eindmijlpaal zonder voorgangers.
- C7: een FF naar een nulduur-STARTmijlpaal bindt aan de mijlpaal zelf, niet aan haar dagbegin. Achterwaarts geeft
  dat haar late finish; voorwaarts alleen de relatiegrens voor de vrije speling van een niet-bindende FF. De vroege
  start van de mijlpaal verandert nooit, en een bindende FF houdt de gewone grens en blijft driving. Niet in de
  nulrestduurtak van de late pass (ongemeten). Een eindmijlpaal valt erbuiten.
- C12: de vroege finish ligt in kloktijd nooit vóór de grens van een FF-relatie in werktijd. De grens is de
  voorgangerfinish plus lag, genormaliseerd naar de finishkant (een blokbegin wordt het vorige blokeinde), behalve
  bij een startmijlpaal als voorganger. Ligt de grens na de vroege finish zonder werkminuut ertussen, dan wordt de
  finish het eerste werkmoment op of na die grens. Ook voor het restwerk van een lopende taak (Roads A10660). Een
  voorganger in dagen geeft een lagkalender zonder werkblokken; daar is C12 niet gedefinieerd en loopt het gewone
  pad door. Een harde finishpin wint.
