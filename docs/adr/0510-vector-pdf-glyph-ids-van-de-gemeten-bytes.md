# Vector-PDF: de ingebedde letter houdt de glyph-id's van de bytes waarmee gemeten wordt

`paginateVectorToPdfBytes` (`paginateVector.ts`) shapet, meet en toetst Noto Sans Arabic en de terugval- en CJK-letters
met fontkit-letters die het zelf uit de aangeleverde bytes maakt, niet met de letter die pdf-lib inbedt. Voor Arabisch
zet `fillTextComplex` (`pdfVectorDraw2d.ts`) het glyph-id uit die shaping rechtstreeks als CID in de PDF (`hex` in
`bidiShape.ts`). Dat klopt alleen als de ingebedde letter dezelfde glyph-id's heeft. Daarom bedt de pagineerder Noto
Sans Arabic volledig in (`subset: false`) uit dezelfde bytes, en subset hij een terugval- of CJK-letter met HarfBuzz
met behouden glyph-id's (`HB_SUBSET_FLAGS_RETAIN_GIDS` in `hbSubset.ts`) voordat ook die zonder subset wordt ingebed.
Een andere subsetter voor de optie `subsetFont` moet de glyph-id's dus ook behouden. Waarom pdf-lib zelf niet subset, staat in het ontwerp `docs/superpowers/specs/2026-07-22-vector-pdf-export-design.md`
(fase 2 en de risicotabel); welke letters er in komen, in ADR 0385.
