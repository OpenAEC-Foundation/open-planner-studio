# De volgorde van writes rond een overgang in een plakactie

Een plakactie levert haar writes in de volgorde van de zichtbare kolommen. Sommige cellen van een taak veranderen
binnen dezelfde transactie welke andere cellen en toewijzingen van die taak schrijfbaar zijn: de mijlpaalvlag
(`task.isMilestone`), de hangmatvlag (`task.isHammock`) en het type van de eerste en de tweede constraint. De
transactie past de celwrites van één taak samen toe, als één eindtoestand, op de plek van de eerste celwrite van die
taak (`prepareGridWrites`, `applyCellEdits`); een toewijzingswrite wordt op haar eigen plek toegepast. Of een
toewijzing vóór of na de overgang landt, hangt dus af van haar plek tegenover de eerste celwrite. We kozen ervoor dat
`orderWritesForDependentTransitions` alleen de writes herschikt van een taak met zo'n overgang of met een
toewijzingswrite. Writes van andere taken houden hun plek, en binnen een taak sorteert de functie stabiel op de
oorspronkelijke volgorde. De rangorde staat in `rank` in die functie; de keuzes erachter zijn deze.

## Gevolgen

- Een lege afhankelijke cel (`undefined`, `''` of `false`) die de geplakte overgang in de eindtoestand toch
  uitschakelt, valt weg: `task.constraint.date` en `task.constraint.hard` bij een eerste type `ASAP` of `ALAP`,
  `task.constraint.hard` bij elk ander eerste type dan `MSO` of `MFO`, en `task.constraint2.date` als het geplakte
  tweede type leeg, `ASAP` of `ALAP` is. Zo'n lege cel komt mee als een volledige taakrij geplakt wordt.
- Een niet-lege waarde die met de overgang botst, blijft staan. Wat er dan gebeurt, hangt af van de kolom. Heeft ze
  een `readOnly`-functie, zoals `task.constraint.hard`, dan volgt de route van ADR 0443: bij Ctrl+V slaat de
  transactie die cel over met een melding en schrijft ze de rest, als de cel vóór het plakken al alleen-lezen was: op
  een taak zonder constraint geven een nieuwe naam, `SNET` met een datum en *Hard* op `Ja` de naam en `SNET`, zonder
  *Hard*. Was *Hard* vóór het plakken schrijfbaar (een taak met `MSO` of `MFO`), dan hangt het van de huidige
  waarde af. Stond *Hard* op `Nee`, dan gaat de cel het plan in en weigert `planTaskCellEdits` na de overgang naar
  `SNET` de hele plakactie met `constraintHardUnavailable`; de naam en de oude constraint blijven dan staan. Stond
  *Hard* al op `Ja`, dan laat de klembordplanner de gelijke waarde weg (`planTaskGridPaste` in `clipboard.ts`: een
  waarde die gelijk is aan de cel is geen bewerking): de naam en `SNET` worden toegepast, *Hard* vervalt met de
  overgang en er komt geen melding over een overgeslagen cel. Bij een losse celbewerking weigert ze. Heeft de kolom geen
  `readOnly`-functie, zoals `task.constraint.date`, dan weigert het plan van de taak (`planTaskCellEdits`) en daarmee
  de hele transactie, ook bij Ctrl+V: een datum naast `ASAP` geeft `constraintDateUnavailable` en de taak blijft zoals
  ze was.
- Wordt de taak een mijlpaal (`task.isMilestone` op `true`), dan komt een lege toewijzingswrite vóór elke celwrite van
  die taak. Zo wist ze de bestaande toewijzingen voordat de overgang ze onbeschikbaar maakt. Een niet-lege
  toewijzingswrite komt erna. Met een resource die geen kostenresource is, weigert `planTaskAssignmentSet` die dan
  (`assignmentTaskUnavailable`) en daarmee de hele transactie. Een mijlpaal mag wel kostentoewijzingen dragen (issue
  #815, eigenaarsbesluit 2026-11-07), dus mijlpaalvlag en een kostentoewijzing in dezelfde plakactie gaan samen door.
  Binnen de cellen komen hangmat uit en de duur vóór de mijlpaalvlag, en `task.milestoneKind` en `task.mandatory`
  erna.
- Wordt de taak geen mijlpaal (`task.isMilestone` op `false`), dan komen `task.milestoneKind` en `task.mandatory` vóór
  de mijlpaalvlag: in de beginstand zijn ze nog schrijfbaar, en de overgang ruimt ze daarna op volgens het
  domeincontract. De duur komt na de overgang, en toewijzingen ook.
- Zonder mijlpaalovergang komt de duur vóór hangmat aan en na hangmat uit. Bij hangmat aan komt een lege write naar
  `assignment.resources` vóór de celwrites van die taak en een niet-lege toewijzingswrite na de hangmatvlag; bij
  hangmat uit komen toewijzingen na de overgang.
- Het type van een constraint schuift naar voren, vóór de cellen zonder eigen plaats in de rangorde, zoals de
  constraintdatum.
- Bij verder gelijke rang komt `assignment.resources` vóór de kolommen voor inzet, curve en resterend werk.
