# ZIP-laag: keuzes die verrassen

De ZIP-lezer en -schrijver in `src/services/zip/` dienen twee afnemers: de extensie-installatie en de `.xlsx`-laag
van het voortgangsblad. Een paar keuzes daarin lijken overbodig of omslachtig, maar houden een van die twee afnemers
werkend.

## Gevolgen

- **Eén gedeelde topmap gaat er alleen af zonder `select`** (`normalizeZipEntries`, aangeroepen vanuit
  `parseZipEntries`). Het strippen bestaat voor de extensie-installatie, waar een ZIP vaak één wikkelmap draagt
  (`mijn-extensie/manifest.json`). Wie met `select` een deel opvraagt, vraagt om precies die namen; bij een selectie
  van één entry deelt "iedere entry" per definitie dezelfde topmap. De `.xlsx`-lezer vraagt zo
  `xl/worksheets/sheet1.xml` op en zou bij strippen `worksheets/sheet1.xml` terugkrijgen, waarna elk voortgangsblad
  als `noSheet` weigert.
- **`ZipCompressionUnsupportedError` is een subklasse van `ZipValidationError`.** `parseZipEntries` valt bij een
  andere fout uit de central-directory-route terug op de local-header-scan; die zou in een omgeving zonder
  `DecompressionStream` dezelfde fout opnieuw geven, met een misleidende `console.warn` ertussen. Een eigen klasse,
  zodat `decompressEntry` haar niet als budgetweigering herschrijft.
- **`inflateRawBounded` en `deflateViaCompressionStream` wachten niet op `writer.write`.** Bij een grote buffer
  blokkeert `write` op backpressure zolang niemand de leeskant leest; fouten van de schrijfkant komen via
  `reader.read()` terug (uit het weggehaalde commentaar, niet nagegaan).
- **Een bit-3-entry zonder vindbare data descriptor krijgt geen CRC-toets** (`crcKnown` in `parseViaLocalHeaders`).
  Het local header draagt dan een nul in plaats van de CRC; die als waarheid nemen kan zo'n entry vals afkeuren.
- **`writeZip` is deterministisch**: een vaste DOS-datum (1980-01-01 00:00), geen klok en geen locale, zodat gelijke
  invoer met dezelfde compressor byte-gelijke uitvoer geeft. De wijzigingsdatum draagt het bestandssysteem al.
- **`writeZip` valt terug op methode 0 (store)** als `CompressionStream` ontbreekt; oudere
  WebKitGTK-webviews waren de reële twijfel (uit het weggehaalde commentaar, niet nagegaan). Een geldige ZIP met
  store opent in Excel en LibreOffice; het blad wordt alleen groter.
- **`[Content_Types].xml` komt als eerste entry**: geen eis van de specificatie, maar wat gangbare OOXML-schrijvers
  doen, en sommige strikte lezers leunen erop (uit het weggehaalde commentaar, niet nagegaan).
