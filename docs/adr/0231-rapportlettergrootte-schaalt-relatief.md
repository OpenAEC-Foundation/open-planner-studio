# De rapportlettergrootte schaalt relatief, niet het hele rapport

De Gantt-afdruk heeft een instelling Lettergrootte (`PrintOptions.reportFontScale`, een percentage uit
`REPORT_FONT_SCALES`). Bij *Passend maken* zou dezelfde factor voor alle bronmaten op papier niets veranderen: de
pagineerder zet de bronbreedte op de paginabreedte (`computeTileLayout` in `tileLayout.ts`), dus een bron die k keer zo
groot is, komt k keer zo klein op papier. Daarom schaalt `makeMetrics` alleen de tekstzones: de lettergroottes, de
rijhoogte, de projectkop, de tijdschaalkop, de voet en de kolombreedtes van de tabel. De breedte per dag schaalt niet
met de factor. Bij *Vaste schaal* blijft ze `customZoom`; bij *Passend maken* volgt ze uit de ruimte naast de tabel, en
die wordt kleiner als de tabel groeit (ADR 0234). Bij *Vaste schaal*, en bij *Passend maken* zolang de tabel minstens 1
px van de paginabreedte overlaat, staat de bron op 0,75 pt per px (ADR 0234): dan worden tekst en tabel op papier groter
en passen er minder rijen op een blad.

## Gevolgen

- Alle tekenhelpers rekenen met de geschaalde maten uit `ReportMetrics` (`m.s`, `m.font`, `m.rowHeight`, `m.cols`); de
  module-constanten (`ROW_HEIGHT`, `COL`, `CELL_PAD` en de andere) zijn de maten bij 100%. Een helper die een constante
  ongeschaald gebruikt in een tekstzone, verschuift tegen de rest: zo zouden de drie regels van de projectkop bij 125%
  over elkaar lopen als hun hoogtes vast bleven.
- Vaste vormen in het chartgebied horen bij de tijdas en schalen niet: de knik van een relatielijn (`DEP_STUB`), de
  pijlpunt, de haakjes van een fase en de afstand tussen balk en label (`BAR_LABEL_GAP`, `BAR_LABEL_PAD_LEFT`).
  `BAR_LABEL_GAP` bestaat om vrij te blijven van de knik en schaalt daarom net als de knik niet (ADR 0232). Het
  streepjespatroon van een niet-bepalende relatie schaalt wel (ADR 0235).
- Een waarde buiten `REPORT_FONT_SCALES` gaat naar de dichtstbijzijnde keuze (`snapToChoice`), in `makeMetrics` en bij
  het laden van de instellingen (`reportSettings.ts`). Klemmen op het bereik zou bijvoorbeeld 108% tekenen, een grootte
  die de keuzelijst niet kan tonen.
- `REPORT_FONT_SCALES` is de enige lijst: de keuzelijst in `GanttReportStudio.tsx`, het laden in `reportSettings.ts` en
  `makeMetrics` lezen hem.
- `totalHeaderHeight` is de som van de twee geschaalde kophoogtes, niet de som van de ongeschaalde maal k, zodat de
  grens van de herhaalde kop precies op de onderrand van de tijdschaalkop valt.
- Toetsen met een lettergrootte: `check-today-label.ts`, `check-dependency-style.ts` (sectie 5),
  `check-report-font-setting.ts` en `check-print-report.ts`.
