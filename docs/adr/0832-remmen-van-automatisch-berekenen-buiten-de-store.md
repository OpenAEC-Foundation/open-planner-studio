# Remmen van Automatisch berekenen buiten de store

Automatisch berekenen (`useAutoCalcCPM`) rekent bij een storewijziging. De twee remmen erop houden hun stand daarom in
een eigen module en niet in de store: `holdAutoCalc` (`src/state/editHold.ts`, een gebaar of veld dat nog bezig is) en
`createFailedSolveGate` (`src/state/failedSolveGate.ts`, na een mislukte berekening). Een storeveld zou bij elke
wijziging van de rem de hook zelf weer wakker maken; de melding van een mislukte berekening wijzigt de store al, dus
zonder rem plande elke mislukte poging de volgende in.

## Gevolgen

- De rem na een rekenfout vergelijkt de ruwe storereferenties waaruit `solveInputFor` de invoer bouwt
  (`planningInputOf`), niet de afgeleide invoer: `solveOptionsFor` bouwt bij elke aanroep een nieuw object, dus een
  vergelijking daarop zou altijd "gewijzigd" zeggen.
