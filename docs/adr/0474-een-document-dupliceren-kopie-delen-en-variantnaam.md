# Een document dupliceren: wat de kopie krijgt, wat ze deelt en hoe ze heet

`duplicateDocument` maakt van het actieve document een nieuwe, actieve kopie (wat-als, variant; MCP-WP4). De bron
gaat per referentie in het register, zoals bij een wissel (ADR 0472). De kopie is een uitgeschreven `DocumentPayload`
met elk veld bij naam, geen spread van de bron en geen beroep op het kopiëren bij schrijven van Immer. Elk veld van
`DocumentPayload` is verplicht, dus een nieuw veld geeft daar een compileerfout en vraagt een keuze: klonen, delen of
vers. Toetsen: `tests/mcp/cases-documents.ts` (leeg `filePath` en `fileHandle`, gewijzigd, geen gedeelde arrays, lege
geschiedenis, variantnummers, naamloze bron).

Open veldinvoer rondt `duplicateDocument` af vóór hij de bron vastlegt: die invoer hoort in de bron en daarmee ook in de
kopie, en niet alleen in de kopie doordat het veld na de wissel verdwijnt (review #401, punt 1).

## Gevolgen

- Gekloond (`deepClone`, een JSON-kloon): project, kalenders, taken, relaties, resources, toewijzingen,
  activity codes, eigen velden, eigen taaktypes, baselines, `view` en `collapsedTaskIds`. `comparedBaselineIds` wordt
  een nieuw paar met dezelfde twee id's. Muteren in de kopie raakt de bron dan niet (case 4 in `cases-documents.ts`).
  Dat de JSON-kloon die waarden ongewijzigd laat, is een aanname (knownbug 2510).
- Vers: geen selectie, geen opslagdoel (`filePath`, `fileHandle`, `siteFileId`, `siteFileVersion` en
  `knownTargetFingerprint` leeg), `autoSaveToFile: false`, `isDirty: true` en `importPristine: false` (ADR 0433). Zonder
  het lege site-doel schreef Ctrl+S in de kopie een nieuwe versie van het sitebestand van de bron.
- Per referentie gedeeld: de rekenvelden (`cpmResult`, `resourceLoadResult`, `scheduleStale`, `recordedDates`,
  `datesAsRecorded`, `minuteModelPending`), want ze zijn afgeleid en worden als geheel vervangen (ADR 0431); de kopie
  houdt de vastlegging en de modus van de bron tot een bewerking of berekening in de kopie ze vervangt. Ook gedeeld: het
  XER-archief met `xerSourceProjectId`, `ifcSource`, `foreignSourceMark` en `xerArchiveIssue` (ADR 0433).
  `activeBaselineId`, `fileFormat` en `taskTypesVisible` neemt de kopie over.
- `ifcGlobalIds` deelt de kopie met de bron: de taken houden hun id's, dus ook hun GlobalIds, zoals vóór audit 2026-09-26
  toen de GlobalId uit het id werd afgeleid. `ifcLiteralCalendarIds` ook: dezelfde kalenders krijgen dezelfde
  schrijfkeuze (knownbug 1026, ADR 0433).
- De XER-metadata (`cloneXerImportMetadata`): met een archief en een `sourceProjectId` bouwt de kopie haar metadata
  opnieuw op uit het archief (`bindXerImportMetadataToArchive`); anders een JSON-kloon zonder de catalogi. De
  bestandsbrede, bevroren resourcecatalogus en de catalogus `metadata` gaan per referentie mee, alleen de toewijzingen van
  het project worden gekopieerd (`cloneXerResourceMetadata`): een JSON-kloon van de catalogus zou bij `rehab-2.xer`
  52.640 toewijzingsrijen kopiëren (ADR 0397). Toets: `check-xer-resource-duplicate.ts` (dezelfde catalogus in bron en
  kopie).
- De geschiedenis is app-globaal en gaat niet mee; de kopie begint zonder undo-stappen (case 5).
- De naam: een meegegeven `name` wint. Anders `"<basis> (variant N)"`: `variantBaseName` haalt een bestaand achtervoegsel
  eraf, zodat een variant van een variant dezelfde basis houdt, en N is het laagste vrije nummer vanaf 2 onder de
  projectnamen van de open documenten met die basis (`nextVariantName`). Zo kan `planner_list_documents` de varianten
  onderscheiden.
- Een naamloze bron geeft een naamloze kopie. `nextVariantName('')` zou `' (variant 2)'` in de projectdata en dus in het
  IFC zetten. Het onderscheid tussen naamloze tabbladen komt uit de weergave: `getOpenDocuments` geeft een lege titel
  (`documentTitle`, dezelfde regel als de tabbladen) en een `untitledOrdinal` (`untitledOrdinals`, `utils/documents.ts`),
  en de weergavelaag zet het vertaalde label `common:project.untitled` ervoor. Het nummer is taalonafhankelijk en staat
  niet in de data (case 8 tot en met 10).
- Na de publicatie roept `duplicateDocument` `settleLayoutSession` aan (`viewSlice.ts`): de Gantt-overlays zijn app-breed,
  dus een layout in het gekopieerde beeld kan niet meer kloppen. `switchDocument`, `newDocument` en `closeDocument` doen
  dat niet; `applyLayout` en `toggleLayout` ruimen eerst zelf op.
