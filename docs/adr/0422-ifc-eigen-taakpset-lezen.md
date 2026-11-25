# Een eigen pset per taak leest alleen wat de app aankan, zonder de lezing te breken

Een eigen pset kan uit een ouder bestand, een ander programma of een met de hand veranderd bestand komen. De lezer
neemt daarom per property alleen een waarde van het goede type en, waar het veld een vaste verzameling kent, een waarde
uit die verzameling. Wat niet past, laat het veld leeg; de rest van het bestand leest gewoon door. Een geweigerde
lezing zou de hele planning onbereikbaar maken om één onleesbaar veld. `extractStructure` (`ifcReader.ts`) geeft
`apply` alleen de `IFCPROPERTYSINGLEVALUE`-leden, elk met naam, gelezen waarde en ruwe STEP-waarde (`ReadProp`).

## Gevolgen

- Een vlag telt alleen als ze waar is; alleen `SuspendResume` en het oude `IsNearCritical` nemen ook onwaar over. Een type buiten de lijst laat het
  veld leeg: het constrainttype (`CONSTRAINT_VALID`; zonder geldig type vervallen ook datum en `Hard`), `MspTaskType`,
  `WorkRule` (`WORK_RULES`) en de P6-typen in `OPS_P6Progress`. `LevelingDelay` en `LevelingDelayMinutes` worden bij het
  lezen afgerond.
- Een JSON-property die niet parseert, laat haar veld leeg (blok 13 van `check-ifc-roundtrip.ts` voor `Splits`).
  Koppelingen gaan door `storedExternalLinks`: volgens het weggehaalde commentaar liet een kapotte koppeling het
  laden, het rekenen en de relatiecel vastlopen. Notities neemt de lezer over als elke niet-lege lijst (knownbug 2363).
  `Splits` en `Contours` gelden alleen als elk element de vorm heeft; anders valt de hele lijst weg. Een `source`
  buiten `leveling` en `user` valt weg en het gat blijft (blok 17a van `check-ifc-roundtrip.ts`). In een contour mag
  `resourceId` ontbreken, voor oudere bestanden.
- `InterferingFloat`, `IsNearCritical` en `FloatPath` leest de lezer nog uit oudere bestanden in `task.time`; het laden
  rekent ze opnieuw uit (`docs/ifc-round-trip.md`, "Als een veld bewust níét round-trippt").
- `OPS_TaskIdentity` leest `extractTaskIdentityByStepId` vóór `extractTasks`, omdat relaties en de andere psets meteen
  het definitieve taak-id nodig hebben; `apply` van die descriptor doet niets.
- `AtDayEnd` en de records `DayMeasureDurations`, `ExactMinutes` en `ExactFloat` gaan niet naar de taak. `apply`
  onthoudt ze per taakobject (`milestoneWasAtDayEnd`, `readDayMeasureDurations`, `readExactMinutes`, `readExactFloat`).
  `readIFC` zet de mijlpalen op het einde van de dag in `milestonesAtDayEnd`, en `applyTaskTimeRecords` past de
  records toe in een eigen ronde, omdat de leesregel de ruwe slots van `IfcTaskTime` en de kalender van de taak nodig
  heeft (`docs/ifc-round-trip.md`, "De leesregel").
- `OPS_StructureMeta` is geen descriptor-pset; `extractStructure` leest elke enkelvoudige property ervan als JSON,
  terwijl het register alleen `structure` noemt (knownbug 2483).
