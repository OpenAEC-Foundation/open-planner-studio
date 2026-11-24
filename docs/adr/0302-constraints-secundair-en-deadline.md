# Een taak heeft een primaire en een secundaire constraint; alleen de primaire kan een harde pin zijn

Een taak draagt een primaire constraint (`constraint`) en, zoals in P6, een secundaire (`constraint2`). Hoe de solver
ze toepast (zachte grenzen, de harde MSO/MFO-pin als barrière) staat in ADR 0021, ALAP in ADR 0030. Een harde pin op
de secundaire constraint zou twee barrières op één taak geven, die elkaar kunnen tegenspreken. De solver leest
`hard` daarom alleen van `task.constraint`, en alleen bij MSO of MFO (`hardPinStart`, `hardPinFinish` in
`CPMSolver.ts`); de secundaire constraint is altijd een zachte grens. Welke combinaties van primair en secundair
geldig zijn, beslist `validateConstraintPair` (`engine/scheduler/constraintValidation.ts`). Die toets kijkt naar de
typen en naar `hard`, niet naar de datumwaarden. Het taakpaneel toont een ongeldige combinatie rood, het taakraster
weigert haar (`taskEditPlan.ts`) en de MCP-tools weigeren haar bij een wijziging van de primaire constraint
(`taskFields.ts`). Toetsen: `check-advanced-cpm.ts` (§7) legt de uitkomst van `validateConstraintPair` vast voor
paren van typen en `hard`; `tests/mcp/cases-constraint-pair.ts` legt via de echte dispatcher vast dat wissen, ASAP en
ALAP de secundaire constraint meenemen, dat een geldig paar landt en dat een ongeldig paar bij een nieuwe primaire
constraint geweigerd wordt zonder iets te veranderen.

## Gevolgen

- `validateConstraintPair` keurt een `hard` op de secundaire constraint af, en ook een secundaire constraint zonder
  primaire. De IFC-lezer (`ifcPsets.ts`), de XER-lezer en de P6 XML-lezer zetten `constraint2` uit het bestand zonder
  die toets. Een taak uit een bestand kan dus een secundaire grens hebben zonder primaire constraint, en de solver
  past die grens toe: `applyForwardConstraints` en `applyBackwardBound` lopen over `constraint` en `constraint2`
  allebei.
- De MCP-tools weigeren `hard` op een ander type dan MSO of MFO, en een constraint zonder `date` behalve bij ASAP en
  ALAP (`taskFields.ts`). De bridge zet `constraint2` niet zelf.
- Zonder `constraint` rekent een taak als ASAP.
- De deadline (`deadline`) is een bovengrens voor de late finish, naast de late constraints (`applyBackwardBound`;
  ADR 0021). Een harde pin keert in `applyBackwardBound` terug vóór de deadlinetoets, dus bij een harde pin begrenst
  de deadline de late finish niet. De vroege datums bewegen door de deadline niet, behalve bij ALAP:
  `placeUnstartedAlap` legt een niet-gestarte ALAP-taak niet later dan de begrensde `lateFinish`, dus daar verschuift
  de deadline ook de vroege datums. In een proef uit de review van #1220 eindigde dezelfde ALAP-taak zonder deadline op
  vrijdag 16:00 en met een deadline op woensdag 16:00. Een taak die haar deadline overschrijdt, staat in
  `missedDeadlineTaskIds`, dat de statusbalk telt.
