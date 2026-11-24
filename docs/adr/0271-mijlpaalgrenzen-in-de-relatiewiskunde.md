# Een mijlpaal in een relatie is een grens, geen werkmoment

Een mijlpaal zonder duur heeft één moment, en dat moment kan op een blokeinde liggen. De normalisatie voor een start
(`[begin, einde)`, ADR 0014) zou zo'n moment naar het volgende blokbegin duwen. `relationBoundaryFlags` legt daarom
per relatie vast welke kant een grens is, en beide richtingen lezen die ene uitkomst. De voorgangervlaggen
(`predEndsBeginOfDay`, `predStartsNextDay`) lezen de duur (`scheduleDuration <= 0`) en niet `isMilestone`, omdat een
mijlpaal met duur een echte finish heeft. De opvolgervlaggen (`succIsFinishMs`, `succIsStartMs`) lezen de
expliciete `milestoneKind` van een mijlpaal, of onder A15 de finishgrens (`p6ZeroDurationSuccessorAtFinish`,
ADR 0029); zie knownbug 2306.

## Gevolgen

- Een expliciete eindmijlpaal als opvolger krijgt bij FS, FF en SF met een lag in werktijd van 0 de kant van de
  voorganger als grens (bij SF met de regel voor `predStartsNextDay` hieronder), niet het volgende blokbegin; bij FS
  ook met een lag in kalendertijd van 0 minuten. Een nulduurmijlpaal zonder soort krijgt die regel alleen in de FF-tak
  (`finishFinishRequirement`); `sfReqFinishHour` leest de expliciete vlag. Of de solver zo'n moment daarna laat staan,
  beslist `snapSuccessorEarlyStart` (ADR 0014). Zonder die regel in de FS-tak (`succIsFinishMs` met `lagIsZero`)
  worden `msp-01c`, `msp-03` en `msp-37` in `cases-msp-pariteit.json` rood. Bij FS geldt de regel ook als de
  voorganger `predEndsBeginOfDay` heeft, omdat een voorganger zonder duur op de statusdatumvloer op een blokeinde van
  zijn eigen kalender kan staan; geen geval in
  `cases-msp-pariteit.json` of `cases-hours-relations.json` wordt rood als die voorganger wordt uitgesloten, ook
  `msp-06b` niet. Het weggehaalde commentaar noemde dit pariteit met MS Project; een bestand van MS Project dat het
  laat zien, is niet nagegaan.
- FS met een echte lag naar een eindmijlpaal (`finishStartLaggedStart`) mag op een eindmoment van de opvolgerkalender
  landen in plaats van op het volgende blokbegin, als de opvolgerkalender en de lagkalender het als dezelfde grens
  lezen; `nextWorkInstant` alleen zou een blokeinde overslaan. De functie is gedeeld met de externe voorganger
  (`externalForwardBound`, review van #808; ADR 0022).
- `predStartsNextDay` zet bij SS en SF de grens strikt voorbij de start van de voorganger (`snapStrictAfter`,
  achterwaarts `snapStrictBefore`); voorwaarts bij SF niet voor een opvolger in de dagenmaat (ADR 0274). Zie
  knownbug 153.
- FF naar een startmijlpaal, bij een voorganger zonder `predEndsBeginOfDay`, geeft het moment strikt na de geëiste
  finish (`snapStrictAfter`). Uitzondering in `forwardHour` en spiegelbeeldig in `backwardHour`: telt de voorganger
  in de dagenmaat en is de lag geen kalendertijd, dan blijft een moment midden in een werkblok (`isInsideBlock`)
  staan. Voor een voorganger in de urenmaat blijft "strikt na", omdat de bredere
  correctie drie C7-controles rood maakte (knownbug 230). C7 (`p6FinishFinishStartMilestoneLateFinish`) zet
  `succIsStartMs` voor FF uit (ADR 0029).
- Achterwaarts bij FS met een lag in werktijd kiest `backwardHour` eerst een doel en normaliseert dat daarna. Het
  doel is de late start van de opvolger min de lag; bij lag 0 met een voorganger met `predEndsBeginOfDay` of een
  expliciete eindmijlpaal als opvolger is het de ongenormaliseerde late start. Een lag telt dus altijd mee: de vlaggen
  slaan alleen de normalisatie over, anders zouden voorwaarts en achterwaarts uiteenlopen. De normalisatie is
  `prevWorkInstant`, behalve bij een voorganger met `predEndsBeginOfDay` en bij een voorganger in kalendertijd
  (ADR 0273). Een dagbeginanker zou `prevWorkInstant` naar het vorige blokeinde zetten, op de werkas dezelfde plek maar
  een andere datum (`rr-fs-pred-startms` in `cases-hours-relations.json`). Een lag in kalendertijd heeft een eigen
  tak.
