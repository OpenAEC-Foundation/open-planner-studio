# XLSX-lezer: eigen scanner, rijnummers uit het bestand en middernacht als moment

`readXlsxSheet` leest het eerste werkblad met een eigen tag-scanner, niet met `DOMParser`. De betekenis van een
werkblad zit in attributen (`r`, `t`, `s`, `numFmtId`, `date1904`), en de XML-shim waarmee de planningssuite in Node
draait (`tests/planning/xmldom-shim.ts`) kent geen attributen. De scanner weigert alles wat met `<!` begint en geen
commentaar of CDATA is: een `<!DOCTYPE` of `<!ENTITY` wordt nooit geïnterpreteerd, zodat entiteitsaanvallen
(XXE, billion laughs) een weigering zijn.

## Gevolgen

- Het rijnummer komt uit het `r`-attribuut; alleen zonder geldig `r` neemt de lezer het volgende nummer. Rijen
  mogen in een `.xlsx` ontbreken, en `rowNumber` is de sleutel van de handmatige koppelingen en van de rijmap van de voortgangsimport: met een teller
  zouden die stil op een andere rij landen. Een rij- of celnummer dat niet strikt oploopt, weigert de lezer, want
  anders overschrijft de latere rij of cel de eerdere zonder melding.
- Staat de werkmap niet op `xl/workbook.xml`, dan weigert de lezer (`noSheet`): de metadata komen in één ronde van
  vaste paden, en een ander pad zou een derde leesronde vragen. Weigeren is eerlijker dan een leeg blad.
- De lezer kan `sharedStrings`, ook al schrijft onze schrijver `inlineStr`: een spreadsheetprogramma slaat tekstcellen
  bij bewaren als gedeelde string op (de LibreOffice-bestanden in `tests/planning/fixtures/xlsx-libreoffice/` hebben
  allemaal `sharedStrings` en geen `inlineStr`), en dan zou een bewaard blad leeg terugkomen.
- Een geheel serieel getal in een cel waarvan de opmaak een datum mét kloktijd toont, is middernacht als moment; in
  elke andere datumcel is het een kale datum. Van de ingebouwde formaten telt alleen 22: de andere tijdformaten
  tonen geen datum of hangen af van de landinstelling (34 en 35 in ja-jp, ko-kr en zh-tw; ECMA-376 deel 1, §18.8.30,
  geeft de formaten 27 tot en met 36 eigen varianten per Aziatische taal). Bij een eigen formaat telt alleen de sectie die bij de celwaarde hoort
  (`customFormatHasTime`, `sectionShowsMoment`), en een losse `m` is geen bewijs, want die is maand of minuut.
- `serialToIso` met `withClock` geeft altijd een tijd, ook `T00:00`: een eindmoment om middernacht is iets anders dan
  een kale datum, die de voortgangsimport als einde van die werkdag leest. Daarom kiest `writeProgressXlsx` de
  celopmaak op `isoHasClock` van de bron, niet op een geheel getal.
- In het 1900-stelsel geeft een serieel getal onder `MIN_READABLE_SERIAL_1900` geen datum: Excel telt 1900 als
  schrikkeljaar, en de lezer raadt daar niet.
