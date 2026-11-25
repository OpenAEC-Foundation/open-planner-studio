# Een taak heeft een primaire en een secundaire constraint; alleen de primaire kan een harde pin zijn

Een taak draagt een primaire constraint (`constraint`) en, zoals in P6, een secundaire (`constraint2`). Hoe de solver
ze toepast (zachte grenzen, de harde MSO/MFO-pin als barrière) staat in ADR 0021, ALAP in ADR 0030. Een harde pin op
de secundaire constraint zou twee barrières op één taak geven, die elkaar kunnen tegenspreken. De solver leest
`hard` daarom alleen van `task.constraint`, en alleen bij MSO of MFO (`hardPinStart`, `hardPinFinish` in
`CPMSolver.ts`); de secundaire constraint is altijd een zachte grens. Welke combinaties van primair en secundair
geldig zijn, beslist `validateConstraintPair` (`engine/scheduler/constraintValidation.ts`). Die toets kijkt naar de
typen en naar `hard`, niet naar de datumwaarden. Het taakpaneel toont een ongeldige combinatie rood, maar alleen
waar het het secundaire veld toont: bij een primaire constraint die geen ASAP, ALAP of harde pin is
(`TaskConstraintFields.tsx`). Een ingelezen taak met alleen een secundaire SNET toont daar ASAP, zonder secundair veld
en zonder waarschuwing, terwijl de solver die grens wel toepast. Het taakraster weigert een ongeldige combinatie
(`taskEditPlan.ts`) en de MCP-tools weigeren haar bij een wijziging van de primaire constraint (`taskFields.ts`).
Toetsen: `check-advanced-cpm.ts` (§7) legt de uitkomst van `validateConstraintPair` vast voor paren van typen en
`hard`; `tests/mcp/cases-constraint-pair.ts` legt via de echte dispatcher vast dat wissen, ASAP en
ALAP de secundaire constraint meenemen, dat een geldig paar landt en dat een ongeldig paar bij een nieuwe primaire
constraint geweigerd wordt, met beide constraints ongewijzigd.

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
  de deadline de late finish niet. De vroege datums bewegen door de deadline niet, behalve bij ALAP: een bindende
  deadline kan de gewone ALAP-verschuiving begrenzen. `placeUnstartedAlap` schuift een niet-gestarte ALAP-taak naar
  later tot hoogstens de begrensde `lateFinish`; ligt die niet na de vroege finish, dan schuift de taak niet, en
  vroeger dan haar vroege datums legt de functie haar nooit. Deel 6 van `check-alap-maatplaatsing.ts` toetst dat een
  ALAP-taak met een opvolger binnen haar deadline blijft (OPS en MSP op een scalaire kalender en met eigen
  werkblokken, P6 op een scalaire kalender). In de P6-route met eigen werkblokken (conventie C14,
  `positionAlapFromSuccessors`) kiest een ALAP-taak met een opvolger haar finish zonder die deadlinegrens; dat is
  knownbug 384, en hetzelfde deel legt die uitkomst alleen vast in een samenvatting. Een taak die haar deadline
  overschrijdt, staat in `missedDeadlineTaskIds`, dat de statusbalk telt.
