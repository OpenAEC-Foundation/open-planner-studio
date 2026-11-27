# Vector-PDF: Noto Sans Arabic wordt volledig ingebed, omdat de CID's uit de eigen shaping komen

Voor Noto Sans Arabic zet `fillTextComplex` (`pdfVectorDraw2d.ts`) het glyph-id uit de shaping op de aangeleverde
bytes rechtstreeks als CID in de PDF (`hex` in `bidiShape.ts`). Dat klopt alleen als de ingebedde letter dezelfde
glyph-id's heeft. Daarom bedt `paginateVectorToPdfBytes` (`paginateVector.ts`) Noto Sans Arabic volledig in
(`subset: false`), uit dezelfde bytes. Een terugval- of CJK-letter subset de pagineerder met HarfBuzz, dat de
glyph-id's behoudt (`HB_SUBSET_FLAGS_RETAIN_GIDS` in `hbSubset.ts`). Waarom pdf-lib zelf niet subset, staat in het
ontwerp `docs/superpowers/specs/2026-07-22-vector-pdf-export-design.md` (fase 2 en de risicotabel); welke letters er
in komen, in ADR 0385.
