# De documentwissel: volgorde, en de UI die bij het uitgaande document hoort

De routes die het actieve document vervangen (`newDocument`, `duplicateDocument`, `switchDocument`, beide wisseltakken
van `closeDocument` en `restoreDocuments`) volgen dezelfde volgorde. Eerst ronden ze open veldinvoer af
(`runtime.finishPendingTextEdits`, `pendingTextEdits.ts`): die invoer hoort bij het document dat nog actief is.
Dan rekenen ze buiten de producer de activatie uit (`materializeLibraryBoundary`) en publiceren ze in één `set`: het
register bijwerken, het nieuwe document actief maken, `resetDocumentScopedUI` en daarna `publishActivation`.
`newDocument`, `duplicateDocument` en `switchDocument` parkeren daarbij het uitgaande document per referentie in het
register (`capturePayload`). De meldingen over de activatie (werkregel, minutenomzetting, rekenfout) en de host-events
komen na die `set`: eerst wissen wat bij het uitgaande document hoort, dan melden.

## Gevolgen

- `switchDocument` en `duplicateDocument` breken een lopende samenvoegreeks van undo-stappen af
  (`runtime.resetUndoCoalescing`): na het terugwisselen ging een reeks anders verder op de undo-stap van vóór de wissel.
  De marker in `storeRuntime.ts` draagt daarnaast het document-id; `newDocument`, `closeDocument` en `restoreDocuments`
  roepen de reset niet aan.
- `switchDocument` doet niets als het gevraagde document al actief is; voor een onbekend id of een registratie zonder
  payload keert hij terug nadat hij de invoer afrondde en de samenvoegreeks afbrak.
- Wijzigde de activatie kalenders of resources uit de bibliotheek (`activation.invalidateRedoScope`), dan maken
  `switchDocument`, de tak van `closeDocument` die naar een buur wisselt en `restoreDocuments` de redo van het document
  dat actief wordt ongeldig (`invalidateDocumentRedo`). `newDocument`, `duplicateDocument` en het sluiten van het
  laatste document doen dat niet: hun nieuwe document heeft nog geen geschiedenis.
- `ui` is app-globaal (ADR 0430), maar een paar velden erin wijzen naar het uitgaande document. `resetDocumentScopedUI`
  zet ze op één plek terug, en elke route hierboven roept hem aan; een nieuw `ui`-veld dat een taak, resource of
  document aanwijst, hoort daar. Het gaat om de taakdialoog en `editingTaskId` (die wees na een wissel naar een taak die
  in het andere document niet bestaat), het shift-anker `selectionAnchor` en `pendingRelationAssign` (ook bij een kopie,
  die taak-id's en rijsleutels met de bron deelt; review #1004, ronde 5), `showLibraryLinkDialog` en
  `libraryRefreshNotice`, en `scheduleShift` met zijn melding (ADR 0430). Toets: `check-document-contract.ts`, onderdeel
  (j), voor `editingTaskId` en de taakdialoog op `switchDocument`, `newDocument`, `duplicateDocument` en het sluiten van
  het actieve document.
- `showLibraryLinkDialog` en `libraryRefreshNotice` zet `publishActivation` daarna opnieuw uit de signalen van de
  activatie; op de routes hierboven bepaalt dus de activatie hun waarde.
- `showProgressImportDialog` en `pendingPhaseAssignmentQuestion` zet `resetDocumentScopedUI` als vangnet terug. Beide
  tellen mee in `isBlockingDialogOpen` (`state/blockingDialogs.ts`), en Ctrl/⌘ 1–9 wisselt niet zolang
  `isDocumentLeaveBlocked` (`shortcutRegistry.ts`, via `hasBlockingDialogOpen`) waar is. De voortgangsimportdialoog
  houdt koppelwerk aan taak-id's van één document vast.
- Weigeringen gaan bij elke wissel weg en komen bij terugwisselen niet terug: de meldingen met `refusal` en de strook
  van een vergrendelde structuur (`clearRefusals`, eigenaarsbesluit 2026-10-19 5b, `refusalNotice.ts`). Van de andere
  meldingen haalt `resetDocumentScopedUI` alleen de uitleg na F5 weg (de melding met `SCHEDULE_SHIFT_NOTICE_KEY`, samen
  met `scheduleShift`); echte fouten en de overige meldingen blijven staan.
