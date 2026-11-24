# De SF-finishvloer geldt alleen voor SF en niet op elk pad

Aanvulling op ADR 0031. `forwardFinishFloor` geeft alleen voor SF een vloer en voor de andere relatietypen `null`.
SF eist de finish op de start van de voorganger; zonder lag is dat een blokbegin, en daar komt terugtellen over de
duur en weer vooruittellen uit op het blokeinde vóór het vrije gat in plaats van op de eis (`msp-35-z10-sf-weekendgrens`
in `cases-msp-pariteit.json`, naar `mpp14relations.mpp`, "Task 5"). Het weggehaalde commentaar gaf als reden om FF
geen vloer te geven dat de finish van de voorganger een eindmoment is, waar die twee stappen wel op de eis uitkomen;
knownbug 231 beschrijft een FF-geval met een werkelijke finish buiten werktijd waarin de opvolger toch vóór de
voorganger eindigt.

## Gevolgen

- Een voltooide of lopende taak (`isPinnedComplete`, `isPinnedInProgress`) komt in `forwardPass` niet bij de vloer:
  die takken ronden eerder af, omdat zo'n taak op haar werkelijke datums staat. Een harde finishpin wint (ADR 0031).
- `hammockEarlyFinish` gebruikt `forwardConstraint` en `finishFromStart`, zonder de vloer (knownbug 2308). Ook de
  ALAP-wacht en een externe SF-voorganger rekenen zonder de vloer (knownbugs 378 en 846).
- `forwardFinishFloor` is een eigen functie naast `forwardConstraint`, niet een rijker retourtype, zodat de
  aanroepers van `forwardConstraint` die geen vloer gebruiken niet veranderen. De eis zelf rekent `sfReqFinishHour`,
  dat ook de SF-tak van `forwardHour` gebruikt, zodat ze op één plek staat.
