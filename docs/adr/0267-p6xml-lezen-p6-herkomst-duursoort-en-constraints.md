# P6 XML lezen: rekenen als P6, met de herkomst, de duursoort en de constraints uit het bestand

Een P6 XML-bestand opent als Primavera P6, net als een XER (issue #775): het project krijgt het ingebouwde profiel
`P6XML_PROFILE_ID` (`project.schedulingProfile` en `suggestedProfileId`) en de opties uit `<ScheduleOptions>` en de
kritiekvelden van het project, met dezelfde afleiding als een XER (`deriveP6XmlScheduleOptions`, ADR 0181). De
P6-regels in de motor gelden alleen voor een activiteit met P6-herkomst (`verify:conventions`), dus zet de lezer die
velden zoals de XER-lezer: `p6ActivityType` uit `<Type>` (`P6_XML_ACTIVITY_TYPE`, leeg of onbekend wordt `TT_Task`),
`p6ProjectId` (het `ObjectId` van het project, zonder dat `1`), `p6TaskId` (het `ObjectId` van de activiteit),
`p6ExplicitTargetWindow` als beide geplande datums leesbaar zijn, `p6CompletePctType` uit het label van
`<PercentCompleteType>` (onbekend wordt `CP_Drtn`, zonder label geen veld), `p6ExpectedFinish` en bij Level of Effort
`isHammock`. `check-p6xml-xer-parity.ts` opent dezelfde planning via XER en via P6 XML: P1, P3 en P4 vergelijken de
opties, P2 de datums, speling en kritiek na het rekenen, en R de P6-velden en datums na een rondgang door de P6
XML-writer.

## Gevolgen

- Voor de opties telt het projecteinde als bruikbaar bij een `MustFinishByDate` of minstens één activiteit met een
  `PlannedFinishDate`, zoals bij XER (ADR 0181).
- `<DurationType>` is een Engels label. De vier labels horen bij de XER-tokens zoals in `workRuleMapping.ts`
  (`P6_DURATION_TYPE_NAME` en `XER_DURATION_TYPE_TOKEN`); de twee labels met Fixed Duration zijn makkelijk te
  verwisselen en waren eerder verwisseld. De paren zijn nagegaan tegen MPXJ en geteld in het corpus
  (`docs/superpowers/plans/2026-09-24-e2-p6xml-durationtype.md`). `check-xer-p6xml-parity.ts` 4 pint de vier paren.
- Bij een leeg of onbekend label (een onbekend label met een waarschuwing in de console) levert de lezer de
  projectstandaard `ActivityDefaultDurationType` als `p6DurationType`, als die een geldig label is
  (`check-xer-p6xml-parity.ts` 5 en 6); zonder geldige projectstandaard ontbreekt het veld. `deriveImportedWorkRules`
  maakt er daarna de werkregel van: in een bestand dat niet van OPS komt, levert een activiteit met een onbekend label
  bij de projectstandaard `Fixed Units` dus `DT_FixedQty` en de werkregel `FIXED_WORK`.
- In een export van OPS wordt de projectstandaard een eigen `project.defaultWorkRule` als hij niet de standaardregel
  van OPS is; zonder die standaard kreeg een taak die erft de standaardregel van OPS in plaats van die van het
  project. Een taak zonder eigen geldig `<DurationType>`, bij een geldige projectstandaard, verliest daar na
  `deriveImportedWorkRules` haar werkregel, zodat ze weer erft; `p6DurationType` blijft. De writer laat dat element
  weg voor een taak die erft (review Sol #781 r2, `check-p6xml-xer-parity.ts` R7). Een taak uit een bestand van P6
  houdt de regel van de projectstandaard als eigen regel.
- `<PrimaryConstraintType>` en `<SecondaryConstraintType>` lezen als label van P6 of als `CS_*`-token van oudere eigen
  exports (`p6ConstraintFromCodeOrLabel`, alleen eigen sleutels van de tabel); `Mandatory Start` en `Mandatory Finish`
  worden `MSO` en `MFO` met `hard`. Een onbekende waarde geeft geen constraint en een waarschuwing in de console. De
  lezer zet de secundaire constraint nooit hard (`check-p6xml-constraint-labels.ts` 1).
- Een mijlpaal is een `<Type>` met `Milestone`; met `Finish` erin wordt de soort `FINISH`, anders `START`, omdat P6
  beide soorten kent (`check-p6xml-nested.ts` 6f).
