# Een mijlpaal in een relatie is een grens, geen werkmoment

Een mijlpaal zonder duur heeft één moment, en dat moment kan op een blokeinde liggen. De normalisatie voor een start
(`[begin, einde)`, ADR 0014) zou zo'n moment naar het volgende blokbegin duwen. `relationBoundaryFlags` legt daarom
per relatie vast welke kant een grens is, en beide richtingen lezen die ene uitkomst. `predEndsBeginOfDay`: de
voorganger heeft geen duur (`scheduleDuration <= 0`) en is geen mijlpaal van soort `FINISH`; haar finish bezet geen
werktijd. `predStartsNextDay`: de voorganger heeft geen duur en is een mijlpaal van soort `FINISH`; haar start is een
eindgrens. `succIsFinishMs` en `succIsStartMs`: de opvolger is een mijlpaal van soort `FINISH` of `START`, of onder
A15 (`p6ZeroDurationSuccessorAtFinish`, ADR 0029) een nulduurmijlpaal op de finishgrens, die dan als `FINISH` telt.

## Gevolgen

- De voorgangervlaggen lezen de duur en niet `isMilestone`: een mijlpaal met duur heeft een echte finish. De
  opvolgervlaggen lezen wel `isMilestone` met `milestoneKind` (knownbug 2306).
- Een nulduurmijlpaal zonder soort telt na een FF- of SF-relatie als eindmijlpaal (`forwardHour`,
  `finishFinishRequirement`): een mijlpaal zonder soort volgt de bindende relatiekant (spec alleen uren, §4.3).
- `predStartsNextDay` zet een grens die aan de start van de voorganger hangt, SS en SF, strikt voorbij dat moment
  (`snapStrictAfter`, achterwaarts `snapStrictBefore`); voorwaarts bij SF niet voor een opvolger in de dagenmaat
  (ADR 0274). Zie knownbug 153.
- Een eindmijlpaal als opvolger zonder lag in werktijd krijgt als grens het rauwe moment van de voorganger, de finish
  bij FS en FF en bij SF het startmoment uit `sfReqFinishHour` (met de regel voor `predStartsNextDay` hierboven), niet
  het volgende blokbegin. "Zonder lag" betekent dat de verschoven waarde gelijk is aan een kale normalisatie op de
  lagkalender (`lagIsZero` in de FS-tak, `zeroLag` in `finishFinishRequirement`). Bij een lag in kalendertijd geldt
  dit alleen voor FS, bij nul klokminuten (ADR 0273). Een echte lag telt wel (`msp-02` in
  `cases-msp-pariteit.json`), en zonder mijlpaal blijft het volgende werkmoment de grens (`msp-01b`). Bij FS geldt
  dit ook als de voorganger `predEndsBeginOfDay` heeft, omdat een voorganger zonder duur op de statusdatumvloer een
  anker op een blokeinde van zijn eigen kalender kan krijgen (`msp-06b`). Het weggehaalde commentaar noemde dit
  pariteit met MS Project; een bestand van MS Project dat het laat zien, is niet nagegaan.
- FS met een echte lag naar een eindmijlpaal (`finishStartLaggedStart`): de grens is het eindmoment op of vóór het
  moment na de lag (`snapOnOrBefore` op de opvolgerkalender) als dat het moment zelf is, of als het volgende
  werkmoment van de opvolgerkalender na dat eindmoment het moment na de lag is en de lagkalender ertussen geen
  werkminuut heeft; anders het volgende
  werkmoment van de opvolger. `nextWorkInstant` alleen zou een blokeinde overslaan. De functie is gedeeld met de
  externe voorganger (`externalForwardBound`, review van #808; ADR 0022).
- FF naar een startmijlpaal, met een voorganger zonder `predEndsBeginOfDay`, geeft het moment strikt na de geëiste
  finish. Uitzondering: telt de voorganger in de dagenmaat, is de lag geen kalendertijd en ligt de geëiste finish
  midden in een werkblok van de opvolger (`isInsideBlock`), dan staat de mijlpaal op dat moment. Voor een urentaak
  blijft "strikt na", omdat de bredere correctie drie C7-controles rood maakte (knownbug 230). Achterwaarts
  spiegelt `backwardHour` dat. C7 (`p6FinishFinishStartMilestoneLateFinish`) zet `succIsStartMs` voor FF uit
  (ADR 0029).
- Achterwaarts bij FS houdt een voorganger met `predEndsBeginOfDay` of een eindmijlpaal als opvolger bij lag 0 de
  ongenormaliseerde late start van de opvolger als grens; een lag telt altijd mee, anders verschillen voorwaarts en
  achterwaarts en daarmee speling en kritiek pad. Bij `predEndsBeginOfDay` slaat de tak ook `prevWorkInstant` over: de
  finish van zo'n voorganger is een dagbeginanker, en `prevWorkInstant` zou het naar het vorige blokeinde zetten, op de
  werkas dezelfde plek maar een andere datum (`rr-fs-pred-startms` in `cases-hours-relations.json`). Bij een
  eindmijlpaal als opvolger blijft `prevWorkInstant`, omdat de voorganger een echte finish heeft.
