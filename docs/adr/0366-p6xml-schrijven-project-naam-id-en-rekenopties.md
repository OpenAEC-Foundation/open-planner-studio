# P6 XML schrijven: het project, zijn naam en Id, en de rekenopties

Het `<Project>` draagt naast de naam en het `Id` de standaarden die een activiteit erft en de rekenopties, zoals de
XER-writer ze in `PROJECT` en `SCHEDOPTIONS` zet (issue #775). De lezer leidt de opties op dezelfde manier af als bij
een XER (ADR 0267 en 0181).

## Gevolgen

- `ActivityDefaultDurationType` is het label van `project.defaultWorkRule`, anders van `DEFAULT_WORK_RULE`, zoals
  `PROJECT.def_duration_type` in de XER. Een activiteit zonder eigen `<DurationType>` erft hem (ADR 0364), en de
  P6-regels voor voltooide activiteiten lezen hem. `check-p6xml-export-loss.ts` toetst langs `exportAs('p6')` dat de
  projectstandaard na heropenen terug is en de taak erft. `ActivityDefaultCalendarObjectId` is 1, de projectkalender.
- De rekenopties komen uit `p6XmlScheduleOptionFields` met de effectieve opties (`effectiveSchedulingOptions`): de
  kritiekvelden op het project, de rest in `<ScheduleOptions>`. Wat P6 niet kent, meldt de exportmelding
  (`exportP6XmlLossNotice`: een ander profiel, en afwijkende rekenregels via `p6SchedulingRulesDiffer`; ADR 0367).
- `DataDate` staat er alleen met een statusdatum, `MustFinishByDate` alleen met een einddatum; de lezer leest het
  einde alleen uit `MustFinishByDate` (ADR 0261).
- Naam en `Id` komen uit `p6ProjectIdentity`. `<Name>` is de
  projectnaam zonder witruimte eromheen, en zonder naam dezelfde neutrale terugval als de bestandsnaam
  (`projectFileBase`), omdat een leeg `<Name>` P6 een naamloos project gaf; dat laatste komt uit het weggehaalde
  commentaar en is niet nagegaan. `<Id>` is de P6 Project-ID die de aanroeper meegeeft; `exportAs` geeft
  `documentProjectCode` met de XER-metadata mee, zodat ook een XER-document zijn code krijgt, en zonder argument geldt
  de code van het project zelf. Zonder code is het `Id` in P6 XML `OPS:` plus het interne project-id, ingekort tot
  `P6_ID_MAX_LENGTH`: het hangt niet van de naam af, en de lezer bewaart het niet als code (`isOpsInternalProjectId`,
  ADR 0261). Die terugval geldt alleen voor P6 XML: de XER-writer neemt van `p6ProjectIdentity` alleen de naam en zet
  zonder code de genormaliseerde projectnaam (anders `Project`), op 40 tekens, als `proj_short_name` (`xerWriter.ts`),
  zodat twee projecten met dezelfde naam daar hetzelfde ID krijgen (knownbug 463). Er is geen terugval die een code
  uit de naam haalt (eigenaarsbesluit 2026-10-13): die gokte ("Renovatie (2027)" gaf `Id` "2027") en miste codes met
  een spatie ("OZB-14 1st Update"). Toetsen: `check-p6xml-writer-p6.ts` (11) en `check-p6xml-project-code.ts`.
- Tot en met v2026.9.0 schreef de writer het interne project-id als `<Id>`. `isLegacyOpsProjectId` herkent dat voor de
  lezer (ADR 0261) in twee vormen: de vorm van `generateId('proj')` (`proj-`, een tijdstempel van 8 tekens in base36,
  4 tekens in base36 en een teller in cijfers) met een tijdstempel van 1 januari 2026 tot een dag na nu (de app
  bestaat sinds februari 2026), en de vorm uit de IFC-lezer (`proj-ifc-<GlobalId>` of `proj-ifc-step-<STEP-id>`). De
  tijdstempel hoort erbij, omdat de vorm alleen ook woorden van 8 of meer letters als `proj-benchmark` of
  `proj-museumplein` als intern id zag (review #343 ronde 2). Elke andere vorm is een code.
  `check-p6xml-project-code.ts` sectie 10 toetst beide kanten.
