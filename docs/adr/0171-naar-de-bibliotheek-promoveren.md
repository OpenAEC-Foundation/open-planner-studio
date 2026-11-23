# Een projectitem naar de bibliotheek promoveren

`promoteCalendarToPool` en `promoteResourceToPool` in `librarySlice.ts` zetten een kopie van een projectitem in de
pool en stempelen het bronitem in het project met de nieuwe herkomst. Het zijn twee soorten data in één handeling:
de pool is app-globaal en valt buiten undo, het stempel is projectdata. We kozen ervoor alleen het stempel een eigen
undo-stap te geven (`beginUndoable` vóór en `finishMutation` na het stempelen). Zonder eigen stap staat het stempel
in geen undo-event, en kan een undo van een andere stap het ongemerkt wegnemen. Een undo van de promotie zelf haalt
het stempel weg en laat de poolkopie staan; dat staat als bekend punt in `docs/library.md`. Toetsen: de blokken
"Terug-stempel bij promotie" en "Fix B4" in `tests/library/check-library-slice.ts`.

## Gevolgen

- Het stempel krijgt de poolversie van ná de bump en de hash van het nieuwe poolitem als `syncedHash`. Een stempel
  zonder `syncedHash` telt, zodra een gevolgd veld van het poolitem later verandert, als afwijking in plaats van
  stil te verversen (`classifyOnOpen` in `src/services/library/libraryOps.ts`).
- `promoteCalendarToPool` roept `syncProjectCalendar` aan, zodat ook de projectkalenderkopie `calendar` het stempel
  draagt wanneer de projectkalender zelf gepromoveerd wordt. De IFC-schrijver leest die kopie.
- De tak die een nieuw poolitem maakt, roept daarna `refreshAllDocumentsFromPool` aan, net als `updatePoolCalendar`,
  `updatePoolResource` en de `removePool`-acties; daarmee geldt daar de redo-wis van ADR 0172 (het blok "F4
  (vervolg)" in `check-library-slice.ts` toetst dat voor een nieuw poolitem). De tak van `promoteResourceToPool` die
  aan een bestaand poolitem koppelt, verandert de pool niet en roept `refreshAllDocumentsFromPool` niet aan.
- Een gepromoveerde kalender of resource verliest haar eigen `libraryOrigin`: het poolitem is zelf een origineel.
  Een gepromoveerde resource verliest ook `parentId`, en `calendarId` wordt leeg, omdat een poolitem niet naar een
  kalender-id uit één project wijst.
- `promoteResourceToPool` koppelt alleen met `opts.dedupByName` aan een bestaand poolitem met dezelfde unieke naam
  (`matchByName`). De rijactie "Naar de bibliotheek" in `ResourcePanel.tsx` geeft die vlag mee. Zonder de vlag komt
  er een nieuw poolitem, ook naast een gelijknamig item, zodat een aanroeper zonder de vlag niet stil aan een
  bestaand item gekoppeld wordt. Met de vlag geeft een onbekend of al gestempeld bronitem `null` terug in plaats van
  het id van het gevonden poolitem: er is dan niets gekoppeld. Toets: het blok "promoteResourceToPool: dedup op
  naam" in `check-library-slice.ts`.
- Zonder pool voor het gekozen bedrijf geven beide `null` terug, en maakt `promoteCalendarToPool` geen id aan.
- `addPoolResource` geeft een nieuwe bibliotheekresource zonder kleur de eerste vrije paletkleur
  (`nextFreePaletteColor`). Een promotie doet dat niet en neemt de kleur van het projectitem over.
