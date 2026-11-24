# P6 XML lezen: welk project, welke objecten, welke documenten

Echte P6 XML zet de objecten van een project (WBS, activiteiten, relaties, toewijzingen) binnen `<Project>`, en een
bestand kan meerdere projecten en baselines dragen (review PR #169, `check-p6xml-nested.ts`). De oudere eigen writer
zette alles plat op het hoogste niveau, met `<ProjectObjectId>`. `scopedElements` leest daarom per soort eerst de
directe kinderen van de wortel en dan die van het gekozen `<Project>`. Een bestand met meerdere projecten opent als
meerdere documenten, naar de lijn van de XER-lezer (`xerMultiProject.ts`).

## Gevolgen

- Een veld (`getElementText`, `getElementInt`, `getElementFloat`) leest de lezer als direct kind (`directChildText`),
  anders pakt hij een element met dezelfde naam uit een dieper object op. De blokken van een kalender en de waarden
  van een curve zoekt hij wel in de diepte. De MSPDI-lezer zoekt ook een veld in de diepte (`descendantText`).
- Een plat object met een `<ProjectObjectId>` van een ander project valt weg als het gekozen project een `ObjectId`
  heeft. Een plat object zonder `<ProjectObjectId>` van een soort uit `PROJECT_OBJECT_TAGS` hoort alleen bij een
  project als het bestand precies één `<Project>` heeft, of geen (`ownsUnassigned`); in een bestand met meer projecten
  hoort zo'n activiteit bij geen document en telt het verslag haar (`unassignedActivities`,
  `check-p6xml-open-notice.ts` 8a tot en met 8c). Andere soorten zonder `<ProjectObjectId>` (kalenders, resources,
  UDF-typen, curves) horen bij elk project.
- `readP6XMLDocuments` maakt van elk `<Project>` met minstens één `<Activity>` in zijn bereik een document. Actief is
  het document met de meeste bladtaken, bij gelijkspel het eerste (`check-p6xml-nested.ts` 10c, 10o en 13a). Leest de
  lezer in de documenten die hij opent geen activiteit met een `ObjectId`, dan mislukt de import met
  `P6XmlImportError` en de reden van `emptyReasonOf` (`no-activities`; `xer-columns` bij een activiteit met
  `task_code` of `task_name`; anders `no-object-ids`), zoals een lege XER, in plaats van een leeg tabblad
  (`check-p6xml-open-notice.ts`). `readP6XML`, dat alleen de toetsen gebruiken, geeft dan een leeg resultaat.
- Een `<BaselineProject>` wordt nooit een document. Hij wordt een baseline van het document van zijn
  `OriginalProjectObjectId` (`p6BaselineFrom`, met de gedeelde regel `baselineTasksFromSource`); de baseline uit
  `CurrentBaselineProjectObjectId` wordt de actieve (`check-p6xml-nested.ts` 10h tot en met 10l). Een
  `<BaselineProject>` zonder geopend eigenaarsdocument en een `CurrentBaselineProjectObjectId` zonder
  `<BaselineProject>` in het bestand telt het verslag als losse verwijzing (`check-p6xml-open-notice.ts` 8b).
- Een relatie waarvan een activiteit niet in het document staat en waarvan `PredecessorProjectObjectId` of
  `SuccessorProjectObjectId` een ander project noemt, wordt geen relatie; het verslag telt haar één keer over alle
  documenten, op `ObjectId` en anders op voorganger en opvolger (`check-p6xml-nested.ts` 2e en 13b). Een relatie naar
  een ontbrekende activiteit zonder zo'n projectnummer valt weg zonder telling.
- De projectnaam blijft kaal en de P6 Project-ID staat apart in `project.p6ProjectCode` (eigenaarsbesluit 2026-10-13,
  `check-p6xml-project-code.ts`). De naam is `<Name>` zonder witruimte eromheen, anders de code, anders `P6 Import`.
  De code (`p6ProjectCode`) is `<Id>`, behalve het `Id` dat de eigen writer zonder code schrijft
  (`isOpsInternalProjectId`) en het interne id van exports tot en met v2026.9.0 (`isLegacyOpsProjectId`), omdat een
  heropende export anders een blijvende nepcode kreeg (sectie 10 van die toets). Een baseline draagt de code alleen in
  haar naam (`nameWithProjectCode`).
- `MustFinishByDate` is het enige projecteinde dat de lezer leest; zonder dat veld blijft `endDate` leeg, zoals de
  writer een project zonder einddatum zonder `MustFinishByDate` schrijft.
- De volgorde van WBS-broers volgt `SequenceNumber`, stabiel, en zonder dat veld de documentvolgorde
  (`check-adapters-hierarchy-rest.ts` 6). De taken staan daarna in boomvolgorde (`flattenOrder`), omdat eerst alle
  samenvattingen en dan alle bladen de hiërarchie in de MSPDI-export brak.
- Een ontbrekende of onleesbare geplande datum volgt de gedeelde regel `resolveMissingScheduleDates`; alleen de invoer
  krijgt een plaatshouder, de vastgelegde rekenuitvoer nooit (ADR 0268). Zonder `PlannedStartDate` op het project
  tellen ook de WBS-samenvattingen als ontbrekend, omdat ze op de projectstart worden aangemaakt.
