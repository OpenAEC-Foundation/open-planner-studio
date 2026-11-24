# De tijdas van de afdruk: de functies van het scherm, en een tabel met vaste maat

De afdruk heeft haar eigen tekenlogica, maar geen eigen tijdrekening. `renderReport` bouwt de tijdas met dezelfde
functies als de scherm-Gantt (`resolveGanttAxis` en `isCompressedEffective` uit `workdayAxis.ts`) en plaatst balken,
mijlpalen, speling, onderbrekingen en baselines met de gedeelde functies van het scherm (`taskBarSpan`,
`milestoneAnchorX`, `floatBandEnd`, `taskSplitSegments`, `baselineSpanX`). De weekindeling volgt `weekStartDay` met
`getWeekNumberFor`, en de arcering van vrije dagen de kalender (`CalendarEngine.isWorkDay`). Zo
beantwoordt de afdruk die vragen niet op een tweede plek. `check-print-screen-parity.ts` toetst de gedeelde
weekfuncties en, met een toets op de bron, dat de afdruk de kalender gebruikt; `check-print-bar-moments.ts` legt balken,
fasebalk, relatiepijl en mijlpaal van het scherm en de afdruk naast elkaar.

Bij *Passend maken* krijgt de tabel op elk papierformaat dezelfde fysieke maat en krijgt alleen de tijdas meer of
minder pixels per dag. `printableWidthLogicalPx` is de bronbreedte die de pagineerder met zijn vaste verhouding 0,75
(96 dpi naar 72 pt) op één papierbreedte zet; de tabel staat op elke paginabreedte opnieuw, dus over N breedtes
(`timelineColumns`) heeft de tijdas `N × (printableWidth − tableWidth)` px. Een vaste ondergrens voor de breedte per
dag zou een meerjarenplanning te breed maken, waarna de pagineerder de hele tabel mee verkleint
(`check-print-report.ts`, sectie 5).

## Gevolgen

- `timelineColumns` bepaalt in de render de beschikbare breedte van de tijdas (`availableChartWidth`): bij *Passend
  maken* de breedte per dag, en in beide schaalstanden of de strook voor de datums bij de balken past (ADR 0237). De
  bladindeling (`tileLayout.ts`) moet hetzelfde getal krijgen.
- Het bereik van de as zonder tijdvak loopt over de getoonde datums van de afgedrukte taken, met de spelingsband als
  `showFloat` aan staat, en met de baselines van die taken als `showBaselineOverlay` aan staat: een
  vergelijkingsbaseline ver vóór of na de taken viel anders buiten het blad (issue #391). Daarbuiten een week marge
  vooraan en twee weken achteraan. Met een tijdvak is de as precies het tijdvak (regel `reports`).
- Op de werkdagas vervangen weekbanden de weekendarcering, zoals op het scherm (`check-print-compress-week-banding.ts`).
  Een tijdvak zonder werkdag valt voor dat tijdvak terug op de kalenderas, want op de werkdagas zou het naar de eerste
  werkdag buiten het tijdvak schuiven (`check-print-report.ts`, het weekendvenster).
- *Vaste schaal* mag tot `REPORT_MIN_DAY_WIDTH` (0,01 px per dag), omdat het Rapport-tabblad bij de wissel vanaf
  *Passend maken* begint op de breedte die passen gaf, en die ligt bij een lange planning onder 1 px per dag. Volgens het
  weggehaalde commentaar gaf 1 px als ondergrens bij 5000 taken op A3 een sprong van 139 naar 695 pagina's.
  `fixedScaleStartDayWidth` neemt die breedte een miljardste smaller, zodat een afrondfout in de bladindeling geen extra
  kolom bladen geeft. Toets: `check-report-svg.ts`, sectie 7.
