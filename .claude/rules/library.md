---
paths:
  - "src/services/library/**"
  - "src/state/slices/librarySlice.ts"
  - "src/components/panels/ResourceOccupancyView.tsx"
  - "src/components/backstage/LibrarySection.tsx"
  - "src/components/dialogs/LibraryLinkDialog.tsx"
  - "tests/library/**"
  - "docs/library.md"
---

<!-- Verplaatst uit CLAUDE.md (2026-09): laadt alleen wanneer Claude een bestand leest dat op `paths` past. Inhoud ongewijzigd overgenomen; "hierboven"/"hieronder" verwijst naar de oude volgorde van CLAUDE.md. -->

### Resourcebibliotheken

De bibliotheek (`librarySlice`) is app-globaal, net als extensies — niet per-document geswapt.
Persistentie via een `isTauri()`-gesplitste `libraryStore`: IndexedDB `ops-library` in de browser,
`ops-library.json` in `appDataDir` op desktop. Herkomststempels en bibliotheekbinding round-trippen
door het project-IFC via het bestaande `OPS_`-pset-patroon. De **bibliotheek is de bron** met de
volledige resource-editor; het project toont de inzet, en toewijzen vanuit de bibliotheek *is*
materialiseren (geen los "kopiëren"/"bijwerken-uit"). De Resources-tab kent daarom een
Bibliotheek- en een Projectweergave, met markeringen voor *wijkt af* / *niet meer in de bibliotheek*
en een gedeelde `LibraryLinkDialog` voor koppelen en afwijkingen. Let op de terminologie: code en
IFC gebruiken nog `companyId`/`companyName`, de **gebruikersterm is "resourcebibliotheek"** —
"bedrijf" alleen waar het echt over de organisatie gaat. Zie `docs/library.md`.

Een derde weergave op de Resources-tab (B1b) is **Bezetting**: per bibliotheekitem de boeking over
**alle geopende documenten** die aan dezelfde bibliotheek gekoppeld zijn, met de bedrijfscapaciteit
als grens — dubbelbezetting tussen projecten, die geen los project kan zien. De kern is
`computeLibraryOccupancy` (`src/services/library/occupancy.ts`), puur en headless getest
(`tests/library/check-occupancy.ts`); de weergave is `src/components/panels/ResourceOccupancyView.tsx`.
Een niet-actief geopend document met een stale planning wordt **efemeer** doorgerekend — `solveProject`
op een kloon van zijn taken, alleen voor deze weergave, zonder de payload aan te raken — tenzij
**Automatisch berekenen** aanstaat, in welk geval het overzicht die documenten meteen écht bijwerkt
(zie *State* hierboven). De weergave ziet uitsluitend documenten die in déze app-instantie open staan;
geen sync tussen machines of vensters (zie `docs/library.md` en de in-app gids
`public/docs/{nl,en}/gids-bezettingsoverzicht.md`).
