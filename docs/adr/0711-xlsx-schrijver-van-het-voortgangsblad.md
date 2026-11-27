# XLSX-schrijver van het voortgangsblad: vergrendeling, breedtes en validatie

`writeProgressXlsx` schrijft een blad waarin alleen de invulcellen bewerkbaar zijn. Vergrendeling staat
daarom uitgeschreven op elke stijl waar ze ertoe doet (`applyProtection="1"` met `<protection locked="…"/>`), ook
waar `locked="1"` de standaard is: die standaard erft via `cellStyleXfs[0]`, en een latere wijziging of een
programma dat het blad herschrijft kan die keten doorsnijden. Een alleen-lezen kolom die zo ontgrendeld raakt,
merk je pas bij de terugimport.

## Gevolgen

- De kolomstijl staat op `<col>` én op elke cel. Een lege invulcel zonder eigen `<c>` erft de kolomstijl
  (ontgrendeld, met de opmaak van die kolom); de stijl per cel blijft nodig omdat een verzamelrij binnen een ontgrendelde kolom
  vergrendeld moet zijn.
- De tweede fill is `gray125`; volgens het weggehaalde commentaar (niet nagegaan) eist Excel dat, en anders schuiven
  de fill-indexen op. De grijze markering van de verzamelrijen gebruikt die fill in plaats van een derde.
- De kolombreedte volgt de kale kolomsleutel en de waarden, niet de instructie achter de sleutel en niet de
  verzamelrij-markering: anders werd elke kolom tientallen tekens breed. De kopcel loopt om en de kopregel heeft een
  vaste hoogte.
- De kolomsleutels zijn in elke UI-taal Engels, want de lezer herkent de kolommen eraan; alleen de instructie erachter
  komt uit `ProgressXlsxText`.
- Elke invulkolom heeft een eigen `dataValidation`, ook de twee datumkolommen met dezelfde regel: een
  `dataValidation` draagt één `prompt`, dus een gedeeld blok gaf *Actual Finish* de invulhint van *Actual Start*. Het
  bereik slaat de verzamelrijen over: daar staat een mededeling als tekst, en een datum- of getalvalidatie zou daar
  een tegenstrijdige foutmelding geven (`fillableSqref`). Een lege cel is altijd toegestaan, want leeg betekent
  geen wijziging.
- `xmlText.ts` heeft een eigen escaper naast `escapeXml` in `xmlInterchange.ts`: SpreadsheetML schrijft een
  stuurteken als `_xHHHH_` (ECMA-376 `ST_Xstring`), en een letterlijke `_xHHHH_` van de gebruiker krijgt daarom
  `_x005F_` voor het eerste onderstrepingsteken. Samenvoegen met de gewone XML-escaper breekt die round-trip.
  `unescapeXml` keert alles in één pass om, ook `_xHHHH_`, zodat er precies één laag afgaat.
