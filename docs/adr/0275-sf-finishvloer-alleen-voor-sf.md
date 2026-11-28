# De SF-finishvloer geldt alleen voor SF en niet op elk pad

Aanvulling op ADR 0031. SF eist dat de opvolger niet vóór de start van de voorganger plus lag eindigt. De solver
herberekent de vroege finish als start plus duur. In `mpp14relations.mpp`, "Task 5", komt die herberekening op het
blokeinde vóór een weekend uit, terwijl de eis na het weekend ligt (`msp-35-z10-sf-weekendgrens` in
`cases-msp-pariteit.json`). Daarvoor bestaat de vloer. `forwardFinishFloor` geeft hem alleen voor SF en voor de andere
relatietypen `null`. Knownbug 231 beschrijft een
FF-geval met een werkelijke finish buiten werktijd waarin de opvolger toch vóór de voorganger eindigt.

## Gevolgen

- `forwardPass` rekent de vloer uit in de lus over de voorgangers, maar past hem alleen toe in de gewone tak, bij het
  vastleggen van de vroege finish, en niet bij een harde finishpin (ADR 0031). De voortgangstakken
  (`isPinnedComplete`, `isPinnedInProgress`) leggen de vroege finish vast zonder de vloer; bij een lopende taak kan de
  relatiegrens het restwerk daar nog wel verschuiven.
- `hammockEarlyFinish` gebruikt `forwardConstraint` en `finishFromStart`, zonder de vloer (knownbug 2308). Ook de
  ALAP-wacht en een externe SF-voorganger rekenen zonder de vloer (knownbugs 378 en 846).
- `forwardFinishFloor` is een eigen functie naast `forwardConstraint`, niet een rijker retourtype, zodat de
  aanroepers van `forwardConstraint` die geen vloer gebruiken niet veranderen. De eis zelf rekent `sfReqFinishHour`,
  dat ook de SF-tak van `forwardHour` gebruikt, zodat ze op één plek staat.
