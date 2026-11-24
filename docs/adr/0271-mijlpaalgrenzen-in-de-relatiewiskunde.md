# Een mijlpaal in een relatie is een grens, geen werkmoment

Een mijlpaal zonder duur heeft één moment, en dat moment kan op een blokeinde liggen. De normalisatie voor een start
(`[begin, einde)`, ADR 0014) zou zo'n moment naar het volgende blokbegin duwen. `relationBoundaryFlags` legt daarom per
relatie vast welke kant een grens is, en beide richtingen lezen die ene uitkomst. `predEndsBeginOfDay`: de voorganger
heeft geen duur (`scheduleDuration <= 0`) en is geen mijlpaal van soort `FINISH`. `predStartsNextDay`: de voorganger
heeft geen duur en is een mijlpaal van soort `FINISH`. De voorgangervlaggen eisen dus eerst nul duur, omdat een
mijlpaal met duur een echte finish heeft. `succIsFinishMs`: de opvolger is een mijlpaal van soort `FINISH`, of onder
A15 (`p6ZeroDurationSuccessorAtFinish`, ADR 0029) een nulduurmijlpaal (`isZeroDurationMilestone`), met welke soort ook.
`succIsStartMs`: de opvolger is een mijlpaal van soort `START` en valt niet onder A15. De opvolgervlaggen lezen de duur
alleen onder A15; zie knownbug 2306.

## Gevolgen

- Een eindmijlpaal als opvolger krijgt bij FS, FF en SF zonder lag de kant van de voorganger als grens (bij SF het
  startmoment, met de regel voor `predStartsNextDay` hieronder), niet het volgende blokbegin. "Zonder lag" is bij een
  lag in werktijd: de verschoven waarde is gelijk aan de kale normalisatie op de lagkalender (`lagIsZero` in de FS-tak,
  `zeroLag` in `finishFinishRequirement`, dezelfde vergelijking in `sfReqFinishHour`), zodat ook een ingevoerde lag die
  nul werktijd oplevert als nul telt. Bij een lag in kalendertijd geldt de regel alleen voor FS, bij nul klokminuten
  (ADR 0273). Een echte lag telt wel. Eindmijlpaal is hier bij FS en SF de vlag `succIsFinishMs`: een expliciete
  eindmijlpaal, of onder A15 een nulduurmijlpaal. Bij FF is het die vlag of een nulduurmijlpaal zonder soort
  (`finishFinishRequirement`); dat is de enige plek waar het relatietype een mijlpaal zonder soort tot eindmijlpaal
  maakt (spec alleen uren, §4.3). Of de solver zo'n moment daarna laat staan, beslist `snapSuccessorEarlyStart` (ADR
  0014). Zonder die regel in de FS-tak (`succIsFinishMs` met `lagIsZero`) worden `msp-01c`, `msp-03` en `msp-37` in
  `cases-msp-pariteit.json` rood. Bij FS geldt de regel ook als de voorganger `predEndsBeginOfDay` heeft, omdat een
  voorganger zonder duur op de statusdatumvloer op een blokeinde van zijn eigen kalender kan staan; geen geval in
  `cases-msp-pariteit.json` of `cases-hours-relations.json` wordt rood als die voorganger wordt uitgesloten, ook
  `msp-06b` niet. Het weggehaalde commentaar noemde dit pariteit met MS Project; een bestand van MS Project dat het
  laat zien, is niet nagegaan.
- FS met een echte lag in werktijd naar een eindmijlpaal (`finishStartLaggedStart`): de grens is het eindmoment op of vóór het
  moment na de lag (`snapOnOrBefore` op de opvolgerkalender) als dat het moment zelf is, of als het volgende werkmoment
  van de opvolgerkalender na dat eindmoment het moment na de lag is en de lagkalender ertussen geen werkminuut heeft;
  anders het volgende werkmoment van de opvolger. `nextWorkInstant` alleen zou een blokeinde overslaan. De functie is
  gedeeld met de externe voorganger (`externalForwardBound`, review van #808; ADR 0022).
- `predStartsNextDay` zet bij SS en SF de grens strikt voorbij de start van de voorganger (`snapStrictAfter`,
  achterwaarts `snapStrictBefore`); voorwaarts bij SF niet voor een opvolger in de dagenmaat (ADR 0274). Zie knownbug
  153.
- FF naar een startmijlpaal, bij een voorganger zonder `predEndsBeginOfDay`, geeft het moment strikt na de geëiste
  finish (`snapStrictAfter`). Uitzondering in `forwardHour` en spiegelbeeldig in `backwardHour`: telt de voorganger in
  de dagenmaat en is de lag geen kalendertijd, dan blijft een moment midden in een werkblok (`isInsideBlock`) staan.
  Voor een voorganger in de urenmaat blijft "strikt na", omdat de bredere correctie drie C7-controles rood maakte
  (knownbug 230). C7 (`p6FinishFinishStartMilestoneLateFinish`) zet `succIsStartMs` voor FF uit (ADR 0029).
- Achterwaarts bij FS met een lag in werktijd kiest `backwardHour` eerst een doel en normaliseert dat daarna. Het doel
  is de late start van de opvolger min de lag; bij lag 0 met een voorganger met `predEndsBeginOfDay` of een expliciete
  eindmijlpaal als opvolger is het de ongenormaliseerde late start. Een lag telt dus altijd mee: de vlaggen slaan
  alleen de normalisatie over, anders zouden voorwaarts en achterwaarts uiteenlopen. De normalisatie is
  `prevWorkInstant`, behalve bij een voorganger met `predEndsBeginOfDay` en bij een voorganger in kalendertijd (ADR
  0273). Een dagbeginanker zou `prevWorkInstant` naar het vorige blokeinde zetten, op de werkas dezelfde plek maar een
  andere datum (`rr-fs-pred-startms` in `cases-hours-relations.json`). Een lag in kalendertijd heeft een eigen tak.
