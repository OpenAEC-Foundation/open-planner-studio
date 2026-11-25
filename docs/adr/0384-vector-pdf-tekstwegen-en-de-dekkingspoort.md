# Drie wegen voor tekst in de vector-PDF, en een dekkingspoort naar raster

De letters gaan met `subset: false` de PDF in (`embedReportFont`; een terugvalletter na een eigen subset, ADR 0385),
en dan zet pdf-lib een teken zonder glyph volgens het ontwerp
`docs/superpowers/specs/2026-07-22-vector-pdf-export-design.md` (fase 4) zonder fout op `.notdef`: een leeg vakje in
de PDF. Daarom houdt `PdfVectorDraw2D` bij welke tekens geen letter heeft (`uncoveredCodepoints`), en gooit
`paginateVectorToPdfBytes` dan `VectorUnsupportedError`: na de eerste render met de geladen terugvalletters (is er
geen geladen, na de eerste render) en opnieuw na een render voor een smallere voet. `exportGanttReportPdf.ts` (de
Gantt-afdruk) en `ReportPanel.tsx` (de andere rapporten) vangen elke fout van de vector-PDF en maken dan hun
rasterexport, die de browser laat tekenen; `describeVectorFallback` herkent deze fout aan haar naam en zet de
ongedekte tekens in de waarschuwing op de console. `fillText` kiest per tekst één van drie wegen, in deze volgorde;
`measureText` meet langs dezelfde drie (`measureReportText`, regel `reports`).

1. **Arabisch of Hebreeuws** (`hasRtlText`) en de shaping-letters zijn er: de shaping-kern (`shapeAndPlace` in
   `bidiShape.ts`) zet de tekst in visuele volgorde in stukken van de rapportletter (F0/F1) of Noto Sans Arabic (F2/F3),
   en `fillTextComplex` geeft elke glyph een eigen tekstmatrix. Volgens het weggehaalde commentaar dekt de breedtetabel
   `/W` van pdf-lib alleen de glyphs die het zelf registreert; een geshapte glyph zonder eigen matrix viel dan op de
   standaardbreedte `/DW` en de Arabische letters kwamen los van elkaar te staan. Dat is niet nagegaan.
2. **Een teken dat de rapportletter mist en een terugvalletter wel heeft** (`needsFallback`): stukken per letter
   (`splitFallbackRuns`), elk met zijn eigen letter op de opgetelde breedte van de stukken ervoor (ADR 0385).
3. **De rest**: één tekst in de rapportletter (F0 gewoon, F1 vet) via `laidOutTextOps` (regel `reports`, alinea over
   fontkit 3).

Buiten weg 1 haalt `fillText` de bidi-stuurtekens eerst weg (`stripBidiControls`): zonder herordening doen ze niets.
Volgens het weggehaalde commentaar zou pdf-lib ze als `.notdef` zetten, en zet `Intl` in het Arabisch en Perzisch een
U+200E vóór een minteken. Een stuurteken telt in geen enkele weg mee voor de dekking.

## Gevolgen

- Dekking buiten weg 1 (`checkCoverage`): een teken is gedekt als de rapportletter in het gewicht van de tekst het
  heeft, of Noto Sans Arabic, of een terugvalletter (`fallbackIndexFor`: haar `covers` en een glyph in haar gewone
  letter).
- Dekking in weg 1 (`checkCoverageComplex`): per teken de letter die de shaping-kern kiest (`fontClassFor`): Arabisch
  schrift moet in Noto staan, een neutraal teken (`isNeutralCp`) in de rapportletter of Noto, elk ander teken in de
  rapportletter. Een terugvalletter telt hier niet mee, want weg 1 tekent nooit met een terugvalletter. Een Chinees
  teken in een tekst met Arabisch is dus ongedekt, ook met een CJK-extensie, en die PDF wordt raster. Hebreeuws is geen
  Arabisch schrift (`isArabicScriptCp`) en hoort zo bij de rapportletter; mist die het, dan wordt de PDF raster.
- Omdat de twee regels verschillen, heeft elk een eigen cache per teken (`coverageCache`, `coverageCacheComplex`).
  Volgens het weggehaalde commentaar tekent een grote planning duizenden labels met steeds dezelfde tekens en zocht
  zonder cache elke tekst al zijn tekens opnieuw op. Een cache geldt voor beide gewichten (knownbug 2451).
- `hasRtl` wordt waar zodra de dekkingscontrole een teken van rechts naar links ziet (`isRtlCodepoint`);
  `VectorUnsupportedError` geeft het mee en `describeVectorFallback` noemt het in de waarschuwing.
- `check-report-font.ts` (B2) eist `VectorUnsupportedError` met de ongedekte tekens als een letter zonder terugval
  Cyrillisch of `≤` mist, en (B3, C2) een vector-PDF met die tekens uit Inter als terugval.
