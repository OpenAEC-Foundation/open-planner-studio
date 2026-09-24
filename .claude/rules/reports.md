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

Het Rapport-tabblad (`ReportPanel.tsx`) kent elf rapporttypen (`ReportType` in
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
`TableReportOptions` + `TableReportOptionsBlock`, sleutels onder `tableReports.*` in alle 14
`report.json`-locales, en een sectie in `gids-rapporten-printen.md` (nl+en). Rapporten met een
tijdvenster (look-ahead, voortgang, belasting, toewijzingen) delen de **rapportageperiode** (issue
#120): een `ReportingPeriod` (preset rond de statusdatum, `project` of `custom` met twee ISO-dagen)
uit `src/engine/reports/reportingPeriod.ts`, per rapport opgeslagen in `TableReportOptions`, in de
UI het gedeelde `ReportingPeriodField`, en in de engine opgelost via `resolvePeriodFor(ctx, period)`
— nooit een eigen weken-getal erbij bouwen.

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
