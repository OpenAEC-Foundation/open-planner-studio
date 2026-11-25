# De vector-PDF tekent in logische px, met de y-as al omgeklapt

`renderReport` tekent in logische px met de y-as omlaag, zoals een canvas. `PdfVectorDraw2D`
(`src/services/pdf/pdfVectorDraw2d.ts`) neemt die getallen ongeschaald over en klapt alleen elke y om (`flipY`: `H - y`,
met `H` de logische hoogte die de pagineerder aan de constructor geeft; de logische breedte gebruikt de tekenaar niet).
Een rechthoek krijgt zo zijn oorsprong linksonder, zoals PDF hem wil. Omdat de omklap in de getallen zit en niet in een
matrix, staat tekst rechtop. `paginateVectorToPdfBytes` (`paginateVector.ts`) geeft het Form-XObject daarom
`BBox [0, 0, breedte, hoogte]` en de eenheidsmatrix, en de `cm` per venster op een blad doet alleen de schaal van px
naar punten en de verschuiving, geen omklap (`drawTile`). Dat het rapport in logische px tekent en de pagineerder
schaalt, staat in het ontwerp `docs/superpowers/specs/2026-07-22-vector-pdf-export-design.md` (§4.1: geen `scale` of
`setTransform` in `Draw2D`).

## Gevolgen

- Alle maten die de tekenaar opneemt, zijn logische px in het coördinatenstelsel van het XObject: lijndikte,
  streepjespatroon, lettergrootte (de px uit de lettertekst) en de plaats van tekst. De tekst zelf staat niet in het
  XObject maar op het blad, onder dezelfde `cm` (ADR 0383); pas die `cm` maakt er punten van.
- Waar de pagineerder een tekst aan een blad toewijst, rekent hij in niet-omgeklapte rapport-px (ADR 0383).
- De tekenaar kent geen eigen transformatie of knipcontour; knippen doet alleen de pagineerder, per venster.
