# Tekst in de vector-PDF: buiten het gedeelde XObject, per tekst een plaatsing

De vormen van het rapport staan één keer in een gedeeld Form-XObject dat elk blad plaatst (ADR 0232, 0350). Stond de
tekst daar ook in, dan zou het uitlezen van elk blad de tekst van het hele rapport geven: in het ontwerp
`docs/superpowers/specs/2026-07-22-vector-pdf-export-design.md` (fase 2, punt G2) gaf dat één taaknaam 798 keer op A1.
`PdfVectorDraw2D.fillText` zet tekst daarom niet in `operators` maar maakt per tekst een `PdfTextPlacement` in `texts`:
de tekstoperatoren, met hun eigen vulkleur en zo nodig hun eigen doorzichtigheid (ADR 0382) rond `BT…ET`, en een kader
in rapport-px met de y-as omlaag (`x0`, `x1`, `y0`, `y1`). `drawTile` in `paginateVector.ts` zet een plaatsing onder
dezelfde knipcontour en `cm` als het XObject van dat venster, alleen als het kader het bronvenster overlapt. De
`setTextMatrix` staat in absolute XObject-coördinaten (ADR 0380), dus dezelfde `cm` zet de tekst waar hij in het XObject
zou staan.

## Gevolgen

- Het kader loopt horizontaal van de linkerkant van de tekst over de gemeten breedte, verticaal van de basislijn min de
  stijghoogte tot de basislijn min de daalhoogte. Stijg- en daalhoogte zijn die van de rapportletter in het gewicht van
  de tekst (`fontVerticalMetrics`, in em maal de lettergrootte; de daalhoogte is negatief), ook voor een tekst met
  Arabisch of een terugvalletter.
- Uitlijning (`placeText`): `center` schuift de tekst de halve gemeten breedte naar links, `right` de hele breedte,
  anders begint hij op x. De breedte is die van de hele tekst, over alle stukken in andere letters, zodat ook
  rechts uitgelijnde tekst met Arabisch op zijn plek eindigt.
- Basislijn (`placeText`): `alphabetic` is de gegeven y, `middle` ligt de halve som van stijg- en daalhoogte lager,
  `bottom` de daalhoogte hoger. Ook hier altijd met de maten van de rapportletter, zodat volgens het weggehaalde
  commentaar rijen met verschillende schriften gelijk uitlijnen. Het papier rekent zo met `reportBaselineShift`
  (`reportTextMeasure.ts`).
- Een geshapte glyph uit het pad met Arabisch heeft een x vanaf het begin van de tekst en een y ten opzichte van de
  basislijn, positief omhoog (`PlacedGlyph` in `bidiShape.ts`); `fillTextComplex` telt die y op bij de omgeklapte
  basislijn.
- De lettertekst (`font`) levert alleen gewicht en grootte (`parseReportFont`): vet bij `bold` of 600 tot 900, de
  grootte uit het eerste getal met `px`, anders 10. De familie in die tekst leest de tekenaar niet; hij tekent met de
  letters die de pagineerder inbedt (regel `reports`).
- Een lege tekst tekent niets.
- `check-report-svg.ts` (punt 5) vergelijkt per tekst het kader links en rechts en de basislijn (uit `y0` plus de
  stijghoogte) van de echte vector-PDF met het papier.
