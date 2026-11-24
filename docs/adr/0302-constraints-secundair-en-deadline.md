# Een taak heeft een primaire en een secundaire constraint; alleen de primaire kan een harde pin zijn

Een taak draagt een primaire constraint (`constraint`) en, zoals in P6, een secundaire (`constraint2`). Hoe de solver
ze toepast (zachte grenzen, de harde MSO/MFO-pin als barrière) staat in ADR 0021, ALAP in ADR 0030. Een harde pin op
de secundaire constraint zou twee barrières op één taak geven, die elkaar kunnen tegenspreken. De solver leest
`hard` daarom alleen van `task.constraint`, en alleen bij MSO of MFO (`hardPinStart`, `hardPinFinish` in
`CPMSolver.ts`); de secundaire constraint is altijd een zachte grens. Welke combinaties van primair en secundair
geldig zijn, beslist `validateConstraintPair` (`engine/scheduler/constraintValidation.ts`): het taakpaneel toont een
ongeldige combinatie rood en de MCP-tools weigeren haar. Toetsen: `tests/mcp/cases-constraint-pair.ts` en
`check-advanced-cpm.ts`.

## Gevolgen

- `validateConstraintPair` keurt een `hard` op de secundaire constraint af. De lezers van XER en P6 XML zetten
  `constraint2` uit het bestand zonder die toets.
- De MCP-tools weigeren `hard` op een ander type dan MSO of MFO, en een constraint zonder `date` behalve bij ASAP en
  ALAP (`taskFields.ts`). De bridge zet `constraint2` niet zelf.
- Zonder `constraint` rekent een taak als ASAP.
- De deadline (`deadline`) is een bovengrens voor de late finish, naast de late constraints (`applyBackwardBound`;
  ADR 0021); de vroege datums bewegen er niet door. Een taak die haar deadline overschrijdt, staat in
  `missedDeadlineTaskIds`, dat de statusbalk telt.
