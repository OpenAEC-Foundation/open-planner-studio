# Een taak in de dagenmaat leest een eis op een blokbegin als het einde van de dag ervoor

`isDayTaskOnBands` bepaalt of een taak in de relatiewiskunde in de dagenmaat telt: geen nulduurmijlpaal, geen
kalendertijd, en `countsInWorkdays` uit de solver (de conventie `workdayDurationMeasure`, ADR 0183). Onder P6 en
MS Project staat die conventie uit en telt zo'n taak in de urenmaat. De lopers van de dagenmaat lezen een eindmoment
op een blokbegin als het einde van de werkdag ervoor (spec alleen uren, §0 en §3.14). Een geëiste finish die de
relatiewiskunde zelf afleidt en die op een blokbegin valt, zou zo'n taak dus een werkdag te laat laten eindigen.
Daarom zet ze zo'n finish op het vorige blokeinde: grensregel N1, geval (c), in §4.3 van die spec.

## Gevolgen

- `previousBlockEndIfSame` doet dat alleen als dat blokeinde voor de kalender van de taak die het leest dezelfde grens
  is: daar een geldig eindmoment, zonder werkminuut ertussen. Heeft de opvolger op dat blokeinde een vrije dag, dan
  blijft het moment staan; anders zou ze vóór haar voorganger eindigen (`bg142-ff-opvolger-eigen-kalender-vrije-dag`
  in `cases-hours-blokgrenzen.json`). Met `floor` zet de functie de eis niet terug tot vóór het rauwe moment vóór de
  lag, zoals de finish van een voorganger in kalendertijd buiten werktijd (`bg142-ff-na-elapsed-voorganger`). Een
  lead ligt al vóór dat moment en valt er niet onder.
- Ligt het eindmoment daarna vóór de rauwe eis, dan moet de opvolger op de volgende werkdag nog werken, en
  `workdayFinishNotBefore` maakt het einde van die werkdag de eis (`bg142-*`, en `lagadv-ff-lead-ed` in
  `cases-lag-advanced.json`). Een eis die de opvolger al als eindmoment kan halen, blijft staan.
- Voorwaarts gebruikt de FF-tak deze regels voor een opvolger in de dagenmaat (`finishFinishRequirement`, en
  `previousBlockEndIfSame` niet als de voorganger `predEndsBeginOfDay` heeft). Achterwaarts gebruikt FF met een lag
  in werktijd `previousBlockEndIfSame` voor een voorganger in de dagenmaat. Een voorganger in de urenmaat volgt die
  regel niet; onder P6 regelt B2 (`p6BackwardLagFinishBoundary`, ADR 0029) daar de grens op een blokeinde.
- SF volgt in elk profiel het urenpad: de opvolger eindigt op het startmoment van de voorganger (technische keuze T8,
  spec §4.5 rij 1). Voor een opvolger in de dagenmaat schuift dat startmoment niet door `predStartsNextDay`
  (`sfReqFinishHour`), en telt de opvolger haar duur terug vanaf `prevWorkInstant` van de eis, zodat de dag die op
  dat blokbegin begint niet meetelt; de SF-finishvloer blijft de rauwe eis. `rel-sf-02-delayedpred` in
  `cases-relations.json` verwacht voor B, 2 d met SF zonder lag naar A die do 4 juni begint, start di 2 juni en
  einde op 4 juni.
- `dayTaskRequiredFinish` is gedeeld met de externe voorganger (`externalForwardBound`), zodat een externe lag in de
  lagkalender van het project telt zoals een interne (keuze 9, besluit eigenaar 2026-11-03,
  `docs/relaties-tussen-projecten.md`; ADR 0022). Dat de interne FF-tak dezelfde stappen apart houdt, staat in
  knownbug 874.
