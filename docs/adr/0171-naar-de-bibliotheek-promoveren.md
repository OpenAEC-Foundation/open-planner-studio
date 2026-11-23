# Een projectitem naar de bibliotheek promoveren

`promoteCalendarToPool` en `promoteResourceToPool` in `librarySlice.ts` zetten een kopie van een projectitem in de
pool en stempelen het bronitem in het project met de nieuwe herkomst. Het zijn twee soorten data in één handeling:
de pool is app-globaal en valt buiten undo, het stempel is projectdata. We kozen ervoor alleen het stempel een eigen
undo-stap te geven (`beginUndoable` vóór en `finishMutation` na het stempelen). Zonder eigen stap staat het stempel
in geen undo-event, en kan een undo van een andere stap het ongemerkt wegnemen. Een undo van de promotie zelf haalt
het stempel weg en laat de poolkopie staan; dat staat als bekend punt in `docs/library.md`. Toetsen: de blokken
"Terug-stempel bij promotie" en "Fix B4" in `tests/library/check-library-slice.ts`.

## Gevolgen

- Het stempel krijgt de poolversie van ná de bump en de hash van het nieuwe poolitem als `syncedHash`. Zonder die
  hash telt het bronitem meteen als afwijking (`deviated`), terwijl het gelijk is aan het poolitem.
- `promoteCalendarToPool` roept `syncProjectCalendar` aan, zodat ook de projectkalenderkopie `calendar` het stempel
  draagt wanneer de projectkalender zelf gepromoveerd wordt. De IFC-schrijver leest die kopie.
- Beide roepen na de promotie `refreshAllDocumentsFromPool` aan, net als `updatePoolCalendar`, `updatePoolResource`
  en de `removePool`-acties; daarmee geldt ook hier de redo-wis van ADR 0172 (het blok "F4 (vervolg)" in
  `check-library-slice.ts`).
- Een gepromoveerde kalender of resource verliest haar eigen `libraryOrigin`: het poolitem is zelf een origineel. Een
  gepromoveerde resource verliest ook `parentId`, en `calendarId` wordt leeg, omdat een poolitem niet naar een
  kalender-id uit één project wijst.
- `promoteResourceToPool` koppelt alleen met `opts.dedupByName` aan een bestaand poolitem met dezelfde unieke naam
  (`matchByName`). De rijactie "Naar de bibliotheek" in `ResourcePanel.tsx` geeft die vlag mee. Zonder de vlag komt
  er altijd een nieuw poolitem, zodat een andere aanroeper nooit stil aan een bestaand item gekoppeld wordt. Met de
  vlag geeft een onbekend of al gestempeld bronitem `null` terug in plaats van het id van het gevonden poolitem: er is
  dan niets gekoppeld. Toets: het blok "promoteResourceToPool: dedup op naam" in `check-library-slice.ts`.
- Zonder pool voor het gekozen bedrijf geven beide `null` terug, en maakt `promoteCalendarToPool` geen id aan.
- `addPoolResource` geeft een nieuwe bibliotheekresource zonder kleur de eerste vrije paletkleur
  (`nextFreePaletteColor`). Een promotie doet dat niet en neemt de kleur van het projectitem over.
