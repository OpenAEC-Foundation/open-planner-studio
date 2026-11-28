# P6 XML schrijven: voortgang, status, activiteittype, duursoort, constraints en datums

Een P6 XML-bestand opent als Primavera P6, en de P6-regels van de motor hangen aan de herkomstvelden van een activiteit
(ADR 0267). `writeP6XMLWithReport` schrijft die velden daarom zo terug dat dezelfde planning na een rondgang hetzelfde
rekent. `check-p6xml-xer-parity.ts` R1 tot en met R6 opent een XER, schrijft P6 XML, opent die weer en vergelijkt de
P6-velden, de datums, speling en kritiek; R7 bewaakt de eigen of geërfde werkregel na de rondgang en een verdubbeling
van de inzet daarna. De status deelt hij met de XER-writer (`xerWriter.ts`); het activiteittype en de voortgangssoort
volgen daar dezelfde regels in eigen code.

## Gevolgen

- `taskStatusToP6` (ook in `xerWriter.ts`) leidt de status af uit voortgang en werkelijke datums, omdat `task.status`
  in OPS kan achterlopen op een gewijzigd percentage: `Completed` bij status `COMPLETED`, een werkelijk einde of
  `completion` van 1 of meer, `In Progress` bij status `STARTED`, een werkelijke start of `completion` boven 0, anders
  `Not Started`. Een taak met status `STARTED` zonder werkelijk einde blijft `In Progress`, ook op 100 %; de lezer
  houdt zo'n taak lopend (`runningAtFullIds`, ADR 0266).
  Toets 4b in `check-p6xml-writer-p6.ts` controleert een taak op 50 % in uitvoering; de export van een lopende taak
  op 100 % zonder werkelijk einde toetst `check-import-explicit-rest.ts` (blok 12).
- `<PercentCompleteType>` komt uit `p6CompletePctType` (`P6_XML_PERCENT_COMPLETE`), met `Physical` als terugval bij een
  ontbrekende soort, zoals de XER-writer dan `CP_Phys` schrijft; het percentage staat als fractie in de kolom van die
  soort, alleen bij `completion` boven 0 (toets 4a). Reden: de motor leest de soort, en een voltooide Duration-taak die
  als Physical terugkwam, viel op de statusdatum (review Sol #781 punt 1, R1).
- `<Type>` (`taskTypeToP6`): een nulduur-mijlpaal wordt `Finish Milestone` bij `milestoneKind` `FINISH` en anders
  `Start Milestone`, ook bij een automatische soort. Een mijlpaal met duur blijft een gewone activiteit met haar duur
  (`check-p6xml-export-loss.ts`). Een hammock wordt `Level of Effort`, zoals `TT_LOE` in de XER (ADR 0267).
  `p6ActivityType` `TT_Rsrc` wordt `Resource Dependent` en `TT_WBS` `WBS Summary`, omdat de motor die twee buiten C5
  houdt (review PR #393 punt 7, review Sol #781; R3 en R4); anders `Task Dependent`.
- `<DurationType>` staat er alleen voor een taak met een eigen `workRule` die geen nulduur-mijlpaal is
  (`P6_DURATION_TYPE_NAME`). Een taak zonder eigen regel krijgt geen veld en erft `ActivityDefaultDurationType` van het
  project (ADR 0366); de lezer laat haar dan weer erven (ADR 0267, R7). De writer schrijft niet het oude P6-token
  `p6DurationType` uit de bron: dat gaf een taak na heropenen een eigen regel en draaide een keuze voor
  *Projectstandaard* terug (review PR #393 punt 3, review Sol #781). De XER-writer schrijft wel altijd de effectieve
  regel, met een eigen markering voor een taak die erft (regel `xer`).
- `<ExpectedFinishDate>` komt uit `p6ExpectedFinish`, omdat de motor het verwachte einde gebruikt bij
  `UseExpectedFinishDates` (review Sol #781 punt 2, R2).
- De constraints gaan als label van `p6ConstraintLabel` (`p6ConstraintTypes.ts`, met de bron in ADR 1040), niet als
  `CS_*`-token; ASAP geeft geen element en een datum staat er alleen bij een soort. De secundaire constraint gaat altijd
  als zachte soort (`hard: false`), dus nooit als `Mandatory …`.
- `PlannedStartDate` en `PlannedFinishDate` zijn de rekendatums (`computedStart` en `computedFinish`: de vroege
  datums, anders `scheduleStart` en `scheduleFinish`), niet de getoonde datums; de werkelijke datums staan apart in
  `ActualStartDate` en `ActualFinishDate`, alleen als ze gezet zijn. De XER-writer schrijft juist de geplande datums
  (regel `xer`); R6 vergelijkt de datums van een ALAP-taak uit een XER met die na de rondgang door P6 XML.
