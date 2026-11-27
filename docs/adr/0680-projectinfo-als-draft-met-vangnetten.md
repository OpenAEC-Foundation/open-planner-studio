# Projectinfo als draft met vangnetten

Instellingen gelden meteen, maar Projectinfo (de dialoog, ook als nieuw-project-wizard, en Backstage →
Projectinfo) werkt met een lokale draft die pas op Toepassen naar de store gaat, zodat Annuleren en Verwerpen
niets achterlaten. `ProjectInfoPanelContent` levert de velden; de wrapper bezit de knoppen en roept `submit()` aan
via een ref, omdat de Enter-afhandeling van `Dialog` op het buitenste element zit. De Backstage-sectie blijft
gemount zolang de gebruiker op die pagina staat, en daar werken Ongedaan maken en Opnieuw (Ctrl+Z/Y) buiten een
invoerveld gewoon (`isEditShortcutBlocked`). Het project kan dus onder een open draft veranderen. Een verouderde
draft mag dan niets stil terugdraaien, daarom drie vangnetten:

- Een documentwissel (`activeDocumentId`) zet de hele draft opnieuw uit het nieuwe document.
- De bibliotheekkoppeling en het rekenprofielblok gaan alleen mee naar de store als de gebruiker die bediening in
  deze mount aanraakte (`companyTouched`, `calcTouched`). Ontkoppelen is het gevaarlijke pad: `unbindProject`
  haalt alle `libraryOrigin`-stempels weg.
- Verandert de store onder de draft, dan volgt elk metadataveld dat nog gelijk is aan de vorige store-waarde de
  nieuwe waarde; een veld dat de gebruiker wijzigde, blijft staan. Een schone rekenprofiel-draft volgt de store;
  een vuile blijft staan en het blok zegt dat Toepassen die wijziging terugzet (`data-ops-scheduling-store-changed`).

## Gevolgen

- Een nieuwe resourcebibliotheek ("+ Nieuwe resourcebibliotheek…") ontstaat pas in `handleSubmit`. Daarom twee
  vlaggen die niet samen mogen: `creatingCompany` zegt of het naamveld open staat, `pendingNewCompany` of
  Toepassen de bibliotheek moet aanmaken. Bevestigen sluit het veld, de intentie blijft.
- Een eigen rekenprofiel zonder naam maakt de hele draft ongeldig: `submit()` legt dan niets vast, ook de metadata
  niet, anders zou Toepassen de conventiewijzigingen stil weggooien.
- Alleen de modale dialoog zet `autoFocusName` aan; op de Backstage-pagina zou het veld bij elk bezoek de focus
  pakken.
