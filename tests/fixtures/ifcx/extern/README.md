# IFCX-modelbronnen

Alle vier bestanden zijn voor deze proef geschreven. De documentkop, de lokale bijdragen en het klasseveld `bsi::ifc::class.code` volgen het [IFC5-voorbeeld Hello Wall van buildingSMART](https://github.com/buildingSMART/IFC5-development/blob/1a63082ada967c683cfacee2005f8f749c8e1b79/examples/Hello%20Wall/hello-wall.ifcx). Het tekstattribuut `openaec::label` komt uit [het ontwerp, §6.2](../../../../docs/superpowers/specs/2026-11-07-gebouwmodel-behouden-ifc-ifcx-design.md#62-eigendom-per-bijdrage).

- `gevel.ifcx` bevat twee muren met een eigen tekstnaam in `bsi::ifc::prop::Name`, zoals [IFC Lite die schrijft](https://github.com/LTplus-AG/ifc-lite/blob/73932d9ef6e2798f35fdbe9234f1d4303eb5d9be/packages/ifcx/src/writer.ts#L205). Het muurtype heeft een tekstnaam in `bsi::ifc::prop::TypeName`. Die vorm en de losse bijdrage met alleen `children` bij een pad komen uit Hello Wall. Het pad van het naamloze raam verschilt alleen in hoofdlettergebruik van dat van de westmuur.
- `bijdragen.ifcx` gebruikt de bestandsvolgorde uit §6.2. Het kozijn krijgt een ander producttype en daarna een nieuwe naam. De latei krijgt eerst een naam en later een klasse. Bij montage vervangt een taak de eerdere productklasse.
- `met-import.ifcx` gebruikt een import met het document-ID van `gevel.ifcx` als URI. De lokale laag geeft de geïmporteerde muur alleen een label en voegt zelf een dak toe. De attribuutdefinities staan in het andere bestand.
- `zonder-bouwdelen.ifcx` gebruikt dezelfde lokale klasse- en labelattributen voor een taak, een resource en een losse tekst.
