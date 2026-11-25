# De vorm van een pool bij laden en importeren

Een pool komt uit de opgeslagen bibliotheek of uit een poolbestand, en zo'n bestand kan met de hand of door een ander
programma gemaakt zijn: `calendars` of `resources` ontbreken, of zijn een object in plaats van een lijst. We
normaliseren daarom aan de ingangen, met `normalizePoolShape` in `src/services/library/libraryOps.ts`, zodat een latere
`.push`, `.find` of `.length` op `calendars` of `resources` een lijst vindt. Aanroepers: `normalizePool` in
`src/state/slices/librarySlice.ts` (gebruikt door `normalizeLoadedLibrary` bij het laden van de bibliotheek en door
`replacePool`), `importPoolAsNewCompany`, en `readPoolIFC` in `libraryIfc.ts`, waarvan `PoolImportDialog` meteen
`calendars.length` en `resources.length` toont, vóór de planner de import bevestigt.

## Gevolgen

- `calendars` en `resources` worden met `Array.isArray` getoetst, anders een lege lijst. Een `??` zou een object
  doorlaten, want dat is niet `null`. De elementen zelf worden niet op vorm getoetst: een element dat geen object is,
  blijft in de lijst staan (knownbug 2330).
- `poolVersion`: een geheel getal wordt minstens 1 (`Math.max(1, …)`); elke andere waarde (tekst, ontbrekend, `NaN`,
  een breuk) wordt 1. Een geheel getal vanaf 9007199254740992 komt er ongewijzigd door, en daar kan `bumpPool` blijven
  steken: bij precies 9007199254740992 geeft `+ 1` hetzelfde getal (knownbug 2334). `modifiedAt` blijft als het
  tekst is, anders het tijdstip van nu. `companyName` blijft als het tekst is, anders de naam van de bibliotheek met
  dat id in `companies`, anders het id zelf.
  `importPoolAsNewCompany` en `replacePool` zetten daarna hun eigen naam. Toets voor `poolVersion` 1 en `modifiedAt`
  bij een kapotte pool: het blok "initLibrary-normalisatie" in `tests/library/check-library-slice.ts`.
- `seedVersion` blijft alleen als het een geheel getal van 0 of meer is, en valt anders weg. `seedDemoLibrary` leest
  het om te beslissen of `migrateDemoLibrarySeed` draait (ADR 0174). Viel het veld bij het laden altijd weg, dan
  draaide die migratie na elke start opnieuw, bij de eerste aanroep van `seedDemoLibrary`.
- Elke kalender in de pool die een object is, gaat door `withRepairedFirstBlockScalar` (ADR 0323); zonder dat herstel
  stond een ongewijzigde projectkopie na het openen op `deviated`. `poolCalendarById` doet hetzelfde bij elke opzoeking
  op id, voor een kalender die niet langs `normalizePoolShape` in de pool kwam; `diffCalendarVsPool`,
  `classifyCalendarOnOpen`, `copyCalendarToProject` en `applyCalendarUpdate` lezen de poolkalender via die functie.
- Een `null` in de werkblokken van de eerste werkdag met blokken (`firstBlockedDay` in `src/utils/effectiveWorkTime.ts`,
  die dag gaat naar `workDayFromBlocks` in `src/services/subdayIo.ts`) laat `normalizePoolShape` zelf gooien; een
  `null` op een latere werkdag niet (knownbug 2333). Bij importeren
  meldt `PoolImportDialog` dan "Dit IFC-bestand bevat geen resourcebibliotheek"; bij laden uit opslag blijft
  `libraryLoaded` onwaar.
- Andere velden van de pool vallen weg (`docs/library.md`, *Bekende kleine punten*).
