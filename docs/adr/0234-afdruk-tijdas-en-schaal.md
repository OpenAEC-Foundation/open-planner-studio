# De tijdas van de afdruk: de functies van het scherm, en twee schaalstanden

De afdruk heeft haar eigen tekenlogica, maar geen eigen tijdrekening. `renderReport` bouwt de tijdas met dezelfde
functies als de scherm-Gantt (`resolveGanttAxis` en `isCompressedEffective` uit `workdayAxis.ts`) en plaatst balken,
mijlpalen, speling, onderbrekingen en baselines met de gedeelde functies van het scherm (`taskBarSpan`,
`milestoneAnchorX`, `floatBandEnd`, `taskSplitSegments`, `baselineSpanX`). De weekindeling volgt `weekStartDay` met
`getWeekNumberFor`, en de arcering van vrije dagen de kalender (`CalendarEngine.isWorkDay`). Zo beantwoordt de afdruk
die vragen niet op een tweede plek. `check-print-screen-parity.ts` toetst de gedeelde weekfuncties en, met een toets op
de bron, dat de afdruk de kalender gebruikt; `check-print-bar-moments.ts` legt balken, fasebalk, relatiepijl en mijlpaal
van het scherm en de afdruk naast elkaar.

De twee schaalstanden. Bij *Vaste schaal* (pagineermodus `actual`) zet de pagineerder de bron op 0,75 pt per logische
px en kiest de planner de breedte per dag (`customZoom`). Bij *Passend maken* (`fit-width`) geeft `renderReport` de
tijdas de ruimte naast de tabel (`availableChartWidth`: over N paginabreedtes uit `timelineColumns` `N ×
(printableWidthLogicalPx − tableWidth)` px, minstens N px), en de breedte per dag is die ruimte, min de stroken voor de
datums bij de balken als die getekend worden (ADR 0237), gedeeld door het aantal dagen op de as. Blijft er naast de
tabel minstens 1 px over, dan komt de pagineerder bij *Passend maken* op dezelfde 0,75 pt per px uit als bij *Vaste
schaal*; laat de tabel minder over (een grote lettergrootte, een brede naamkolom, klein of staand papier), dan krijgt
de tijdas die minimale breedte en verkleint de pagineerder de hele bron, tabel inbegrepen. De 0,75 gaat over de schaal,
niet over de breedte van de tabel: in het resourcediagram vallen de twee toewijzingskolommen weg als de tabel te weinig
voor de tijdas overlaat (ADR 0233), dus dezelfde instellingen kunnen daar op een ander papier of bij een andere
lettergrootte een andere tabelbreedte geven. De schaal van beide standen staat in `computeTileLayout`
(`tileLayout.ts`). Een vaste ondergrens voor de breedte per dag zou bij *Passend maken* een meerjarenplanning ook te
breed maken, met dezelfde verkleining. `check-print-report.ts` (sectie 5) toetst met een planning van vijf jaar en de
standaardtabel dat *Passend maken* op A4 tot en met A1 (ook over vier paginabreedtes) op 0,75 blijft met een tabel van
dezelfde maat, en dat *Vaste schaal* dezelfde maat geeft; het geval met een te brede tabel en het geval waarin kolommen
wegvallen toetst die sectie niet.

## Gevolgen

- `timelineColumns` bepaalt in de render de beschikbare breedte van de tijdas (`availableChartWidth`): bij *Passend
  maken* de breedte per dag, en in beide schaalstanden of de strook voor de datums bij de balken past (ADR 0237). De
  bladindeling (`tileLayout.ts`) moet hetzelfde getal krijgen.
- Het bereik van de as zonder tijdvak loopt over de getoonde datums van de afgedrukte taken, met de spelingsband als
  `showFloat` aan staat, en met de baselines van die taken als `showBaselineOverlay` aan staat: een
  vergelijkingsbaseline ver vóór of na de taken viel anders buiten het blad (issue #391). Daarbuiten een week marge
  vooraan en twee weken achteraan. Met een tijdvak is de as precies het tijdvak (regel `reports`).
- Op de werkdagas vervangen weekbanden de weekendarcering, zoals op het scherm (`check-print-compress-week-banding.ts`).
  Een tijdvak zonder werkdag valt op de werkdagas voor dat tijdvak terug op de kalenderas, want anders zou de as naar de
  eerste werkdag buiten het tijdvak schuiven.
- De status- en de voortgangslijn tekenen met het streepjespatroon en de kleur van de vandaaglijn: op papier zijn het
  dezelfde soort referentielijn. De voortgangslijn is naar het voorbeeld van `GanttRenderer.drawProgressLine`: alleen
  een bladtaak die geen mijlpaal is stulpt uit naar haar voortgang, en de vergelijking met de statusdatum gaat per dag,
  of op het tijdstip als de projectkalender met tijd rekent (`isHourModeCalendar`, `statusDateInstant`). Toets:
  `check-print-report.ts`, sectie 2. Met `showCompletion` krijgt een voltooide taak geen spelingsband: er is geen
  speling meer te bewaken.
- Van een onderbroken balk komen de buitenranden uit `taskBarSpan` en liggen de grenzen ertussen op hun moment, zodat
  ook een pauze korter dan een dag te zien is.
- Een taakbalk in kleurvakken (`computeBarColors`, één keer per taak) verdeelt in elk werkblok van een onderbroken taak
  dezelfde kleurgewichten, per werkblok op pixels afgerond: kleurkeuze en onderbreking staan los van elkaar. De
  voortgangsgrens loopt over de hele taak. `check-split-bar-render.ts` (deel B) bewaakt de werkblokken en die
  voortgangsgrens, niet de kleurverdeling per werkblok.
- Met een tijdvak verdeelt de afdruk de kleurvakken per werkblok over de ongeknipte tijdas en knipt ze daarna op het
  chartgebied, zodat een afgekapte balk de kleuren van zijn zichtbare stuk toont (een grens daarvan: knownbug 1862). Een
  fase die het tijdvak overschrijdt, krijgt aan de afgekapte kant geen haakje, want dat zou daar een begin of einde
  suggereren (een grens daarvan: knownbug 1863).
- *Vaste schaal* mag tot `REPORT_MIN_DAY_WIDTH` (0,01 px per dag), omdat het Rapport-tabblad bij de wissel vanaf
  *Passend maken* begint op de breedte die passen gaf, en die ligt bij een lange planning onder 1 px per dag. Volgens
  het weggehaalde commentaar gaf 1 px als ondergrens bij 5000 taken op A3 een sprong van 139 naar 695 pagina's.
  `fixedScaleStartDayWidth` neemt die breedte een miljardste smaller, zodat een afrondfout in de bladindeling geen extra
  kolom bladen geeft. Toets: `check-report-svg.ts`, sectie 7.
