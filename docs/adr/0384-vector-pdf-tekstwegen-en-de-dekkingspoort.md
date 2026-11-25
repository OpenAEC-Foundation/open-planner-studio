# Drie wegen voor tekst in de vector-PDF, en een dekkingspoort naar raster

De letters gaan met `subset: false` de PDF in (`embedReportFont`; een terugvalletter na een eigen subset, ADR 0385).
Volgens het ontwerp `docs/superpowers/specs/2026-07-22-vector-pdf-export-design.md` (fase 4) zet pdf-lib dan een teken
zonder glyph zonder fout op `.notdef`: een leeg vakje in de PDF. Daarom houdt `PdfVectorDraw2D` bij welke tekens geen
letter heeft (`uncoveredCodepoints`), en gooit `paginateVectorToPdfBytes` dan `VectorUnsupportedError`: na de eerste
render met de geladen terugvalletters (is er geen geladen, na de eerste render) en opnieuw na een render voor een
smallere voet. `exportGanttReportPdf.ts` (de Gantt-afdruk) en `ReportPanel.tsx` (de andere rapporten) vangen elke fout
van de vector-PDF en maken dan hun rasterexport, die de browser laat tekenen. `fillText` kiest per tekst één van drie
wegen, in deze volgorde; `measureText` meet langs dezelfde drie (`measureReportText`, regel `reports`).

1. **Arabisch of Hebreeuws** (`hasRtlText`), als de shaping-letters er zijn: de shaping-kern (`shapeAndPlace` in
   `bidiShape.ts`) zet de tekst in visuele volgorde in stukken van de rapportletter of Noto Sans Arabic, en
   `fillTextComplex` geeft elke glyph een eigen plaats. Volgens het weggehaalde commentaar dekt de breedtetabel van
   pdf-lib alleen de glyphs die het zelf registreert; een geshapte glyph zonder eigen plaats viel dan op de
   standaardbreedte (`/DW`), en de Arabische letters kwamen los van elkaar te staan. Dat is niet nagegaan.
2. **Een teken dat de rapportletter mist en een geladen terugvalletter wel heeft** (`needsFallback`): stukken per
   letter (`splitFallbackRuns`, ADR 0385).
3. **De rest**: de hele tekst in de rapportletter (`laidOutTextOps`, regel `reports`, alinea over fontkit 3).

Buiten weg 1 haalt `fillText` de bidi-stuurtekens eerst weg (`stripBidiControls`): zonder herordening doen ze niets.
Volgens het weggehaalde commentaar zou pdf-lib ze als `.notdef` zetten, en zet `Intl` in het Arabisch en Perzisch een
U+200E vóór een minteken. Een stuurteken telt in geen enkele weg mee voor de dekking.

## Gevolgen

- Dekking buiten weg 1 (`checkCoverage`): een teken is gedekt als de rapportletter in het gewicht van de tekst het
  heeft, of Noto Sans Arabic, of een terugvalletter (`fallbackIndexFor`: haar `covers` en een glyph in haar gewone
  letter). Uitzondering: weg 2 en 3 tekenen nooit met Noto. Een teken dat de rapportletter mist en Noto heeft, geldt
  als gedekt en laat zelf geen terugvalletter laden. Zo'n teken passeert de dekkingspoort en wordt getekend in de
  rapportletter, in weg 2 en in weg 3, want er is geen terugvalletter voor gekozen; het komt dan zonder fout als
  `.notdef` in de PDF. Zo wordt de smalle vaste spatie U+202F met Liberation Mono een vakje (knownbug 2452). Een teken
  dat ook Noto en elke terugvalletter mist, is ongedekt en geeft de rasterexport.
- Dekking in weg 1 (`checkCoverageComplex`): per teken de letter die de shaping-kern kiest (`fontClassFor`): Arabisch
  schrift moet in Noto staan, een neutraal teken (`isNeutralCp`) in de rapportletter of Noto, elk ander teken in de
  rapportletter. Een terugvalletter telt hier niet mee, want weg 1 tekent nooit met een terugvalletter. Een Chinees
  teken in een tekst met Arabisch is dus ongedekt, ook met een CJK-extensie, en die PDF wordt raster. Hebreeuws is geen
  Arabisch schrift (`isArabicScriptCp`) en hoort zo bij de rapportletter; mist die het, dan wordt de PDF raster.
- Omdat de twee regels verschillen, heeft elk een eigen cache per teken (`coverageCache`, `coverageCacheComplex`).
  Volgens het weggehaalde commentaar tekent een grote planning duizenden labels met steeds dezelfde tekens en zocht
  zonder cache elke tekst al zijn tekens opnieuw op. Een cache geldt voor beide gewichten (knownbug 2451).
- `check-report-font.ts`: B2 eist `VectorUnsupportedError` met `Ф` en `≤` bij de ongedekte tekens voor een letter
  zonder die tekens en zonder terugval. De toets met Inter als terugval (B3) staat in ADR 0385.
