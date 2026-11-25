# Weergave, opslagdoel en sessiestand: per document, buiten de undo-snapshot

Een deel van de documentvelden reist mee bij een documentwissel maar staat niet in de undo-snapshot (`snapshot: 'none'`
in `DOCUMENT_FIELDS`, ADR 0431). Het zijn geen bewerkingen van de planning: het terugzetten van een planningssnapshot
hoort ze niet te raken. Dat gaat alleen over die snapshot: een layoutwijziging heeft haar eigen stap in de
weergavegeschiedenis (`document-view` in `viewSlice.ts` en `historySlice.ts`), en Ongedaan maken zet zo'n stap wel
terug, zonder de planningsdata aan te raken.
Ze zijn wel per document, omdat ze anders na een tabwissel bij het vorige document horen; `resourceLoadResult` liet
anders het histogram van het vorige document zien.

## Gevolgen

- Weergave: `selectedTaskIds`, `activeTaskId` (de taak van het enkelvoudige eigenschappenpaneel, los van de meervoudige
  selectie), `view` en `collapsedTaskIds`.
- `resourceLoadResult` is een afleidbare kopie: per document bewaard, zodat een slapend tabblad hem houdt, maar niet in
  undo. Na undo of redo rekent `materializeHistoryTarget` (`sessionHistory.ts`) hem opnieuw uit het herstelde doel.
- Opslagdoel: `filePath`, `fileHandle`, `siteFileId`, `siteFileVersion`, `knownTargetFingerprint` en `fileFormat`. Het
  doel leid je af met `saveTargetRef` (`fileAccess/index.ts`). `fileHandle` en `siteFileId` (issue #309) zijn alleen het
  doel, nooit de identiteit of titel van het document: die blijft `filePath`, op de desktop een echt pad en in de browser
  de bestandsnaam. Ze staan niet in `IFC_SAVE_KEYS`; crashherstel bewaart het site-doel in het manifest (ADR 0195).
- `siteFileVersion` is de versie van het sitebestand die dit document het laatst las of schreef; ze gaat als
  `baseVersion` mee bij de volgende opslag, zodat de site een conflict herkent. Ze is bewust per document en niet per
  bestand-id: twee tabbladen op hetzelfde sitebestand hebben elk hun eigen basis.
- `autoSaveToFile` is een persoonlijke keuze voor deze sessie: per tabblad, niet in `IFC_SAVE_KEYS` en niet in de
  herstelmetadata (`payloadFromInput` geeft de verse waarde `false`).
- `isDirty` staat buiten de snapshot; `restoreSnapshot` zet het document na undo of redo zelf op gewijzigd, behalve met
  `markDirty: false` (de MCP-rollback).
- `taskTypesVisible` zegt of de werkregel-UI voor dit document ontsloten is. Het is sessiestand en geen projectdata:
  niet in `IFC_SAVE_KEYS`, bij laden opnieuw afgeleid (`hasTaskTypeData` in `documentDataFromImport`).
