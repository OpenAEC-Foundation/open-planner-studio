# De STEP-bestandsgrammatica wijkt op een paar plekken bewust af van ISO 10303-21

`stepFileGrammar.ts` leest een heel STEP-bestand volgens ISO 10303-21 editie 3, zodat `readIFC` een modeltype ook ziet
vóór het punt waar een bestand breekt, en de doelcontrole alleen over een bestand schrijft dat helemaal in de grammatica
past, op de herkende oude eigen kop na (`oldOwnHeader.ts`; regel `tauri-ifc`, ADR 0041). Op een paar plekken leest zij ruimer dan de norm, omdat bestanden die de app zelf
schreef of altijd opende anders zouden breken. Wie haar strenger maakt, laat zulke bestanden als doel weigeren.

## Gevolgen

- Een backslash in een string die geen bekende reeks begint (`\\`, `\S\`), blijft een gewoon teken: oude eigen
  bestanden schreven JSON met `\"` letterlijk. De stringgrenzen staan in `stepString` (`stepLexical.ts`), gedeeld met
  de planningparser en de doelcontrole.
- Sleutelwoorden lezen hoofdletterongevoelig (alleen ASCII), zoals de app altijd deed.
- Een datakop `DATA ( 'naam' , ( 'schema' { , 'schema' } ) ) ;` mag meer dan één schema noemen (`dataHeadPunct`).
- Een BOM vooraan telt niet: als tekst één U+FEFF, als UTF-8-bytes ook een tweede BOM direct na de eerste, zodat
  de bytes hetzelfde oordeel geven als hun tekst na `TextDecoder`, die van twee BOM's één U+FEFF overlaat.
- `isModelWord` maakt alleen een string van een woord dat niet langer is dan het langste modeltype en waarvan de
  FNV-1a-hash een treffer geeft in de tabel van de modeltypen. Een woord van 1 MiB maakte met `String.fromCharCode.apply` anders
  een stapeloverloop; haal de lengtetoets dus niet weg als dubbel.
