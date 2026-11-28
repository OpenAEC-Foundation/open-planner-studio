# Het project passend maken in de Gantt, en de start- en eindketen van een taak

De viewport rekent met twee ketens per taak, in `src/utils/ganttViewport.ts`. `resolveTaskStart` is de getoonde start
(`shownStart`), met de late start als terugval. `resolveTaskFinish` is het getoonde einde (`shownFinish`), dan het
late einde, en als laatste terugval `resolveTaskStart`. De eerste schakel is dezelfde datum als de balk
(`GanttRenderer` tekent met `shownStart` en `shownFinish`), zodat de fit en de scrollbreedte elke getekende balk
omvatten. De laatste terugval van het einde zorgt dat een taak met alleen een start meetelt voor de fit en ook voor de
scrollbare breedte (`computeContentSpanDays` in `ganttRenderOptions.ts` gebruikt dezelfde `resolveTaskFinish`).
Zonder die terugval kon de fit naar een positie buiten `maxScrollX` zoomen.
`check-gantt-render-options.ts` toetst de schakels van beide ketens (01b, 01d, 05c, 05e), de terugval op de start
(06b) en dat de startketen buiten dit bestand nergens in `src/` staat (39).

`computeFitToProject` is de ene berekening achter Ctrl+0 (`fitToProject`) en de fit na het openen (het signaal
`pendingFit`), allebei in `useGanttViewportCoordinator.ts`. Hij krijgt de gemeten breedte van het tijdlijnpaneel. De zoom is die breedte
gedeeld door de periode van de vroegste start tot het laatste einde (in as-dagen, plus één, minstens 1), geklemd op
0,5 tot `maxGanttZoom`. `viewStartDate` wordt de vroegste start, en de scroll loopt vanaf de oorsprong
(`computeEffectiveViewStart`, ADR 0501) naar die start. Vroegste en laatste worden gekozen door de datumteksten te
vergelijken.

## Gevolgen

- De functie geeft `null` zonder taken, bij een breedte van 0 of minder en als geen enkele taak een start heeft (het
  einde valt terug op de start). Bij Ctrl+0 zonder taken herstelt `fitToProject` de zoom (ADR 0500), bij `null` om een andere
  reden doet hij niets; de fit na het openen wist bij `null` het signaal en laat de weergave staan.
- De as-afstand komt als `dayDistance` binnen (`axisDayDistance`, ADR 0503), zodat de periode op de werkdagen-as in
  werkdagen telt (`check-workday-axis-nav.ts`). Zonder dat argument telt de functie kalenderdagen.
- `baselineEarliest` schuift alleen de oorsprong; de zoom en de eerste zichtbare dag blijven die van de taken
  (`check-baseline-vergelijking.ts`, "E Inpassen").
- Een einde of start die geen datum is maar wel als tekst achter of vóór de datums sorteert, geeft een onbruikbare
  fit; zie knownbug 2541.
