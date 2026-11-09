---
paths:
  - "src/engine/reports/**"
  - "src/components/panels/ReportPanel.tsx"
  - "src/components/panels/reports/**"
  - "src/services/pdf/**"
  - "src/services/print/**"
  - "src/utils/reportSettings.ts"
  - "tests/planning/check-reports*"
---

<!-- Verplaatst uit CLAUDE.md (2026-09): laadt alleen wanneer Claude een bestand leest dat op `paths` past. Inhoud overgenomen; kruisverwijzingen wijzen naar het betreffende rules-bestand. -->

### Rapporten: één kolomspec voor DOM én PDF

Het Rapport-tabblad (`ReportPanel.tsx`) kent twaalf rapporttypen (`ReportType` in
`src/utils/reportSettings.ts`): de Gantt-afdruk (Canvas → raster/vector-PDF), het **resourcediagram**
(issue #113: dezelfde Gantt-render met als rijenbron `computeResourceGanttRows` uit
`src/engine/reports/resourceGantt.ts` — per resource-IDENTITEIT een band (niet per naam, zoals de
schermgroepering: gelijknamigen krijgen `#n`, naamlozen een surrogaat), daaronder zijn bladtaken op
start; relaties staan bij dit type uit omdat een taak onder meerdere banden kan staan, en het vinkje
*Kritiek pad* is er verborgen en geforceerd aan (`reportTypeShowsCriticalToggle`: het vinkje kleurt alleen
relatielijnen en legendaregel, de balken volgen `barColorSelection` via `criticalFill`); optie "blad
per resource" = `PrintOptions.pageBreakBeforeGroups`
→ `RenderReportResult.forcedBreakOffsets` → `forcedBreakOffsetsPx` in `tileLayout`, waar een gedwongen
positie zonder vulgraaddrempel wint — een band direct onder een band (de optionele typelaag
`groupByType`: eerst een band per resourcetype in de vaste volgorde `RESOURCE_TYPE_BAND_ORDER`) krijgt
geen eigen gedwongen positie; optie *Rapportageperiode* = de gedeelde `ReportingPeriod` als
`PrintOptions.timeWindow` (tijdas exact op het venster, geometrie geklemd op het chartgebied want
`Draw2D` kent geen clip; de rijenbron filtert op overlap en telt `counts.outsidePeriod`); optie
*Eenheden/dag en curve tonen* = `PrintOptions.assignmentColumns` + `rowAssignments` (per `rowKey`
uit `assignmentByRowKey`: eenheden opgeteld, curve alleen bij eensluidende records) als twee
tabelkolommen achter de naam; `isGanttReportType()` bundelt beide Gantt-achtige typen; de voet
met legenda is sinds #113 net als de kop een herhaalbaar blok — `RenderReportResult.footerHeight` →
`repeatFooterHeightPx`/`repeatFooter`, instelling `repeatFooter` standaard aan; let op: de preview
rendert per pagina één volledige `renderReport`-pass extra voor die strook, net als voor de kop), het
mijlpalen- en variance-rapport (eigen DOM-component + `build*Columns` voor de PDF) en zeven **tabelrapporten**
uit discussie #31 — look-ahead, kritiek/near-critical, voortgang, planningsgezondheid,
resourcebelasting (per week of maand), resourcetoewijzingen en WBS-samenvatting. Die zeven hebben
een pure rekenlaag in `src/engine/reports/` (één `ReportContext` in, rijen met rauwe waarden uit;
headless getest in `tests/planning/check-reports.ts`) en één presentatielaag: `useTableReportSpec.tsx` bouwt
per type een `TableReportSpec` (titel, meldingen, samenvatting, secties met een `ReportColumn`-
lijst), `TableReportView.tsx` tekent daar de `<table>`s uit en `makeSectionedRenderReport`
(`pdfTable.ts`) de vector-PDF — dezelfde kolomspec, dus DOM en PDF kunnen niet uit elkaar lopen.
Nieuw tabelrapport ⇒ engine-module, een `build*`-functie in `useTableReportSpec`, opties in
`TableReportOptions` + `TableReportOptionsBlock`, sleutels onder `tableReports.*` in alle 28
`report.json`-locales, en een sectie in `ref-rapporttypes.md` (nl+en). Rapporten met een
tijdvenster (look-ahead, voortgang, belasting, toewijzingen) delen de **rapportageperiode** (issue
#120): een `ReportingPeriod` (preset rond de statusdatum, `project` of `custom` met twee ISO-dagen)
uit `src/engine/reports/reportingPeriod.ts`, per rapport opgeslagen in `TableReportOptions`, in de
UI het gedeelde `ReportingPeriodField`, en in de engine opgelost via `resolvePeriodFor(ctx, period)`
— nooit een eigen weken-getal erbij bouwen.

**Voortgangscurve** (issue #689, spec `docs/superpowers/specs/2026-10-27-voortgangscurve-rapport.md`) is
een tabelrapport (`progressCurve`, rekenlaag `progressCurve.ts`) met twee extra blokken in dezelfde
`TableReportSpec`: `kpis` (kaarten) en `chart` (een `CurveChartSpec`). De ligging van de grafiek komt uit
één pure functie (`layoutCurveChart` in `src/services/pdf/pdfCurveChart.ts`); het scherm tekent die als
SVG in de themakleuren (`CurveChartView`), de PDF via `Draw2D` op wit (`makeSectionedRenderReport`). Een
nieuwe grafiek of een nieuw blok hoort op dezelfde manier: één ligging, twee tekenaars. Het rapport leest
alleen wat de laatste berekening op de taken zette; het rekent niets door.

**Kolombreedtes zijn gemeten, niet vast.** De datakolommen van de Gantt-/resourcediagram-tabel (WBS,
Duur, Start, Einde, Volt., Eenh./d) worden — net als de naam- en de curvekolom — door `ReportPanel`
op de echte koppen én cellen van dít rapport gemeten (`measureTableColumnWidths`) en via
`PrintOptions.columnWidths` doorgegeven; zonder meting gelden de oude vaste breedtes uit `COL`, dus
elk pad zonder canvas blijft byte-identiek. Meten hoort in het paneel en niet in de printlaag:
`measurePrintReport` (paginering) heeft geen canvas en zou anders een ándere tabelbreedte uitrekenen
dan de raster- en vector-render. De celteksten komen daarbij uit één bron (`taskTableCellTexts`) die
de render óók gebruikt — anders meet je "Duur" en teken je iets anders. Bij de tabelrapporten doet
`fitColumnsToHeaders` (`pdfTable.ts`) hetzelfde voor de PDF, maar **alleen verbreden**: een kolom die
haar eigen vertaalde kop niet kwijt kan groeit mee, versmallen niet — `mode: 'fit-width'` schaalt een
smallere tabel juist gróter, en celinhoud hoort in een vrije-tekstkolom wél af te kappen.

**Eén tekstmeting voor papier, paneel en vector-PDF** (issue #817, `src/services/pdf/reportTextMeasure.ts`).
`PdfVectorDraw2D.measureText`, het SVG-papier van het nieuwe tabblad en de kolommeting in beide panelen
(`loadReportTextMetrics` in `fontLoader.ts`) tellen de advance-breedtes uit het fontbestand op
(`measureReportText`: shaping-kern voor RTL, stukken per terugvalletter, anders de rapportletter). Niet
het canvas: dat rondt bij kleine letters af (Chromium op Linux: "Stakeholder management" 115 tegen 109,0)
en dan kapte de PDF datums af die het scherm voluit toonde. Niet fontkit-`layout`/`widthOfTextAtSize`:
GSUB kost bij Inter ruim 1 ms per tekst. Het verschil met de getekende glyphs (Inter "->", Carlito "ti")
is klein en zit in papier én PDF. `check-report-svg.ts` (sectie 5) vergelijkt per tekstitem papier en
echte PDF; dat zijn twee uitkomsten van dezelfde meting.

**Het scherm tekent met dezelfde letters als het meet** (review Sol #847). Een meting uit het fontbestand
klopt alleen als de browser dezelfde letter tekent. Daarom: (1) `ensureReportFontLoaded` laadt ook Noto Sans
Arabic als `@font-face` (familie `ARABIC_REPORT_FAMILY`, met `ARABIC_REPORT_UNICODE_RANGE`: Arabisch schrift
en neutrale tekens). (2) Een tekst met Arabisch of Hebreeuws tekent het scherm met `reportTextFont`: Noto
vóór de rapportletter en kerning aan, zoals de shaping-kern (`fontkit.layout`, met kerning) hem in de PDF
zet; SVG via de letterklasse (`reportFontRule`), canvas in `CanvasDraw2D.withScreenFont`. De vaste stack
zelf blijft gelijk (`check-report-font.ts` A0/C0). Over blijft alleen een neutraal teken op een
links-naar-rechtsniveau in zo'n tekst (PDF: rapportletter, browser: Noto; 0,19 px per spatie bij 9 px Inter).
(3) Een tekst met een teken dat geen meegeleverde letter heeft (`coversReportText`: Chinees zonder
CJK-extensie, Lao, Hebreeuws in Inter) meet met het canvas (`createCanvasTextMetrics` als `uncovered` in
`createReportTextMetrics`): het scherm tekent hem in een systeemletter en de PDF valt dan terug op raster.
(4) Canvas en browsermeting zetten `textRendering = 'geometricPrecision'`, net als het papier: zonder die
instelling rondt Chromium op Linux elke letterbreedte af ("Stakeholder management" 115 tegen 109,0) en kapte
het oude voorbeeld de langste naam af terwijl afkappen uit stond. Bewaking op de werkelijk getekende tekst:
`tests/browser/report-studio.spec.ts` (SVG `getBBox` tegen de getekende kolomlijn, canvas `fillText`
meegelezen; Arabisch, een lange Latijnse en een Chinese naam). Het canvas kapt nog af met zijn eigen meting
(GSUB-verschillen zoals Carlito "ti", knownbug 968); een CJK-extensie tekent alleen in de PDF (knownbug 967).

**Rijvenster voor het papier** (issue #817). `renderReport` neemt een optioneel laatste argument
`rowWindow` (`ReportRowWindowRequest`): het krijgt het renderresultaat (maten liggen vast vóór het tekenen)
en geeft een y-bereik terug. Dan tekent de render alleen de rijen daarin (plus een rij marge, en altijd de
eerste en laatste rij); kop, tijdas, raster, statuslijn en voet tekenen altijd. Alleen het papier gebruikt
dit (`createReportPaperRecorder` in `reportPaperModel.ts`); de PDF en de tests tekenen alles. Een blad uit
een gedeeltelijke opname moet gelijk zijn aan hetzelfde blad uit de volledige: `check-report-svg.ts` sectie 6.
Wie in `renderReport` iets tekent dat per rij werk doet, filtert het met `rowDrawn`.

**De rapportletter is een parameter** (issue #770). De canvas-fontstack komt uit `PrintOptions.fontFamily`,
de derde parameter van `makeTableRenderReport`/`makeSectionedRenderReport` en het `fontStack`-argument van
de meethulpen (`nameCellFont`, `tableTextFont`, `curveCellFont`, `TableColumnMeasureInput.fontFamily`);
zonder waarde geldt `DEFAULT_REPORT_FONT_STACK` (het gevendorde Inter, `src/services/pdf/reportFont.ts`).
Meten in het paneel en tekenen in de render horen op dezelfde stack. De vector-backend leest de familie
niet uit de string maar tekent met de bytes die de pagineerder inbedt: geef `paginateVectorToPdfBytes` dus
de bytes van dezelfde letter, plus `fallbackFonts` (Inter) voor tekens die die letter mist — zonder
terugval valt de hele PDF om één `≤` of één Cyrillische naam terug op raster. De subsetter (`subsetFont`
uit `hbSubset.ts`) komt als optie binnen, zodat de pagineerder headless te bundelen is; bewaking:
`tests/planning/check-report-font.ts`. De keuzelijst *Lettertype* (`ReportFontSelect`, naast Papier en
Oriëntatie, dus ook in `TableReportOptionsBlock`) kiest één id uit het vaste setje `REPORT_FONTS` in
`reportFont.ts` (Inter, Liberation Sans, Carlito, Liberation Serif; besluit Ethan 2026-11-07), bewaard
als `reportFontFamily` in `ops-reportSettings` — nooit in het IFC-bestand. Uit die id volgen de
fontstack (`reportFontStack`: de letter, dan `InterPDF`; dezelfde stack voor het canvas en, via
`reportFontStyle`, voor de DOM-kaarten van mijlpalen, variance en tabelrapporten) en de bytes
(`getReportFontBytes`); laden via `ensureReportFontLoaded(id)`, dat nooit afwijst. `fontLoader.ts`
registreert elke letter als CSS-`@font-face`-regel (een `<style data-ops-report-font>`), geen losse
`FontFace`: de raster-terugval van de tabelrapporten is een DOM-opname met `modern-screenshot`, en die
neemt alleen `@font-face`-regels uit de stylesheets mee. Een export wacht tot de naam-, curve- en
datakolommen op de gekozen letter gemeten zijn (`measuredOnChosenFont` in `ReportPanel`): direct na
een wissel staan er nog breedtes van de vorige letter, en dan kapt de PDF namen af die wel passen.
Een nieuwe letter: zie `src/services/pdf/fonts/README.md`.
