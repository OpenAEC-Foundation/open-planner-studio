# De bladindeling: één pure functie met kant-en-klare vensters

De rasterpagineerder (`paginateCanvasToTile` in `paginate.ts`, met uitsneden via `drawImage`) en de vectorpagineerder
(`paginateVectorToPdfBytes` in `paginateVector.ts`, één Form-XObject dat per blad onder een eigen clip wordt geplaatst)
moeten dezelfde bladen opleveren, en het papier op het Rapport-tabblad (`reportPaperModel.ts`) moet dezelfde bladen
tonen als de PDF. Daarom rekent één pure functie de hele bladindeling uit: `computeTileLayout`
(`src/services/print/tileLayout.ts`), zonder canvas, DOM of pdf-lib, zodat ze ook headless te toetsen is. Het ontwerp
van de vector-PDF (`docs/superpowers/specs/2026-07-22-vector-pdf-export-design.md`) koos al voor één gedeelde
tegelwiskunde. De uitkomst is volledig uitgerekend: per kolom een lijst horizontale vensters (`TileColumn.xWindows`) in
plaats van een vlag "herhaal de bevroren strook". De herhaalde tabel is zo een gewoon venster in die lijst, en beide
pagineerders lopen er met dezelfde lus overheen zonder zelf iets af te leiden.

## Gevolgen

- Eenheden: de invoer en de bronvensters (`srcX`, `srcW`, `srcY`, `srcH`, `frozenPx`, `repeatHeaderPx`,
  `repeatFooterPx`, `repeatFooterSrcY`, `footerLayoutWidthPx`) zijn in logische px van de render (ADR 0230). De plek op
  het blad (`pageX`, `bodyTopPt`, `footerTopPt`) en de papier- en printmaten zijn in PDF-punten, gemeten vanaf de
  linker- en de bovenrand van het papier, de marge inbegrepen. `scale` is het aantal punten per logische px.
- Een venster kan een breedte of hoogte van 0 of minder hebben (bijvoorbeeld bij een lege bron); beide pagineerders
  slaan zo'n venster over (hun `drawTile`).
- Beide pagineerders zetten de bladen rij voor rij en binnen een rij van links naar rechts: `paginateCanvasToTile`
  leidt rij en kolom af uit `pageIndex`, `paginateVectorToPdfBytes` loopt over `bodyRows` en daarbinnen over
  `columns`. Het aantal bladen is `rows × cols`.
- Zonder `frozenColumnWidthPx`, `repeatHeaderHeightPx`, `repeatFooterHeightPx` en `timelineColumns` herhaalt de functie
  geen tabel, kop of voet en gebruikt ze één paginabreedte; `marginPt` valt terug op `DEFAULT_MARGIN_PT`. Dat zijn de
  standaarden van de functie, niet van de Gantt-afdruk: `DEFAULT_REPORT_SETTINGS` (`src/utils/reportSettings.ts`) zet
  `repeatHeader` en `repeatFooter` aan.
- `reportTileInput` maakt de invoer uit een renderresultaat voor de vector-PDF en het papier. De rasterexport van de
  Gantt-afdruk (`exportGanttReportPdf.ts`) en de raster-terugval van de tabelrapporten (`exportTableRaster` in
  `ReportPanel.tsx`) stellen hun invoer zelf samen.
- De schaal en de kolommen staan in ADR 0351, kop en voet in ADR 0352, en waar een blad eindigt in ADR 0353.
