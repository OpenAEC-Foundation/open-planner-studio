# XLSX-lezer: eigen scanner, rijnummers uit het bestand en middernacht als moment

`readXlsxSheet` leest het eerste werkblad met een eigen tag-scanner, niet met `DOMParser`. De betekenis van een
werkblad zit in attributen (`r`, `t`, `s`, `numFmtId`, `date1904`), en de XML-shim waarmee de planningssuite in Node
draait (`tests/planning/xmldom-shim.ts`) kent geen attributen. De scanner weigert alles wat met `<!` begint en geen
commentaar of CDATA is: een `<!DOCTYPE` of `<!ENTITY` wordt nooit geïnterpreteerd, zodat entiteitsaanvallen
(XXE, billion laughs) een weigering zijn.

## Gevolgen

- Het rijnummer komt uit het `r`-attribuut, niet uit een teller. Rijen mogen in een `.xlsx` ontbreken, en
  `rowNumber` is de sleutel van de handmatige koppelingen en van de rijmap van de voortgangsimport: met een teller
  zouden die stil op een andere rij landen. Een rij- of celnummer dat niet strikt oploopt, weigert de lezer, want
  anders overschrijft de latere rij of cel de eerdere zonder melding.
- De lezer kan `sharedStrings`, ook al schrijft onze schrijver `inlineStr`: volgens het weggehaalde commentaar (niet
  nagegaan) slaat Excel elke tekstcel als gedeelde string op, en dan zou een blad dat in Excel is bewaard leeg
  terugkomen.
- Een geheel serieel getal in een cel waarvan de opmaak een datum mét kloktijd toont, is middernacht als moment; in
  elke andere datumcel is het een kale datum. Van de ingebouwde formaten telt alleen 22: de andere tijdformaten
  tonen geen datum of hangen volgens het weggehaalde commentaar (niet nagegaan) af van de landinstelling (34 en 35
  in ja-jp, ko-kr en zh-tw). Bij een eigen formaat telt alleen de sectie die bij de celwaarde hoort
  (`customFormatHasTime`, `sectionShowsMoment`), en een losse `m` is geen bewijs, want die is maand of minuut.
- `serialToIso` met `withClock` geeft altijd een tijd, ook `T00:00`: een eindmoment om middernacht is iets anders dan
  een kale datum, die de voortgangsimport als einde van die werkdag leest. Daarom kiest `writeProgressXlsx` de
  celopmaak op `isoHasClock` van de bron, niet op een geheel getal.
- In het 1900-stelsel geeft een serieel getal onder `MIN_READABLE_SERIAL_1900` geen datum: Excel telt 1900 als
  schrikkeljaar, en de lezer raadt daar niet.
