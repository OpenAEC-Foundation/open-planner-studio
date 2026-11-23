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
weten dat zijn wijziging na een herstart weg kan zijn; de vaste sleutel voorkomt een stapel meldingen bij een fout die
blijft terugkomen (issue #76, het blok "Issue #76" in `tests/library/check-library-slice.ts`). De sandbox-situatie
waarin dat elke keer gebeurt, staat als knownbug 260.

## Gevolgen

- Hernoemen (`renameCompany`) zet de nieuwe naam ook in `companyName` van de pool en van elk geopend document dat aan
  de bibliotheek hangt, actief en slapend. De IFC-schrijver neemt `project.companyName` over; zonder dit schreef een
  opgeslagen bestand de oude naam (het blok over hernoemen, audit R10, in `check-library-slice.ts`).
- Hernoemen en verwijderen (`removeCompany`) veranderen geopende documenten zonder undo-stap en zonder `isDirty`:
  het is bibliotheekbeheer en geen bewerking van het project. Wat verwijderen met geopende en opgeslagen documenten
  doet, staat in `docs/library.md`.
- `removeCompany` legt vóór de `set` vast of er echt een bibliotheek weggaat en of dat die van het actieve project
  is. Alleen dan zet het daarna `showLibraryLinkDialog` en `libraryRefreshNotice` terug, zodat geen scherm of signaal
  van de verwijderde bibliotheek blijft staan. Op de laatste bibliotheek doet het niets, ook geen terugzetting.
- `removeCompany` en `bindProjectToCompany` werken na het strippen de projectkalenderkopie `calendar` bij
  (`refreshProjectCalendarCache`), voor een slapend document op de payload zelf, omdat Automatisch opslaan die kopie
  zonder hydrate schrijft (het blok "F1 (vervolg)" in `check-library-slice.ts`).
- `addCompany` valt bij een lege naam terug op de vertaalde standaardnaam, en op een vaste Nederlandse naam als
  i18next nog niet klaar is (knownbug 125).
