# Nivelleren rekent op een eigen verse planning, zonder eerdere nivelleeruitvoer

`levelResources` (`src/engine/scheduler/ResourceLeveler.ts`) is één serieel algoritme dat taken één voor één
plaatst; de schakelaar `constrainToFloat` kiest tussen nivelleren (de einddatum mag schuiven) en smoothing (alleen
binnen de totale speling), zoals P6 en MS Project dat met één motor en een boolean doen. De meegegeven `cpmResult`
kan verouderd zijn: na een taakwijziging zonder F5 klopt hij niet meer. De nivelleerder leest daarom de
sorteersleutels (totale speling, vroege start), de vroege start waarvan hij uitgaat, de positie van vaste last en
de vensters niet uit `cpmResult`, maar uit een eigen `CPMSolver.solve()` op een werkkopie van de taken. Die solve
krijgt de `cpmOptions` van de getoonde planning (`solveOptionsFor(project)`), met `dataDate` en `progressMode`.
Zonder die twee rekende de nivelleerder alsof er geen voortgang was en zag hij conflicten niet die
`computeResourceLoad` op de echte datums wel ziet: "0 taken verschoven, 0 onopgelost" bij blijvende overbezetting.

In de werkkopie heeft een taak binnen de scope geen eerdere nivelleeruitvoer: `levelingDelay`,
`levelingDelayMinutes` en `levelingDelayElapsed` zijn leeg, en de gaten met `source: 'leveling'` zijn weg
(`stripLevelingGaps`). Andere gaten, zoals importsplits, blijven staan: dat is brondata. *Nivellering toepassen* schrijft
voor elke taak binnen de scope de nieuwe vertraging en gaten en wist de oude (`writeLevelingResult`), dus dit is
het schema waartegen genivelleerd wordt. De minutenvelden gaan mee
omdat de solver ze vóór `levelingDelay` leest (ADR 0017): een minutenvertraging uit een `.mpp` op een taak met een
voorganger bleef anders in de basis staan en het conflict verdween uit beeld (`check-leveling-delay-units.ts`,
deel 2). De nivelleergaten gaan mee omdat een tweede nivellering ze anders als brondata las en er nieuwe gaten
bovenop legde (`check-apply-leveling-scope.ts`, deel 4). Een taak buiten de scope, of elke taak met
`preserveExistingLeveling`, houdt haar vertraging en gaten (ADR 0161).

## Gevolgen

- De vertraging van een taak telt vanaf haar vroegste start volgens de relaties, berekend op de werkkopie waarin de
  al geplaatste taken hun nieuwe vertraging hebben en de taak zelf nog niet. Telde ze vanaf de vroege start van de
  basis, dan telde de verschuiving van een voorganger dubbel. Die start komt uit de herbruikbare voorwaartse pass
  (ADR 0018) of, met `LEVELER_TEST_HOOKS.incremental = false`, uit een volledige solve per plaatsing
  (`computePF`); `check-leveler-differential.ts` legt beide uitkomsten naast elkaar.
- Het voorstel (`projectEndAfter` en `shifts`) komt uit één proefsolve op de werkkopie met alle nieuwe
  vertragingen en gaten erop, met dezelfde `cpmOptions`. Zo staan ook opvolgers zonder toewijzing in `shifts` die
  alleen via de voorwaartse pass meeschuiven. `shifts` vergelijkt met de getoonde `task.time.earlyStart`, en
  `projectEndBefore` is `cpmResult.projectEnd`: het voorstel zet het nieuwe schema naast wat de planner nu ziet.
  Het verschil telt werkdagen op de taakkalender (`signedWorkDaysBetween`), bij kalendertijd kalenderdagen, zodat de
  preview geen "0 werkdagen" toont naast twee verschillende datums; een taak met verschil nul staat er niet in.
- Faalt de eigen solve, dan geeft de nivelleerder een leeg voorstel met het projecteinde van `cpmResult`.
- `levelResources` houdt alleen bladtaken over (`isLeafTask`), ook als een aanroeper een lege WBS-samenvatting
  meegeeft.
- Bij gelijke prioriteit, speling en start beslist de volgorde in de takenlijst (`cmp`), niet het taak-id: een id
  bevat een willekeurig deel (`src/utils/id.ts`) en de uitkomst moet herhaalbaar zijn. De volgorde zelf staat in de
  gids `howto-overbezetting-oplossen.md`.
- Een taak zonder vraag op de gekozen resources, met een voorganger en niet onverplaatsbaar, staat zonder
  `preserveExistingLeveling` als tussenstap in de lus (`transitIds`): ze wacht op haar voorgangers en boekt zelf
  niets. Anders kon een opvolger boeken vóór een nog te
  verschuiven voorouder.
- De vraagcache (`demandCache`) bewaart per taak alleen de laatst gevraagde plaatsing; alle afgewezen kandidaten
  bewaren hield hun dagen en vraag tot het einde van de nivellering in het geheugen.
- De hulpfuncties van `levelResources` staan na de `return` als functiedeclaraties: ze worden opgetild. Een `const`
  op die plek wordt nooit geïnitialiseerd.
