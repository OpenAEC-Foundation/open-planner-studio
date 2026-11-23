# Nivelleren rekent op een eigen verse planning, zonder eerdere nivelleeruitvoer

`levelResources` (`src/engine/scheduler/ResourceLeveler.ts`) is één serieel algoritme dat taken één voor één
plaatst; de schakelaar `constrainToFloat` kiest tussen nivelleren (de einddatum mag schuiven) en smoothing (alleen
binnen de totale speling), zoals P6 en MS Project dat met één motor en een boolean doen. De meegegeven `cpmResult`
kan verouderd zijn: na een taakwijziging zonder F5 klopt hij niet meer. De nivelleerder rekent daarom op een eigen
`CPMSolver.solve()` op een werkkopie van de taken, met de `cpmOptions` van de getoonde planning
(`solveOptionsFor(project)`), inclusief `dataDate` en `progressMode`. Zonder die twee rekende de nivelleerder op een
planning zonder voortgang en zag hij conflicten niet die `computeResourceLoad` op de echte datums wel ziet.

Voor een taak binnen de scope haalt de werkkopie de eerdere nivelleeruitvoer weg: de drie vertragingsvelden en de
gaten met `source: 'leveling'` (`stripLevelingGaps`); andere gaten zijn brondata en blijven. *Nivellering
toepassen* overschrijft voor die taken de vertraging en de nivelleergaten (`writeLevelingResult`), dus de
nivelleerder rekent zonder de oude. De minutenvelden gaan mee omdat de solver ze vóór `levelingDelay` leest
(ADR 0017): een minutenvertraging uit een `.mpp` op een taak met een voorganger bleef anders in de basis staan en het
conflict verdween uit beeld (`check-leveling-delay-units.ts`, deel 2). De nivelleergaten gaan mee omdat een tweede
nivellering ze anders als brondata las en er nieuwe gaten bovenop legde (`check-apply-leveling-scope.ts`, deel 4).
Een taak buiten de scope, of elke taak met `preserveExistingLeveling`, houdt haar vertraging en gaten (ADR 0161).

## Gevolgen

- De vertraging van een taak telt vanaf haar vroegste start volgens de relaties op de werkkopie, waarin de al
  geplaatste taken hun nieuwe vertraging hebben en de taak zelf nog niet. Telde ze vanaf de vroege start van de
  basis, dan telde de verschuiving van een voorganger dubbel.
- Zolang geen plaatsing veranderd is, neemt `pfFor` die start uit de basis en bouwt hij geen extra pass; pas na een
  gewijzigde plaatsing bouwt hij de herbruikbare voorwaartse pass (ADR 0018). Wanneer `pfFor` toch een volledige
  solve draait (onder meer bij ALAP, een hammock of 100 % voortgang zonder werkelijke finish), staat in `pfFor` en
  `globalDeps`. `LEVELER_TEST_HOOKS.incremental = false` draait per plaatsing een volledige solve (`computePF`);
  `check-leveler-differential.ts` legt beide uitkomsten naast elkaar.
- Het voorstel (`projectEndAfter` en `shifts`) komt uit één proefsolve op de werkkopie met alle nieuwe vertragingen
  en gaten, met dezelfde `cpmOptions`, zodat ook opvolgers zonder toewijzing die via de relaties meeschuiven erin
  komen. Het vergelijkt met de getoonde planning (`task.time.earlyStart` en `cpmResult.projectEnd`). Het verschil
  telt op de taakkalender (de lus over `shifts`): op de projectkalender toonde de preview "0 werkdagen" naast twee
  verschillende datums.
- `levelResources` filtert op bladtaken (`isLeafTask`), ook voor een directe aanroeper die een lege
  WBS-samenvatting meegeeft.
- Bij gelijke prioriteit, speling en start beslist de volgorde in de takenlijst (`cmp`), niet het taak-id: een id
  bevat een willekeurig deel (`src/utils/id.ts`) en de uitkomst moet herhaalbaar zijn. De volgorde zelf staat in de
  gids `howto-overbezetting-oplossen.md`.
- Een taak zonder vraag met een voorganger wacht als tussenstap op haar voorgangers en boekt niets (`transitIds`,
  met de voorwaarden daar); anders kon een opvolger boeken vóór een nog te verschuiven voorouder.
- De vraagcache (`demandCache`) bewaart per taak alleen de laatst gevraagde plaatsing; alle afgewezen kandidaten
  bewaren hield hun dagen en vraag tot het einde van de nivellering in het geheugen.
- De hulpfuncties van `levelResources` staan na de `return` als functiedeclaraties, omdat die worden opgetild; een
  `const` op die plek wordt nooit geïnitialiseerd.
