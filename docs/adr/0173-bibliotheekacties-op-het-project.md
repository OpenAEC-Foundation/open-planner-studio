# Bibliotheekacties op het project die niets veranderen

Welke bibliotheekacties op het project met Ctrl+Z terug te draaien zijn, staat in `docs/library.md`
(*Ctrl+Z/verversing-eigenaardigheid*). In `librarySlice.ts` kozen we ervoor dat deze acties in de gevallen hieronder
terugkeren vóór `beginUndoable` en vóór `finishMutation`. Zo maakt een knop die in zo'n geval niets doet geen
undo-stap en markeert hij het document niet als gewijzigd.

Binden is de uitzondering. `bindProjectToCompany` opent alleen bij omkoppelen naar een ander bedrijf een undo-stap,
omdat alleen die tak de stempels van het vorige bedrijf weghaalt. Een eerste binding of een herhaalde binding aan
hetzelfde bedrijf maakt geen undo-stap, maar markeert het document wel als gewijzigd: `finishMutation` loopt in elke
tak waarin het bedrijf bestaat.

## Gevolgen

- Materialiseren (`addLibraryCalendarToProject`, `addLibraryResourceToProject`) keert terug zonder undo-stap als de
  kopie al in het project staat (`copy.reused`).
- `updateProjectCalendarFromLibrary` en `updateProjectResourceFromLibrary` werken alleen bij als de diff `changed`
  geeft; bij `up-to-date` en `removed` keren ze terug.
- `linkRecognizedItems` kijkt eerst of er in de hele set een link is waarvan het poolitem nog bestaat. Zo niet, dan
  opent het geen undo-stap. Die toets kijkt alleen naar de pool, niet of het projectitem nog bestaat (knownbug
  1991). Een link naar een verdwenen poolitem slaat het over en de rest gaat door (het blok "linkRecognizedItems:
  verdwenen kandidaat" in `tests/library/check-library-slice.ts`). Een gekoppelde kalender zet `scheduleStale`, een
  gekoppelde resource niet.
- `unbindProject` doet niets op een project zonder binding; `unlinkResourceFromLibrary` niets op een onbekend id of
  een resource zonder stempel (het blok "unlinkResourceFromLibrary" in `check-library-slice.ts`).
- `unlinkResourceFromLibrary` roept daarna geen `recomputeResourceLoad` of `recomputeViewRows` aan. Het haalt alleen
  `libraryOrigin` weg van de resource en eventueel van haar meegereisde kalender; geen ander veld verandert.
- Materialiseren werkt met `current()` van de pool, omdat de kopieerhulpen `structuredClone` doen en een Immer-draft
  niet te klonen is.
