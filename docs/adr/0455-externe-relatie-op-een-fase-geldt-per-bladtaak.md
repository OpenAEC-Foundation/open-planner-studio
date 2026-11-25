# Een externe relatie op een fase geldt voor elke bladtaak eronder

Een externe relatie (`externalLinks`) op een fase geldt voor elke bladtaak eronder, net als een gewone relatie op een
fase (ADR 0450): een externe voorganger op de fase werkt op elk blad als voorganger, een externe opvolger als
opvolger. Ook de fasen daarboven tellen mee. De solver kent alleen bladtaken; zonder deze stap telde een externe
relatie op een fase niet mee, terwijl de app haar wel liet toevoegen. `leafTasksForSolve` geeft de bladtaken voor de
solver met de externe relaties van hun fasen erbij; `effectiveExternalLinks` geeft dezelfde lijst per taak, voor wie
niet rekent maar wel moet weten dat een blad onder zo'n fase een voorganger of opvolger heeft.

## Gevolgen

- De lijst begint met de eigen externe relaties van de taak, daarna die van haar fasen, van dichtbij naar ver langs
  `parentId`. Een ouderketen met een kring of een onbekende ouder stopt daar.
- Een blad met geërfde relaties krijgt een ondiepe kopie met de samengevoegde `externalLinks`; een blad zonder blijft
  hetzelfde object, en de taak in de store houdt haar eigen `externalLinks`. Heeft geen enkele fase een externe
  relatie, dan blijft elke taak ongewijzigd.
- `leafTasksForSolve` roepen `solveProject`, de nivelleerinvoer (`scheduleSlice.ts`), `previewMoveProject`
  (`projectSlice.ts`), `progressPlannedDates.ts`, de bibliotheekverdeling (`distribute.ts`) en de benchmark
  (`runner.ts`) aan. `effectiveExternalLinks` gebruiken het logica-rapport (`logicIndex.ts`), de waarschuwingen
  (`scheduleWarnings.ts`) en het waarschuwingenpaneel. Welke aanroepers de toets niet dekt, staat in knownbug 835.
- Volgens het weggehaalde commentaar geldt per type dezelfde afwijking als bij een gewone relatie op een fase: een
  externe voorganger zoals de samenvatting als opvolger (FF en SF conservatief), een externe opvolger zoals de
  samenvatting als voorganger (SS en SF conservatief). `check-external-summary.ts` vergelijkt voor beide richtingen,
  alle vier typen en de profielen ops, p6 en msproject de relatie op de fase met dezelfde relatie op elk blad: de
  datums en de speling van de bladen en de rollup van de fase moeten gelijk zijn, en een losse taak blijft
  ongemoeid. De toets pint dus
  de uitkomst per blad, geen vergelijking met de fase als één taak.
