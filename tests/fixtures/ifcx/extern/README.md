# IFCX-modelbronnen

Alle vier bestanden zijn voor deze proef geschreven. De documentkop, de lijst met lokale bijdragen en het klasseveld `bsi::ifc::class.code` volgen de vorm uit het [IFC5-voorbeeld Hello Wall van buildingSMART](https://github.com/buildingSMART/IFC5-development/blob/main/examples/Hello%20Wall/hello-wall.ifcx). Voor een leesbare naam gebruiken de bestanden het tekstattribuut `openaec::label` uit [het ontwerp, §6.2](../../../../docs/superpowers/specs/2026-11-07-gebouwmodel-behouden-ifc-ifcx-design.md#62-eigendom-per-bijdrage).

- `gevel.ifcx` bevat twee lokale producten zonder geometrie of planning. De paden van de muur en het raam verschillen alleen in hoofdlettergebruik. Alleen de muur heeft een naam.
- `bijdragen.ifcx` gebruikt de bestandsvolgorde uit §6.2. Het kozijn krijgt een ander producttype en daarna een nieuwe naam. De latei krijgt eerst een naam en later een klasse. Bij montage vervangt een taak de eerdere productklasse.
- `met-import.ifcx` gebruikt een import met het document-ID van `gevel.ifcx` als URI. De lokale laag geeft de geïmporteerde muur alleen een label en voegt zelf een dak toe. De attribuutdefinities staan in het andere bestand.
- `zonder-bouwdelen.ifcx` gebruikt dezelfde lokale klasse- en labelattributen voor een taak, een resource en een losse tekst.
