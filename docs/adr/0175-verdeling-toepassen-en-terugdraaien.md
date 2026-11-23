# Een verdeling toepassen en weer terugdraaien

`applyDistribution` in `librarySlice.ts` schrijft een verdelingsvoorstel in elk deelnemend geopend document, en
`undoDistribution` draait dat in één keer terug (`docs/library.md`, *Bekende beperkingen* punt 5). We kozen ervoor
dat een vastgelopen ronde in een slapend document de hele actie afbreekt voordat er iets geschreven is, en dat
Toepassen in elk geschreven document een gewone undo-stap achterlaat in de sessiegeschiedenis van de app. Die stap
kiest Ctrl+Z dan ook in dat document (`tests/library/check-apply-distribution.ts`, geval 10), en "alles
terugdraaien" draait precies die stappen terug.

Een slapend document heeft geen live state. Daarom draait `applyDistribution` voor elk slapend document eerst de
echte actie (`applyLeveling`) in een wegwerpcontext (`runInScratchDocument`), buiten de producer en voordat er iets
in `documents` geschreven is. Gooit zo'n ronde een fout, of geeft de `runCPM` daarin een `cpmResult.error`, dan
stopt de hele actie met `scratch-failed`: het actieve document is dan nog niet aan de beurt geweest en de eerdere
rondes schreven alleen in hun eigen weggegooide payload (geval 2b). Daarna komt het actieve document via de gewone
route van `applyLeveling`, en pas dan schrijft één producer de nieuwe slapende payloads met hun events.

## Gevolgen

- `applyDistribution` begint met `resetUndoCoalescing`. Anders kan `finishUndoable` het `after` van een ouder,
  lopend event bijwerken in plaats van een eigen event te maken, en is er geen event voor het record.
- De wegwerpcontext krijgt het echte document-id mee, omdat `applyLeveling` zijn eenmalige afrondingsmelding op
  `activeDocumentId` vastlegt (`tests/planning/check-scratch-document.ts`, geval 5b).
- Meldingen uit de wegwerprondes gaan pas naar het gewone kanaal als Toepassen gelukt is. Bij een afgebroken actie
  zouden ze een document beschrijven dat niet veranderd is.
- Het event van het actieve document zoekt `latestDocumentDataEventSince` op vanaf `nextHistorySequence` van vlak
  vóór `applyLeveling`; die teller loopt door na het opruimen van oude events, een index of diepte niet. Het neemt
  het jongste event en niet het eerste, omdat `runCPM` na `applyLeveling` in *datums zoals opgeslagen* een tweede
  event kan maken.
- Eén producer schrijft per slapend document de payload en registreert het event (`recordSessionHistoryDeltas`). Een
  document dat intussen gesloten of actief werd (`payload === null`), slaat hij over. Het record bevat alleen
  documenten met een event; zonder zulke documenten is de uitkomst `nothing-to-write`.
- Het label `Verdeling toepassen` is een interne historieomschrijving, geen UI-tekst, zoals de labels in
  `gridTransaction.ts`.
- `undoDistribution` draait een document alleen terug als `distributionUndoTarget` het event nog vindt, het op
  `applied` staat en `selectUndoHistoryEvent` het nu voor dat document zou kiezen. Anders komt het in
  `skippedDocIds`, bijvoorbeeld als de planner er intussen verder werkte of het sloot (gevallen 8 en 11). De
  vingerafdruk van het voorstel (`proposalFingerprint.ts`) beantwoordt een andere vraag, of het voorstel nog geldt,
  en vervangt deze poort niet.
- Het actieve document gaat terug via `undo()`. Een slapend document krijgt de `before`-snapshot over zijn payload,
  met `isDirty: true` zoals `restoreSnapshot` en `resourceLoadResult: null`; bij activering rekent
  `materializeLibraryBoundary` in `switchDocument` de belasting opnieuw uit. Het event staat daarna op `undone`,
  zodat redo na activering via `redo()` gaat.
