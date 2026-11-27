# Een document dupliceren: wat de kopie krijgt, wat ze deelt en hoe ze heet

`duplicateDocument` maakt van het actieve document een nieuwe, actieve kopie, voor een wat-als of een variant
(`docs/superpowers/specs/2026-07-24-mcp-bridge-design.md`, *Werkpakket 1-8*, punt 4: de kopie wordt actief, `filePath`
en `fileHandle` leeg zodat Ctrl+S het bronbestand niet overschrijft, `isDirty` waar, de muteerbare velden diep
gekloond, en een naam met " (variant N)"). De bron gaat per referentie in het register, zoals bij een wissel
(ADR 0472). De voorbereide kopie is een uitgeschreven `DocumentPayload` met elk veld bij naam, geen spread van de bron
en geen beroep op het kopiëren bij schrijven van Immer. Elk veld van `DocumentPayload` is verplicht, dus een nieuw veld
geeft daar een compileerfout en vraagt een keuze: klonen, delen of vers. Toetsen: `tests/mcp/cases-documents.ts` (leeg
`filePath` en `fileHandle`, gewijzigd, geen gedeelde arrays, lege geschiedenis, variantnummers, naamloze bron).

Wat gepubliceerd wordt, is niet die voorbereide kopie zelf maar de uitkomst van de activatie (`materializeLibraryBoundary`
in `documentActivation.ts`, ADR 0472). Die bepaalt `resourceLoadResult` opnieuw (`computeReliableResourceLoad`): een
eigen resultaat voor de kopie, of `null` als het `cpmResult` een rekenfout draagt. Hoort het document bij een resourcebibliotheek waarvan kalenders of resources achterlopen, dan
loopt ook de verversing uit de bibliotheek (`materializeBehindOnlyRefresh`, ADR 0342; voor een
vastlegging met `recountShiftedAfterLibraryRefresh`).

Open veldinvoer rondt `duplicateDocument` af vóór hij de bron vastlegt: die invoer hoort in de bron en daarmee ook in de
kopie, en niet alleen in de kopie doordat het veld na de wissel verdwijnt (#401). De regressietest
*documentwissel zonder blur (MCP-dupliceren)* in `tests/browser/assignments-block.spec.ts` typt een waarde in het
inzetveld, roept met de focus nog in dat veld `duplicateDocument` aan, en vergelijkt daarna de waarde in bron en kopie
en de wijzigingsvlag van de bron.

## Gevolgen

- Gekloond (`deepClone`, een JSON-kloon): project, kalenders, taken, relaties, resources, toewijzingen,
  activity codes, eigen velden, eigen taaktypes, baselines, `view` en `collapsedTaskIds`. `comparedBaselineIds` wordt
  een nieuw paar met dezelfde twee id's. Muteren in de kopie raakt de bron dan niet (case 4 in `cases-documents.ts`).
  Dat de JSON-kloon die waarden ongewijzigd laat, is een aanname (knownbug 2510).
- Vers: geen selectie, geen opslagdoel (`filePath`, `fileHandle`, `siteFileId`, `siteFileVersion` en
  `knownTargetFingerprint` leeg), `autoSaveToFile: false`, `isDirty: true` en `importPristine: false` (ADR 0433). Zonder
  het lege site-doel schreef Ctrl+S in de kopie een nieuwe versie van het sitebestand van de bron. Het bronkenmerk
  `foreignSourceMark` deelt de kopie wel (hieronder), met de browserhandle van het origineel erin; na crashherstel kan
  die handle het opslagdoel van de kopie worden (knownbug 2511).
- In de voorbereide kopie per referentie gedeeld: de rekenvelden (`cpmResult`, `resourceLoadResult`, `scheduleStale`,
  `recordedDates`, `datesAsRecorded`, `minuteModelPending`), want ze zijn afgeleid en worden als geheel vervangen
  (ADR 0431, en ADR 0432 voor `resourceLoadResult`). Na de activatie (hierboven) heeft de kopie een eigen
  `resourceLoadResult`, of `null` bij een rekenfout; de andere houdt ze van de bron, behalve wat de activatie bij een verversing uit de bibliotheek
  vervangt, tot een bewerking of berekening in de kopie ze vervangt. Ook gedeeld: het XER-archief met
  `xerSourceProjectId`, `ifcSource`, `foreignSourceMark` en `xerArchiveIssue` (ADR 0433). `activeBaselineId`,
  `fileFormat` en `taskTypesVisible` neemt de kopie over.
- `ifcGlobalIds` deelt de kopie met de bron: de taken houden hun id's, dus ook hun GlobalIds, zoals vóór audit 2026-09-26
  toen de GlobalId uit het id werd afgeleid. `ifcLiteralCalendarIds` ook: dezelfde kalenders krijgen dezelfde
  schrijfkeuze (knownbug 1026, ADR 0433).
- De XER-metadata (`cloneXerImportMetadata`) hangt af van het archief. Met een archief én een `sourceProjectId` in de
  metadata bouwt de kopie haar metadata opnieuw op uit de documentview van dat project in het archief
  (`bindXerImportMetadataToArchive`); de resourcecatalogus en de bronrijen van de rekenopties zijn dan die van het
  archief. Toets van die tak: `check-xer-resource-duplicate.ts` (dezelfde catalogus in bron en kopie). Zonder archief,
  of zonder `sourceProjectId`, wordt de metadata buiten de catalogi een JSON-kloon (knownbug 2510). In die tak gaan de
  bestandsbrede, bevroren resourcecatalogus en de catalogus `metadata` per referentie mee, en kopieert
  `cloneXerResourceMetadata` de toewijzingen van het project (met hun geneste objecten één laag diep) en de `issues`.
  Een JSON-kloon van de catalogus zou bij `rehab-2.xer` 52.640 toewijzingsrijen kopiëren (ADR 0397).
- De geschiedenis is app-globaal en gaat niet mee; de kopie begint zonder undo-stappen (case 5).
- De naam: een meegegeven `name` wint. Anders `"<basis> (variant N)"`: `variantBaseName` haalt een bestaand achtervoegsel
  eraf, zodat een variant van een variant dezelfde basis houdt, en N is het laagste vrije nummer vanaf 2 onder de
  projectnamen van de open documenten met die basis (`nextVariantName`). Zo kan `planner_list_documents` de varianten
  onderscheiden. Er is geen los titelveld, dus de naam staat in `project.name` en gaat mee in het IFC (dezelfde spec).
- Een naamloze bron geeft een naamloze kopie. `nextVariantName('')` zou `' (variant 2)'` in de projectdata en dus in het
  IFC zetten. Het onderscheid tussen naamloze tabbladen komt uit de weergave: `getOpenDocuments` geeft een document
  zonder bestand, naam en P6-projectcode een lege titel (`documentTitle`, dezelfde regel als de tabbladen) en, vanaf
  het tweede naamloze tabblad, een `untitledOrdinal` (`untitledOrdinals`, `utils/documents.ts`; het eerste en een enig
  naamloos tabblad krijgen er geen), en de weergavelaag zet het vertaalde label
  `common:project.untitled` ervoor. Het nummer is taalonafhankelijk en staat niet in de data (case 8 tot en met 10).
- Na de publicatie roept `duplicateDocument` `settleLayoutSession` aan (`viewSlice.ts`): de Gantt-overlays zijn app-breed,
  dus een layout in het gekopieerde beeld kan niet meer kloppen. `switchDocument`, `newDocument` en `closeDocument` doen
  dat niet; `applyLayout` en `toggleLayout` ruimen eerst zelf op.
