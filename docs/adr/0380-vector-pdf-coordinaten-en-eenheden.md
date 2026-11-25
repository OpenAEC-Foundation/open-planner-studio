# De vector-PDF tekent in logische px, met de y-as al omgeklapt

`renderReport` tekent in logische px met de y-as omlaag, zoals een canvas. `PdfVectorDraw2D`
(`src/services/pdf/pdfVectorDraw2d.ts`) neemt die getallen ongeschaald over en klapt alleen elke y om: `flipY` geeft
`H - y`, met `H` de logische hoogte die de pagineerder aan de constructor geeft (de logische breedte gebruikt de tekenaar
niet). Een rechthoek wordt `rectangle(x, H - (y + h), w, h)`, met de oorsprong linksonder zoals PDF hem wil. Omdat de
omklap in de tekening zit en niet in een matrix, staat tekst rechtop: de basislijn ligt op `H - basislijn` en de glyphs
groeien in PDF omhoog, op het blad ook omhoog. `paginateVectorToPdfBytes` (`paginateVector.ts`) geeft het Form-XObject
daarom `BBox [0, 0, breedte, hoogte]` en de eenheidsmatrix, en de `cm` per venster op een blad doet alleen de schaal van
px naar punten en de verschuiving, geen omklap (`drawTile` rekent ze uit). Dat het rapport in logische px
tekent en de pagineerder schaalt, staat in het ontwerp `docs/superpowers/specs/2026-07-22-vector-pdf-export-design.md`
(§4.1: geen `scale` of `setTransform` in `Draw2D`).

## Gevolgen

- Alle maten die de tekenaar in de PDF-stroom zet, zijn logische px in het XObject: lijndikte, streepjespatroon,
  lettergrootte (`setFontAndSize` met de px uit de lettertekst) en de tekstmatrix. Pas de `cm` van het blad maakt er
  punten van.
- De tekstmatrix van een tekst staat in absolute XObject-coördinaten (omgeklapt), de plek waarop de pagineerder een
  tekst aan een blad toewijst in niet-omgeklapte rapport-px (ADR 0383).
- De tekenaar kent geen eigen transformatie of knipcontour; knippen doet alleen de pagineerder, per venster.
