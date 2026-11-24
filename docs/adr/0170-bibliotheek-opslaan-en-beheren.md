# De bibliotheek opslaan en beheren

De resourcebibliotheek (`companies`, `defaultCompanyId`, `pools` in `librarySlice.ts`) is app-globaal en hoort niet
bij een document (regel `library`). De store is de bron in het geheugen. Acties die de bibliotheek veranderen, zoals
`addCompany`, `updatePoolResource` en `replacePool`, roepen na hun `set` de functie `persist` aan, die
`persistLibrary` start zonder erop te wachten. Zo blijft een slice-actie synchroon en wacht geen aanroeper op de
schijf. `initLibrary` slaat niet op: het laadt de opgeslagen bibliotheek.

`persistLibrary` schrijft niets zolang `libraryLoaded` onwaar is. Vóór `initLibrary` staat in de store nog de verse
standaardbibliotheek; die nu wegschrijven zou de opgeslagen bibliotheek kunnen overschrijven voordat het laden klaar
is. Mislukt het opslaan, dan geeft `persistLibrary` naast de regel in het debuglog de foutmelding
`notifications.librarySaveFailed`, met de sleutel `library-save` als `dedupeKey`. Zonder melding zou de planner niet
weten dat zijn wijziging na een herstart weg kan zijn; de vaste sleutel voorkomt een stapel meldingen bij een fout
die blijft terugkomen (issue #76, het blok "Issue #76" in `tests/library/check-library-slice.ts`). De
sandbox-situatie waarin dat elke keer gebeurt, staat als knownbug 260.

## Gevolgen

- Hernoemen (`renameCompany`) zet de nieuwe naam ook in `companyName` van de pool en van elk geopend document dat
  aan de bibliotheek hangt, actief en slapend. De IFC-schrijver neemt `project.companyName` over; zonder dit schreef
  een opgeslagen bestand de oude naam (het blok over hernoemen, audit R10, in `check-library-slice.ts`).
- Hernoemen en verwijderen (`removeCompany`) veranderen geopende documenten zonder undo-stap en zonder `isDirty`:
  het is bibliotheekbeheer en geen bewerking van het project. Wat verwijderen met geopende en opgeslagen documenten
  doet, staat in `docs/library.md`.
- `removeCompany` legt vóór de `set` vast of er echt een bibliotheek weggaat en of dat die van het actieve project
  is. Alleen dan zet het daarna `showLibraryLinkDialog` en `libraryRefreshNotice` terug, zodat geen scherm of
  signaal van de verwijderde bibliotheek blijft staan. Op de laatste bibliotheek verwijdert het niets en zet het
  niets terug.
- `removeCompany` en `bindProjectToCompany` (bij omkoppelen) werken na het strippen de projectkalenderkopie
  `calendar` bij (`refreshProjectCalendarCache`). `removeCompany` doet dat bij een slapend document op de payload
  zelf, omdat Automatisch opslaan een slapende payload zonder hydrate doorgeeft (het blok "F1 (vervolg)" in
  `check-library-slice.ts`).
- `replacePool` en `importPoolAsNewCompany` rekenen eerst de openingsgrens van het actieve document uit
  (`materializeLibraryBoundary` met `'open-boundary'`) en schrijven daarna de pool, het actieve document en de
  signalen van het afwijkingenscherm in één `set`. Met twee losse publicaties ziet een abonnee tussendoor het
  actieve project met zijn oude waarden tegen de nieuwe pool. In `check-library-slice.ts` tellen
  de asserts bij `importPoolAsNewCompany` de publicaties van de store en eisen ze er één. Bij `replacePool` toetst
  de check de eindstand, en apart dat de bron van `PoolImportDialog` de aanroep `runOpenBoundary()` niet bevat.
- `addCompany` valt bij een lege naam terug op de vertaalde standaardnaam, en op een vaste Nederlandse naam als
  i18next nog niet klaar is (knownbug 125).
