# Zoomstappen en verankerd zoomen in de Gantt

De Gantt kent twee soorten zoomstap. Ctrl+= en Ctrl+- (de commando's `zoomIn` en `zoomOut` in `src/state/commands.ts`)
en de lintknoppen Inzoomen en Uitzoomen (`ribbonWidgets.tsx`) tellen `ZOOM_STEP` (10 px per dag) bij de zoom op of
trekken hem eraf, via `setZoom`; de scrollpositie verandert daarbij niet. Zoomen met het wiel (`ZOOM_FACTOR_PER_TICK` in
`useGanttZoom.ts`) en de kale toetsen + en - (`useZoomShortcuts.ts`) vermenigvuldigen met 1,1, verankerd. In en uit
delen één stap, zodat één keer in- en weer uitzoomen op de beginzoom uitkomt. De stap stond eerder op drie plekken
los, en het lint zoomde in met +10 en uit met -5 (kop van `check-zoom-steps.ts`). Dat terugkomen geldt zolang de klem
van `setZoom` (0,5 tot `maxGanttZoom`) niet ingrijpt: vanaf zoom 5 geeft uit en weer in 0,5 en daarna 10,5.

`DEFAULT_ZOOM` (30) is het doel van de lintknop Zoom herstellen, die alleen de zoom zet, en van de kale toets 0
(`resetZoom` in `useGanttViewportCoordinator.ts`, die ook de scroll op 0,0 zet). Ctrl+0 past het project in (ADR 0502) en valt alleen
bij een project zonder taken terug op `resetZoom`. Beide constanten staan alleen in `src/utils/ganttViewport.ts`:
`check-zoom-steps.ts` (04 tot en met 07) zoekt in `src/` naar een kale zoomstap, een kale resetwaarde in `setZoom` en
een tweede declaratie.

## Verankerd zoomen

`computeTimelineZoom` houdt de as-dag onder `anchorX` op zijn plaats, tenzij de scroll op 0 klemt. `anchorX` is lokaal aan het tijdlijnpaneel:
x = 0 is de linkerrand van de tijdlijn, er gaat geen tabel- of paneelbreedte af. Aanroepers zijn
`zoomAt` in `useGanttZoom.ts` (wiel op de cursor, kale + en - in het midden van het paneel) en de wielafhandeling
van de tweede pane in `useGanttViewportCoordinator.ts`. `check-gantt-coordinate-contracts.ts` vergelijkt de
uitkomst bij x = 0 en x = width - 1 en zoekt in de zoomhooks naar `taskTableWidth` en `leftPanelWidth`.

`computeAnchoredZoom` trekt eerst `chartOriginX` van het anker af en geeft `null` als de geklemde zoom gelijk blijft.
In `src/` roept niemand hem aan; alleen `check-zoom-steps.ts` (03c tot en met 03e) gebruikt hem.
