# Een taak in de dagenmaat leest een eis op een blokbegin als het einde van de dag ervoor

`isDayTaskOnBands` bepaalt of een taak in de relatiewiskunde in de dagenmaat telt: geen nulduurmijlpaal, geen
kalendertijd, en `countsInWorkdays` uit de solver (de conventie `workdayDurationMeasure`, ADR 0183). Die conventie
staat standaard aan in het profiel OPS en uit in P6 en MS Project; een eigen profiel kan dat overschrijven. De lopers
van de dagenmaat lezen een eindmoment op een blokbegin als het einde van de werkdag ervoor (spec alleen uren, §0 en
§3.14). Een geëiste finish die de relatiewiskunde zelf afleidt en die op een blokbegin valt, zou zo'n taak dus een
werkdag te laat laten eindigen. Daarom zet ze zo'n finish bij FF op het vorige blokeinde: grensregel N1, geval (c), in
§4.3 van die spec.

## Gevolgen

- `previousBlockEndIfSame` doet dat alleen als dat blokeinde voor de kalender van de taak die het leest dezelfde grens
  is: daar een eindmoment, zonder werkminuut ertussen. Anders, bijvoorbeeld als de opvolger op dat blokeinde een vrije
  dag heeft, blijft het moment staan, omdat ze anders vóór haar voorganger zou eindigen. Met `floor` zet de functie de
  eis ook niet terug tot vóór het rauwe moment vóór de lag, zoals de finish van een voorganger in kalendertijd buiten
  werktijd; een lead ligt al vóór dat moment en valt er niet onder. De functie als geheel bewaakt
  `bg142-ff-dagtaken-werkblokken-lag2` in `cases-hours-blokgrenzen.json`.
- Voorwaarts gebruikt de FF-tak voor een opvolger in de dagenmaat daarna `workdayFinishNotBefore`: ligt
  `prevWorkInstant` van de geëiste finish vóór de rauwe eis, dan wordt de eis het einde van de werkdag waarin het
  eerstvolgende werkmoment valt (`measuredWorkdayEnd` van `nextWorkInstant`); dat kan dezelfde dag zijn, bijvoorbeeld
  na een pauze.
- Voorwaarts gebruikt FF `previousBlockEndIfSame` niet als de voorganger `predEndsBeginOfDay` heeft. Achterwaarts
  gebruikt FF met een lag in werktijd `previousBlockEndIfSame` voor een voorganger in de dagenmaat; een voorganger in
  de urenmaat volgt die regel niet, en onder P6 regelt B2 (`p6BackwardLagFinishBoundary`, ADR 0029) daar de grens op
  een blokeinde.
- SF legt een ondergrens op de finish van de opvolger: niet vóór het startmoment van de voorganger plus lag, in elk
  profiel (technische keuze T8, spec §4.5 rij 1). Voor een opvolger in de dagenmaat schuift dat startmoment niet door
  `predStartsNextDay` (`sfReqFinishHour`), en telt de SF-tak de duur terug vanaf `prevWorkInstant` van de eis, zodat de
  dag die op dat blokbegin begint niet meetelt; de SF-finishvloer (ADR 0031) houdt de eis zelf.
- `dayTaskRequiredFinish` is gedeeld met de externe voorganger (`externalForwardBound`), zodat een externe lag in de
  lagkalender van het project telt zoals een interne (keuze 9, besluit eigenaar 2026-11-03,
  `docs/relaties-tussen-projecten.md`; ADR 0022). Dat de interne FF-tak dezelfde stappen apart houdt, staat in knownbug
  874.
