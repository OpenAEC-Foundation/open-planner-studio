# De printlaag: één renderer, gevoed door de aanroeper

`renderReport` (`src/services/print/printPreview.ts`) tekent de Gantt-afdruk tegen een `Draw2D`; dat besluit staat in
het ontwerp `docs/superpowers/specs/2026-07-22-vector-pdf-export-design.md` (B6). Drie tekenroutes roepen dezelfde
functie aan met een andere backend: het papier op het Rapport-tabblad neemt de aanroepen op als SVG
(`SvgRecordingDraw2D`, via `createReportPaperRecorder` in `reportPaperModel.ts`), de vector-PDF tekent met
`PdfVectorDraw2D` (`paginateVector.ts`), en de rasterexport met `CanvasDraw2D` (`renderPrintCanvas`), die
`exportGanttReportPdf.ts` gebruikt als de vector-PDF mislukt. De SVG-opname en het canvas houden de volgorde van de
aanroepen aan; de vector-PDF zet de tekst boven de vormen (ADR 0232). De printlaag leest de store niet en heeft geen
`t()`. Alles wat de afdruk nodig heeft, geeft de aanroeper mee: taken, relaties, kalender en projectnaam als argument,
en in `PrintOptions` onder meer de vertaalde teksten (`labels`, `curveLabels`, `durationSuffixes`,
`barColorsLegendLabels`), resources en toewijzingen voor de balkkleuren, de rijen en de bepalende relaties. De kleur van
een balk komt uit `computeBarColors` (`barColors.ts`); de printlaag zet dat advies alleen om in een vlak, vakken en een
rand. Zo is de render headless te draaien en te toetsen: de `check-print-*.ts` en `check-report-*.ts` tekenen met een
opnemende `Draw2D`.

## Gevolgen

- De printlaag filtert, groepeert en sorteert niet zelf. Ze tekent de `rows` die de aanroeper meegeeft (de rijenbron van
  het Rapport-tabblad, regel `reports`), en zonder `rows` de takenboom (`taskTreeRows`, in `buildPrintRows`).
- `drivingSequenceIds` komt van de aanroeper (in de app `useStudioPrintOptions`, via `knownDrivingSequenceIds`):
  bepalend is een eigenschap van de relatie in de laatste berekening (`CPMResult.drivingSequenceIds`), niet van de twee
  taken, en dat veld wordt niet opgeslagen. Wat het ontbreken van het veld betekent, staat in ADR 0235.
- De teksten zonder vertaling vallen terug op vaste woorden in de code (Nederlands of Engels, per veld). De labels van
  de projectkop dragen hun eigen dubbele punt, net als `printed`, zodat elke taal haar eigen leestekens kiest.
- `makeDraw2D` wordt één keer aangeroepen, zodra de maten van het rapport vastliggen en vóór er getekend wordt. Ook het
  rijvenster (`ReportRowWindowRequest`, regel `reports`) krijgt die maten vooraf. Het rijvenster tekent de eerste en de
  laatste rij altijd: hun randen raken de herhaalde kop en voet, en die moeten op elk blad gelijk zijn.
- `measurePrintReport` draait dezelfde render op een `Draw2D` zonder canvas, met een geschatte `measureText`. Dat mag,
  omdat de maten in `RenderReportResult` niet van een tekstmeting afhangen: ze komen uit de kolombreedtes, de kop-, rij-
  en voethoogtes en de tijdas. Gemeten kolombreedtes geeft de aanroeper mee (ADR 0233).
- `renderPrintCanvas` neemt een `renderScale` en valt zonder die waarde terug op `devicePixelRatio`. De enige aanroeper
  in de app, `exportGanttReportPdf.ts`, geeft hem altijd mee: 1 voor de maten, daarna `computeHighResScale` (uit
  `@/utils/miniPdf`), zodat de resolutie van een rasterexport niet afhangt van de pixeldichtheid van het scherm van wie
  exporteert.
- `RenderReportResult` geeft zijn maten in logische px, dezelfde eenheid die `tileLayout.ts` naar punten omrekent; de
  rasterschaal komt daar apart bij. `tableWidth` en `headerHeight` zijn geschaald met de rapportlettergrootte (ADR
  0231), want als de pagineerder de tabel of de kop op een blad herhaalt, neemt hij precies die maat. `footerHeight` is
  net als `headerHeight` verplicht, zodat een render die de voet vergeet niet compileert. Elke positie in
  `forcedBreakOffsets` is ook een positie in `breakOffsets`: een gedwongen overgang staat op de bovenrand van een
  bandrij, de onderrand van de rij erboven.
